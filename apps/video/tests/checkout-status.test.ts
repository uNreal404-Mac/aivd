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
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".delete(");
  });
});
