// ==============================================
// API Metrics Collector
// ==============================================
// Tracks every API request: count, latency, status,
// errors. In-memory with rolling window (24h).

import { Request, Response, NextFunction } from 'express';

interface RequestMetric {
  method: string;
  path: string;
  status: number;
  duration: number;
  timestamp: number;
  error?: string;
}

interface EndpointStats {
  path: string;
  method: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  avgDuration: number;
  p95Duration: number;
  maxDuration: number;
  lastError?: string;
  lastErrorAt?: string;
  lastCalledAt: string;
}

interface ExternalApiMetric {
  name: string;
  calls: number;
  successes: number;
  failures: number;
  avgLatency: number;
  lastError?: string;
  lastCalledAt?: string;
}

// Rolling window — keep last 24h of requests (max 50K entries)
const MAX_ENTRIES = 50000;
const WINDOW_MS = 24 * 60 * 60 * 1000;
const metrics: RequestMetric[] = [];

// External API tracking
const externalApis: Map<string, { calls: number; successes: number; failures: number; totalLatency: number; lastError?: string; lastCalledAt?: string }> = new Map();

function cleanup() {
  const cutoff = Date.now() - WINDOW_MS;
  while (metrics.length > 0 && metrics[0].timestamp < cutoff) {
    metrics.shift();
  }
  // Hard cap
  while (metrics.length > MAX_ENTRIES) {
    metrics.shift();
  }
}

// ── Middleware — tracks every API request ──────

export function apiMetricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    const originalEnd = res.end;

    res.end = function (...args: any[]) {
      const duration = Date.now() - start;

      // Normalize path: replace UUIDs and IDs with :id
      let path = req.route?.path || req.path;
      path = path.replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '/:id');
      path = path.replace(/\/\d+/g, '/:id');

      const metric: RequestMetric = {
        method: req.method,
        path,
        status: res.statusCode,
        duration,
        timestamp: Date.now(),
      };

      // Capture error message for failed requests
      if (res.statusCode >= 400) {
        metric.error = res.statusMessage || `HTTP ${res.statusCode}`;
      }

      metrics.push(metric);

      // Periodic cleanup
      if (metrics.length % 100 === 0) cleanup();

      originalEnd.apply(res, args);
    };

    next();
  };
}

// ── Track External API calls ──────────────────

export function trackExternalApi(name: string, success: boolean, latencyMs: number, error?: string) {
  let entry = externalApis.get(name);
  if (!entry) {
    entry = { calls: 0, successes: 0, failures: 0, totalLatency: 0 };
    externalApis.set(name, entry);
  }
  entry.calls++;
  entry.totalLatency += latencyMs;
  entry.lastCalledAt = new Date().toISOString();
  if (success) {
    entry.successes++;
  } else {
    entry.failures++;
    if (error) entry.lastError = error;
  }
}

// ── Get Aggregated Stats ──────────────────────

export function getApiMetrics() {
  cleanup();

  const now = Date.now();
  const last1h = now - 60 * 60 * 1000;
  const last5m = now - 5 * 60 * 1000;

  // Overall stats
  const total = metrics.length;
  const last1hMetrics = metrics.filter(m => m.timestamp >= last1h);
  const last5mMetrics = metrics.filter(m => m.timestamp >= last5m);
  const errors = metrics.filter(m => m.status >= 400);
  const errors5xx = metrics.filter(m => m.status >= 500);

  // Requests per minute (last 5 min)
  const rpm = last5mMetrics.length / 5;

  // Average latency
  const avgLatency = total > 0 ? Math.round(metrics.reduce((s, m) => s + m.duration, 0) / total) : 0;

  // Per-endpoint breakdown
  const endpointMap = new Map<string, RequestMetric[]>();
  for (const m of metrics) {
    const key = `${m.method} ${m.path}`;
    if (!endpointMap.has(key)) endpointMap.set(key, []);
    endpointMap.get(key)!.push(m);
  }

  const endpoints: EndpointStats[] = [];
  for (const [key, reqs] of endpointMap) {
    const [method, path] = key.split(' ');
    const durations = reqs.map(r => r.duration).sort((a, b) => a - b);
    const errReqs = reqs.filter(r => r.status >= 400);
    const lastErr = errReqs.length > 0 ? errReqs[errReqs.length - 1] : null;

    endpoints.push({
      path,
      method,
      totalRequests: reqs.length,
      successCount: reqs.filter(r => r.status < 400).length,
      errorCount: errReqs.length,
      avgDuration: Math.round(durations.reduce((s, d) => s + d, 0) / durations.length),
      p95Duration: durations[Math.floor(durations.length * 0.95)] || 0,
      maxDuration: durations[durations.length - 1] || 0,
      lastError: lastErr?.error,
      lastErrorAt: lastErr ? new Date(lastErr.timestamp).toISOString() : undefined,
      lastCalledAt: new Date(reqs[reqs.length - 1].timestamp).toISOString(),
    });
  }

  // Sort by total requests desc
  endpoints.sort((a, b) => b.totalRequests - a.totalRequests);

  // Status code breakdown
  const statusCodes: Record<number, number> = {};
  for (const m of metrics) {
    statusCodes[m.status] = (statusCodes[m.status] || 0) + 1;
  }

  // Recent errors (last 20)
  const recentErrors = errors.slice(-20).reverse().map(m => ({
    method: m.method,
    path: m.path,
    status: m.status,
    duration: m.duration,
    error: m.error,
    timestamp: new Date(m.timestamp).toISOString(),
  }));

  // Slowest endpoints (p95 > 1s)
  const slowEndpoints = endpoints
    .filter(e => e.p95Duration > 1000)
    .sort((a, b) => b.p95Duration - a.p95Duration)
    .slice(0, 10);

  // External APIs
  const externalApiStats: ExternalApiMetric[] = [];
  for (const [name, data] of externalApis) {
    externalApiStats.push({
      name,
      calls: data.calls,
      successes: data.successes,
      failures: data.failures,
      avgLatency: data.calls > 0 ? Math.round(data.totalLatency / data.calls) : 0,
      lastError: data.lastError,
      lastCalledAt: data.lastCalledAt,
    });
  }

  return {
    overview: {
      totalRequests24h: total,
      requestsLastHour: last1hMetrics.length,
      requestsPerMinute: Math.round(rpm * 10) / 10,
      totalErrors: errors.length,
      total5xxErrors: errors5xx.length,
      errorRate: total > 0 ? Math.round((errors.length / total) * 1000) / 10 : 0,
      avgLatencyMs: avgLatency,
      uptime: Math.round(process.uptime()),
    },
    statusCodes,
    endpoints,
    slowEndpoints,
    recentErrors,
    externalApis: externalApiStats,
  };
}

// ── Get Timeline Data (for charts) ────────────

export function getApiTimeline(bucketMinutes: number = 5) {
  cleanup();
  const now = Date.now();
  const bucketMs = bucketMinutes * 60 * 1000;
  const buckets: { time: string; requests: number; errors: number; avgLatency: number }[] = [];

  // Last 2 hours in buckets
  for (let t = now - 2 * 60 * 60 * 1000; t < now; t += bucketMs) {
    const bucketMetrics = metrics.filter(m => m.timestamp >= t && m.timestamp < t + bucketMs);
    buckets.push({
      time: new Date(t).toISOString(),
      requests: bucketMetrics.length,
      errors: bucketMetrics.filter(m => m.status >= 400).length,
      avgLatency: bucketMetrics.length > 0
        ? Math.round(bucketMetrics.reduce((s, m) => s + m.duration, 0) / bucketMetrics.length)
        : 0,
    });
  }

  return buckets;
}
