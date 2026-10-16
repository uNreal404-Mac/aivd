import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  POLL_INTERVAL_MS,
  POLL_TIMEOUT_MS,
  SESSION_ID_PATTERN,
  isValidSessionId,
  orderNoForSession,
  shouldKeepPolling,
  toCheckoutStatus,
  toSubscriptionInfo,
} from "@/lib/checkout-status";

const read = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), "utf8");

describe("SESSION_ID_PATTERN / isValidSessionId", () => {
  it("accepts cs_test_ and cs_live_ session ids", () => {
    expect(SESSION_ID_PATTERN.test("cs_test_0123456789")).toBe(true);
    expect(isValidSessionId("cs_test_abcdefghij1234")).toBe(true);
    expect(isValidSessionId("cs_live_abcdefghij1234")).toBe(true);
  });

  it("rejects invalid values and injection attempts", () => {
    expect(isValidSessionId(undefined)).toBe(false);
    expect(isValidSessionId(null)).toBe(false);
    expect(isValidSessionId(123)).toBe(false);
    expect(isValidSessionId("")).toBe(false);
    expect(isValidSessionId("cs_test_short")).toBe(false);
    expect(isValidSessionId("cs_prod_abcdefghij1234")).toBe(false);
    expect(isValidSessionId("cs_test_abcdefghij1234' OR 1=1 --")).toBe(false);
    expect(isValidSessionId("cs_test_abcdefghij1234; DROP TABLE x")).toBe(false);
    expect(isValidSessionId("cs_test_abcdefghij1234\ncs_live_y")).toBe(false);
  });
});

describe("orderNoForSession", () => {
  it("prefixes the session id with stripe_", () => {
    expect(orderNoForSession("cs_test_abcdefghij1234")).toBe(
      "stripe_cs_test_abcdefghij1234"
    );
  });

  it("matches the orderNo used by the Stripe webhook", () => {
    const source = read(join("src", "payment", "stripe-webhook.ts"));
    expect(source).toContain("stripe_${session.id}");
  });
});

describe("toCheckoutStatus", () => {
  it("returns paid with credits when a row exists", () => {
    expect(toCheckoutStatus({ initialCredits: 100 })).toEqual({
      status: "paid",
      credits: 100,
    });
  });

  it("returns pending when the row is missing or null", () => {
    expect(toCheckoutStatus(undefined)).toEqual({ status: "pending" });
    expect(toCheckoutStatus(null)).toEqual({ status: "pending" });
  });
});

describe("toSubscriptionInfo", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");

  it("returns inactive with null date when the row is missing", () => {
    expect(toSubscriptionInfo(undefined, now)).toEqual({
      active: false,
      currentPeriodEnd: null,
    });
    expect(toSubscriptionInfo(null, now)).toEqual({
      active: false,
      currentPeriodEnd: null,
    });
  });

  it("returns inactive when there is no subscription id", () => {
    expect(
      toSubscriptionInfo(
        {
          stripeSubscriptionId: null,
          stripeCurrentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
        },
        now
      )
    ).toEqual({
      active: false,
      currentPeriodEnd: "2027-01-01T00:00:00.000Z",
    });
    expect(
      toSubscriptionInfo(
        { stripeSubscriptionId: "", stripeCurrentPeriodEnd: null },
        now
      )
    ).toEqual({ active: false, currentPeriodEnd: null });
  });

  it("returns inactive when the period end is in the past", () => {
    expect(
      toSubscriptionInfo(
        {
          stripeSubscriptionId: "sub_123",
          stripeCurrentPeriodEnd: new Date("2025-12-31T23:59:59.000Z"),
        },
        now
      )
    ).toEqual({
      active: false,
      currentPeriodEnd: "2025-12-31T23:59:59.000Z",
    });
  });

  it("returns active when the id exists and the period end is in the future", () => {
    expect(
      toSubscriptionInfo(
        {
          stripeSubscriptionId: "sub_123",
          stripeCurrentPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
        },
        now
      )
    ).toEqual({
      active: true,
      currentPeriodEnd: "2027-01-01T00:00:00.000Z",
    });
  });

  it("treats an equal period end as inactive and ignores invalid dates", () => {
    expect(
      toSubscriptionInfo(
        {
          stripeSubscriptionId: "sub_123",
          stripeCurrentPeriodEnd: new Date(now.getTime()),
        },
        now
      ).active
    ).toBe(false);
    expect(
      toSubscriptionInfo(
        {
          stripeSubscriptionId: "sub_123",
          stripeCurrentPeriodEnd: new Date("nonsense"),
        },
        now
      )
    ).toEqual({ active: false, currentPeriodEnd: null });
  });
});

describe("shouldKeepPolling", () => {
  it("exposes the expected polling constants", () => {
    expect(POLL_INTERVAL_MS).toBe(2000);
    expect(POLL_TIMEOUT_MS).toBe(60000);
  });

  it("keeps polling while pending and below the timeout", () => {
    expect(shouldKeepPolling({ status: "pending" }, 0)).toBe(true);
    expect(shouldKeepPolling({ status: "pending" }, POLL_TIMEOUT_MS - 1)).toBe(
      true
    );
  });

  it("stops when paid or timed out", () => {
    expect(shouldKeepPolling({ status: "paid", credits: 10 }, 0)).toBe(false);
    expect(shouldKeepPolling({ status: "pending" }, POLL_TIMEOUT_MS)).toBe(
      false
    );
  });
});

describe("sitemap", () => {
  it("skips the checkout route", () => {
    const source = read(join("src", "app", "sitemap.ts"));
    const skipSegments =
      source.match(/const SKIP_SEGMENTS = \[[\s\S]*?\];/)?.[0] ?? "";
    expect(skipSegments).toContain('"checkout"');
  });
});

describe("checkout status route", () => {
  it("never writes to the database", () => {
    const source = read(
      join("src", "app", "api", "v1", "checkout", "status", "route.ts")
    );
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain("stripe.checkout");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".delete(");
  });
});

describe("checkout success CTA", () => {
  it("sends paid users to the ai/video generation page", () => {
    const source = read(
      join("src", "components", "checkout", "checkout-success.tsx")
    );
    expect(source).toContain("/ai/video");
    expect(source).not.toContain("/text-to-video");
  });
});
