/**
 * Tiny in-memory fixed-window rate limiter.
 *
 * Best-effort only: state lives in the memory of a single Worker isolate, so
 * limits are per-isolate and reset when the isolate is recycled. Use it as a
 * cheap abuse guard in front of expensive operations, not as a hard quota.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  limit: number;
  windowMs: number;
  now?: () => number;
  /** Maximum number of tracked keys before pruning. Defaults to 10_000. */
  maxKeys?: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  reset(): void;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const { limit, windowMs } = opts;
  const maxKeys = opts.maxKeys ?? DEFAULT_MAX_KEYS;
  const now = opts.now ?? (() => Date.now());

  const buckets = new Map<string, Bucket>();

  /** Drop expired buckets; if still over capacity, drop the oldest entries. */
  const prune = (timestamp: number): void => {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= timestamp) {
        buckets.delete(key);
      }
    }

    while (buckets.size > maxKeys) {
      const oldest = buckets.keys().next();
      if (oldest.done) {
        return;
      }
      buckets.delete(oldest.value);
    }
  };

  return {
    check(key: string): RateLimitResult {
      const timestamp = now();

      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= timestamp) {
        bucket = { count: 0, resetAt: timestamp + windowMs };
        buckets.set(key, bucket);

        if (buckets.size > maxKeys) {
          prune(timestamp);
        }
      }

      if (bucket.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.ceil((bucket.resetAt - timestamp) / 1000),
        };
      }

      bucket.count += 1;

      return {
        allowed: true,
        remaining: Math.max(0, limit - bucket.count),
        retryAfterSeconds: 0,
      };
    },

    reset(): void {
      buckets.clear();
    },
  };
}
