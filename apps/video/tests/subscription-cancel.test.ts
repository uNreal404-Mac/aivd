import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { NextRequest } from "next/server";

vi.mock("@/lib/payments", () => ({ isPaymentsConfigured: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/payment/stripe-checkout", () => ({
  getUsableStripeKey: vi.fn(),
  createStripeClient: vi.fn(),
}));
vi.mock("@/payment/stripe-customer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/payment/stripe-customer")>();
  return { ...actual, loadOwnSubscription: vi.fn(), recordStripeSubscriber: vi.fn() };
});

import { POST } from "@/app/api/payments/subscription/route";
import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import { createStripeClient, getUsableStripeKey } from "@/payment/stripe-checkout";
import {
  loadOwnSubscription,
  recordStripeSubscriber,
  subscriptionViewOf,
} from "@/payment/stripe-customer";
import { parseSubscriptionChangeResponse } from "@/lib/account-view";

const PERIOD_END = 1_800_000_000;

function sub(overrides: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_1",
    object: "subscription",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    cancel_at: null,
    created: 1_700_000_000,
    metadata: { userId: "user_1" },
    items: { data: [{ id: "si_1", current_period_end: PERIOD_END }] },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

const request = (body: unknown) =>
  ({ json: async () => body }) as unknown as NextRequest;

let update: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isPaymentsConfigured).mockReturnValue(true);
  vi.mocked(getUsableStripeKey).mockReturnValue({ ok: true, key: "sk_test_x", mode: "test" });
  vi.mocked(getCurrentUser).mockResolvedValue({ id: "user_1" } as never);
  update = vi.fn();
  vi.mocked(createStripeClient).mockReturnValue({ subscriptions: { update } } as never);
});

describe("subscriptionViewOf", () => {
  it("renewing, with the period end", () => {
    expect(subscriptionViewOf(sub())).toEqual({ state: "renewing", date: new Date(PERIOD_END * 1000) });
  });

  it("ending at period end keeps the date, so the page can say when", () => {
    expect(subscriptionViewOf(sub({ cancel_at_period_end: true }))).toEqual({
      state: "ending",
      date: new Date(PERIOD_END * 1000),
    });
  });

  it("a dated cancel ends on that date", () => {
    expect(subscriptionViewOf(sub({ cancel_at: 1_790_000_000 }))).toEqual({
      state: "ending",
      date: new Date(1_790_000_000 * 1000),
    });
  });

  it("canceled is ended", () => {
    expect(subscriptionViewOf(sub({ status: "canceled" }))).toEqual({ state: "ended" });
  });
});

describe("POST /api/payments/subscription", () => {
  it("cancels at period end, records it and reports the end date", async () => {
    vi.mocked(loadOwnSubscription).mockResolvedValue(sub());
    update.mockResolvedValue(sub({ cancel_at_period_end: true }));

    const res = await POST(request({ action: "cancel" }));

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: true });
    expect(recordStripeSubscriber).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user_1", subscriptionId: "sub_1", active: true, renewsAt: null }),
    );
    expect(await res.json()).toEqual({ state: "ending", date: new Date(PERIOD_END * 1000).toISOString() });
  });

  it("resumes a period-end cancel", async () => {
    vi.mocked(loadOwnSubscription).mockResolvedValue(sub({ cancel_at_period_end: true, cancel_at: PERIOD_END }));
    update.mockResolvedValue(sub());

    const res = await POST(request({ action: "resume" }));

    expect(update).toHaveBeenCalledWith("sub_1", { cancel_at_period_end: false });
    expect(await res.json()).toMatchObject({ state: "renewing" });
  });

  it("resumes a dated cancel by clearing cancel_at", async () => {
    vi.mocked(loadOwnSubscription).mockResolvedValue(sub({ cancel_at: 1_790_000_000 }));
    update.mockResolvedValue(sub());

    await POST(request({ action: "resume" }));

    expect(update).toHaveBeenCalledWith("sub_1", { cancel_at: "" });
  });

  it("404 when the account has no live subscription", async () => {
    vi.mocked(loadOwnSubscription).mockResolvedValue(null);
    const res = await POST(request({ action: "cancel" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_subscription" });

    vi.mocked(loadOwnSubscription).mockResolvedValue(sub({ status: "canceled" }));
    expect((await POST(request({ action: "cancel" }))).status).toBe(404);
    expect(update).not.toHaveBeenCalled();
  });

  it("502 with a clear code when Stripe refuses", async () => {
    vi.mocked(loadOwnSubscription).mockResolvedValue(sub());
    update.mockRejectedValue(new Error("Permission denied"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(request({ action: "cancel" }));

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "subscription_update_failed" });
  });

  it("rejects bad input, signed-out users and missing keys", async () => {
    expect((await POST(request({ action: "delete" }))).status).toBe(400);
    expect((await POST(request(null))).status).toBe(400);

    vi.mocked(getCurrentUser).mockResolvedValue(null as never);
    expect((await POST(request({ action: "cancel" }))).status).toBe(401);

    vi.mocked(getUsableStripeKey).mockReturnValue({ ok: false, error: "live_mode_disabled" });
    expect((await POST(request({ action: "cancel" }))).status).toBe(503);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("parseSubscriptionChangeResponse", () => {
  it("reads success and maps errors to messages", () => {
    expect(parseSubscriptionChangeResponse(200, { state: "ending", date: "2027-01-15T00:00:00.000Z" })).toEqual({
      ok: true,
      state: "ending",
      date: "2027-01-15T00:00:00.000Z",
    });
    expect(parseSubscriptionChangeResponse(502, { error: "subscription_update_failed" })).toEqual({
      ok: false,
      message: "The subscription could not be changed. Please try again later or contact support.",
    });
    expect(parseSubscriptionChangeResponse(200, {})).toMatchObject({ ok: false });
  });

  it("answers in Chinese on the Chinese account page", () => {
    expect(parseSubscriptionChangeResponse(502, { error: "subscription_update_failed" }, "zh")).toEqual({
      ok: false,
      message: "订阅没能修改成功，请稍后再试或联系客服。",
    });
    expect(parseSubscriptionChangeResponse(500, {}, "zh")).toEqual({ ok: false, message: "出错了，请重试。" });
  });
});
