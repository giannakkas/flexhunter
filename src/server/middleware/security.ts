// ==============================================
// Security Middleware
// ==============================================
// Rate limiting, request timeouts, input sanitization

import { Request, Response, NextFunction } from 'express';

// ── In-Memory Rate Limiter ───────────────────
// No external dependency needed. Resets on restart (fine for single-instance).

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateBuckets) {
    if (entry.resetAt < now) rateBuckets.delete(key);
  }
}, 5 * 60 * 1000);

/**
 * Rate limiter factory
 * @param windowMs - time window in milliseconds
 * @param maxRequests - max requests per window
 * @param keyFn - function to extract rate limit key from request
 */
export function rateLimit(
  windowMs: number,
  maxRequests: number,
  keyFn: (req: Request) => string = (req) => req.ip || 'unknown',
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `rl:${keyFn(req)}`;
    const now = Date.now();
    let entry = rateBuckets.get(key);

    if (!entry || entry.resetAt < now) {
      entry = { count: 0, resetAt: now + windowMs };
      rateBuckets.set(key, entry);
    }

    entry.count++;

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetAt / 1000));

    if (entry.count > maxRequests) {
      console.warn(`[RateLimit] Blocked: ${key} (${entry.count}/${maxRequests} in ${windowMs}ms)`);
      return res.status(429).json({
        success: false,
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    next();
  };
}

// ── Pre-built rate limiters ──────────────────

// General API: 120 requests per minute per IP
export const apiRateLimit = rateLimit(60_000, 120);

// Research: 5 per minute (expensive operation)
export const researchRateLimit = rateLimit(60_000, 5, (req) => `research:${req.ip}`);

// SEO: 10 per minute
export const seoRateLimit = rateLimit(60_000, 10, (req) => `seo:${req.ip}`);

// Auth: 10 per minute
export const authRateLimit = rateLimit(60_000, 10, (req) => `auth:${req.ip}`);

// Import: 20 per minute
export const importRateLimit = rateLimit(60_000, 20, (req) => `import:${req.ip}`);

// ── Request Timeout ──────────────────────────

/**
 * Aborts requests that take longer than the specified time.
 * Returns 504 Gateway Timeout.
 */
export function requestTimeout(ms: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        console.warn(`[Timeout] Request timed out after ${ms}ms: ${req.method} ${req.path}`);
        res.status(504).json({
          success: false,
          error: `Request timed out after ${Math.round(ms / 1000)} seconds. Please try again.`,
        });
      }
    }, ms);

    // Clear timeout when response finishes
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
}

// ── Input Sanitization ───────────────────────

/**
 * Basic sanitization — strips obvious XSS vectors from string body fields.
 * Not a full WAF, but catches the low-hanging fruit.
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        // Strip script tags
        (req.body as any)[key] = value
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
      }
    }
  }
  next();
}
