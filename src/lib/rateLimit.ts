// Rate limiting with two interchangeable stores:
//   • Redis (set REDIS_URL) — shared across instances and restarts, for
//     multi-instance deployments.
//   • In-memory Map (default) — correct for a single instance; state is lost
//     on restart and is not shared between replicas.
// Both stores are swapped in behind one async `rateLimit`; if Redis is
// unreachable the limiter degrades to the in-memory store rather than
// failing every request.
import Redis from 'ioredis';
import { logger } from '@/lib/logger';

interface RateLimitStore {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitStore>();

// Clean up expired entries every 5 minutes. unref() so the timer never holds
// the process open (serverless shuts down; vitest exits cleanly).
const cleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}, 5 * 60 * 1000);
cleanup.unref?.();

export interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

const defaultConfig: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
};

export class RateLimitError extends Error {
  constructor(public retryAfter: number) {
    super('Rate limit exceeded');
    this.name = 'RateLimitError';
  }
}

// ---------------------------------------------------------------------------
// Redis store (lazy singleton)
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;
let redisDisabled = false; // set after a connection failure; avoid retry storms

function getRedis(): Redis | null {
  if (redisDisabled || !process.env.REDIS_URL) return null;
  if (redisClient) return redisClient;

  redisClient = new Redis(process.env.REDIS_URL, {
    // Don't let a slow/hung Redis block request handling forever.
    connectTimeout: 2000,
    maxRetriesPerRequest: 1,
    // Bounded reconnection; after this the client stops retrying and we
    // permanently fall back to memory until the process restarts.
    retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1000)),
  });
  // An unhandled 'error' event would crash the process. Log and degrade.
  redisClient.on('error', (error) => {
    logger.warn('Redis rate-limit store unavailable; using in-memory fallback', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
  return redisClient;
}

function redisMarkUnavailable(): void {
  if (!redisDisabled) {
    redisDisabled = true;
    logger.warn('Rate limiting switched to the in-memory store for this process');
  }
}

async function rateLimitRedis(
  key: string,
  config: RateLimitConfig,
  redis: Redis
): Promise<void> {
  const windowSeconds = Math.ceil(config.windowMs / 1000);
  try {
    const current = await redis.incr(key);
    if (current === 1) {
      await redis.expire(key, windowSeconds);
    }
    if (current > config.maxRequests) {
      const ttl = await redis.ttl(key);
      throw new RateLimitError(ttl > 0 ? ttl : windowSeconds);
    }
  } catch (error) {
    if (error instanceof RateLimitError) throw error;
    redisMarkUnavailable();
    // Fall through to the in-memory store for this request.
    rateLimitMemory(key, config);
  }
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

function rateLimitMemory(identifier: string, config: RateLimitConfig): void {
  const now = Date.now();
  const entry = memoryStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    // First request or window expired
    memoryStore.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return;
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    throw new RateLimitError(retryAfter);
  }

  entry.count++;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig = defaultConfig
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await rateLimitRedis(`rl:${identifier}`, config, redis);
    return;
  }
  rateLimitMemory(identifier, config);
}

function isTrustedProxy(): boolean {
  const flag = process.env.TRUST_PROXY;
  return flag === 'true' || flag === '1' || flag === 'yes';
}

/**
 * Bucket identifier for rate limiting.
 *
 * `x-forwarded-for` is client-controllable, so it is only honored when the
 * deployment explicitly opts in with TRUST_PROXY=true — i.e. the app runs
 * behind a proxy that overwrites the header (Vercel, nginx, a load balancer).
 * Otherwise every client shares one fixed bucket: less granular, but an
 * attacker can never rotate a spoofed IP to escape their throttle.
 */
export function getClientIdentifier(request: Request): string {
  if (isTrustedProxy()) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0].trim() || 'unknown';
    }
    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();
  }

  // Not behind a trusted proxy: fall back to a single shared bucket rather
  // than trusting a spoofable header.
  return 'direct';
}
