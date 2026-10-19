import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

function createClock(start = 0) {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
}

describe("createRateLimiter", () => {
  it("allows up to the limit then blocks", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      limit: 3,
      windowMs: 60_000,
      now: clock.now,
    });

    const first = limiter.check("user:1");
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(2);
    expect(first.retryAfterSeconds).toBe(0);

    const second = limiter.check("user:1");
    expect(second.allowed).toBe(true);
    expect(second.remaining).toBe(1);

    const third = limiter.check("user:1");
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);

    const fourth = limiter.check("user:1");
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
    expect(fourth.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports retryAfterSeconds rounded up to the window end", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 10_000,
      now: clock.now,
    });

    expect(limiter.check("user:1").allowed).toBe(true);

    clock.advance(1_500);
    const blocked = limiter.check("user:1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(9);
  });

  it("resets the window after windowMs", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      limit: 2,
      windowMs: 1_000,
      now: clock.now,
    });

    expect(limiter.check("user:1").allowed).toBe(true);
    expect(limiter.check("user:1").allowed).toBe(true);
    expect(limiter.check("user:1").allowed).toBe(false);

    clock.advance(999);
    expect(limiter.check("user:1").allowed).toBe(false);

    clock.advance(1);
    const afterWindow = limiter.check("user:1");
    expect(afterWindow.allowed).toBe(true);
    expect(afterWindow.remaining).toBe(1);
  });

  it("tracks keys independently", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: clock.now,
    });

    expect(limiter.check("user:1").allowed).toBe(true);
    expect(limiter.check("user:1").allowed).toBe(false);

    expect(limiter.check("user:2").allowed).toBe(true);
    expect(limiter.check("user:2").allowed).toBe(false);
  });

  it("prunes keys so the tracked set stays bounded", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      maxKeys: 2,
      now: clock.now,
    });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("c").allowed).toBe(true);

    // "c" is the most recent key and is still tracked (blocked).
    expect(limiter.check("c").allowed).toBe(false);

    // "a" was pruned as the oldest entry, so it starts a fresh window.
    const revived = limiter.check("a");
    expect(revived.allowed).toBe(true);
    expect(revived.remaining).toBe(0);
  });

  it("drops expired entries when pruning", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      maxKeys: 2,
      now: clock.now,
    });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);

    clock.advance(60_000);

    expect(limiter.check("c").allowed).toBe(true);
    // "a" and "b" expired, so "c" is still enforced without eviction issues.
    expect(limiter.check("c").allowed).toBe(false);
  });

  it("clears all state on reset", () => {
    const clock = createClock();
    const limiter = createRateLimiter({
      limit: 1,
      windowMs: 60_000,
      now: clock.now,
    });

    expect(limiter.check("user:1").allowed).toBe(true);
    expect(limiter.check("user:1").allowed).toBe(false);

    limiter.reset();

    const afterReset = limiter.check("user:1");
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0);
  });
});
