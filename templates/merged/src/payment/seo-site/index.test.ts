import { describe, expect, test } from "vitest";

import { PAYMENT_PROVIDERS, resolvePaymentProvider } from "./types";

describe("resolvePaymentProvider", () => {
  test("defaults to Stripe", () => {
    expect(resolvePaymentProvider({ value: undefined })).toBe(PAYMENT_PROVIDERS.STRIPE);
    expect(resolvePaymentProvider({ value: "unknown" })).toBe(PAYMENT_PROVIDERS.STRIPE);
  });

  test("accepts stubbed adapters by name", () => {
    expect(resolvePaymentProvider({ value: "creem" })).toBe(PAYMENT_PROVIDERS.CREEM);
    expect(resolvePaymentProvider({ value: "paypal" })).toBe(PAYMENT_PROVIDERS.PAYPAL);
  });
});
