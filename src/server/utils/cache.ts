// ==============================================
// Cache Utility
// ==============================================
// Redis-backed caching with TTL and graceful fallback.
// If Redis is unavailable, falls back to in-memory LRU.

import logger from './logger';

let redis: any = null;
let redisAvailable = false;

// Try to connect to Redis
try {
  const Redis = require('ioredis');
  redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 1,
    enableReadyCheck: false,
    connectTimeout: 3000,
    retryStrategy: (times: number) => (times > 3 ? null : Math.min(times * 200, 2000)),
  });
  redis.on('connect', () => { redisAvailable = true; logger.info('Redis cache connected'); });
  redis.on('error', () => { redisAvailable = false; });
} catch {
  logger.warn('Redis unavailable — using in-memory cache');
}

// ── In-Memory Fallback (LRU-ish) ─────────────

const memCache = new Map<string, { value: string; expiresAt: number }>();
const MAX_MEM_ENTRIES = 500;

function memGet(key: string): string | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) { memCache.delete(key); return null; }
  return entry.value;
}

function memSet(key: string, value: string, ttlSeconds: number) {
  // Evict oldest if full
  if (memCache.size >= MAX_MEM_ENTRIES) {
    const oldest = memCache.keys().next().value;
    if (oldest) memCache.delete(oldest);
  }
  memCache.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

function memDel(key: string) { memCache.delete(key); }

// ── Public Cache API ──────────────────────────

export const cache = {
  /**
   * Get cached value, parsed as JSON
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      let raw: string | null = null;
      if (redisAvailable && redis) {
        raw = await redis.get(`fh:${key}`);
      } else {
        raw = memGet(`fh:${key}`);
      }
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  /**
   * Set cache value with TTL in seconds
   */
  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      const raw = JSON.stringify(value);
      if (redisAvailable && redis) {
        await redis.set(`fh:${key}`, raw, 'EX', ttlSeconds);
      } else {
        memSet(`fh:${key}`, raw, ttlSeconds);
      }
    } catch {}
  },

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    try {
      if (redisAvailable && redis) {
        await redis.del(`fh:${key}`);
      } else {
        memDel(`fh:${key}`);
      }
    } catch {}
  },

  /**
   * Cache-through: get from cache or execute fn and cache result
   */
  async through<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
    const cached = await cache.get<T>(key);
    if (cached !== null) return cached;
    const result = await fn();
    await cache.set(key, result, ttlSeconds);
    return result;
  },

  /**
   * Invalidate all keys matching a prefix
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      if (redisAvailable && redis) {
        const keys = await redis.keys(`fh:${prefix}*`);
        if (keys.length > 0) await redis.del(...keys);
      } else {
        for (const key of memCache.keys()) {
          if (key.startsWith(`fh:${prefix}`)) memCache.delete(key);
        }
      }
    } catch {}
  },

  /** Check if Redis is connected */
  isRedisAvailable: () => redisAvailable,
};

export default cache;
