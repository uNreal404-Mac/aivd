import { describe, expect, it, vi } from "vitest";

import { startStripeCheckout } from "@/lib/stripe-checkout-client";

function jsonResponse(body: unknown, init: { ok?: boolean } = {}) {
  return {
    ok: init.ok ?? true,
    json: async () => body,
  } as unknown as Response;
}

describe("startStripeCheckout", () => {
  it("sends the generator return path to checkout", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({ url: "https://checkout.stripe.com/c/pay_123" })) as unknown as typeof fetch;
    await startStripeCheckout("pack-small", { fetchFn, redirect: vi.fn(), returnTo: "/zh/ai/image" });
    const [, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ productId: "pack-small", returnTo: "/zh/ai/image" });
  });

  it("redirects to the returned URL with a well-formed request", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ url: "https://checkout.stripe.com/c/pay_123" })
    ) as unknown as typeof fetch;
    const redirect = vi.fn();

    const result = await startStripeCheckout("pack-small", {
      fetchFn,
      redirect,
    });

    expect(result).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/c/pay_123",
    });
    expect(redirect).toHaveBeenCalledWith(
      "https://checkout.stripe.com/c/pay_123"
    );

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("/api/payments/checkout");
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({
      productId: "pack-small",
    });
  });

  it("returns the server error for a non-ok response", async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse({ error: "bad_product" }, { ok: false })
    ) as unknown as typeof fetch;
    const redirect = vi.fn();

    const result = await startStripeCheckout("pack-small", {
      fetchFn,
      redirect,
    });

    expect(result).toEqual({ ok: false, error: "bad_product" });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("falls back to a generic error for a non-ok response without a body", async () => {
    const fetchFn = vi.fn(async () => ({
      ok: false,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    const redirect = vi.fn();

    const result = await startStripeCheckout("pack-small", {
      fetchFn,
      redirect,
    });

    expect(result).toEqual({
      ok: false,
      error: "Failed to create checkout session.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns an error when the response has no url", async () => {
    const fetchFn = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch;
    const redirect = vi.fn();

    const result = await startStripeCheckout("pack-small", {
      fetchFn,
      redirect,
    });

    expect(result).toEqual({ ok: false, error: "Missing checkout URL." });
    expect(redirect).not.toHaveBeenCalled();
  });
});
