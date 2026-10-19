import { createRateLimiter } from "@/lib/rate-limit";

import { RATE_LIMIT_PER_DAY, RATE_LIMIT_PER_MINUTE } from "./config";

/**
 * NOTE: `@/lib/rate-limit` keeps its buckets in the memory of a single Worker
 * isolate, so these limits are per-isolate and best-effort — the same caveat
 * as every other limiter in this codebase. They are an abuse guard, not a
 * hard billing quota.
 */
const minuteLimiter = createRateLimiter({
  limit: RATE_LIMIT_PER_MINUTE,
  windowMs: 60_000,
});

const dayLimiter = createRateLimiter({
  limit: RATE_LIMIT_PER_DAY,
  windowMs: 86_400_000,
});

export type EnhanceRateLimitResult =
  | { allowed: true }
  | {
      allowed: false;
      scope: "minute" | "day";
      retryAfterSeconds: number;
    };

export function checkEnhanceRateLimit(
  userId: string
): EnhanceRateLimitResult {
  const minute = minuteLimiter.check(userId);
  if (!minute.allowed) {
    return {
      allowed: false,
      scope: "minute",
      retryAfterSeconds: Math.max(1, minute.retryAfterSeconds),
    };
  }

  const day = dayLimiter.check(userId);
  if (!day.allowed) {
    return {
      allowed: false,
      scope: "day",
      retryAfterSeconds: Math.max(1, day.retryAfterSeconds),
    };
  }

  return { allowed: true };
}

/** Test helper: clears both windows. */
export function resetEnhanceRateLimits(): void {
  minuteLimiter.reset();
  dayLimiter.reset();
}
