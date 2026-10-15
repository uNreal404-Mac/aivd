import { describe, expect, test } from "vitest";

import { PAYMENT_PROVIDERS } from "./types";
import { arePaymentsOpen, pricingCheckoutCtaKey } from "./payments-open";

describe("arePaymentsOpen", () => {
  test("requires Stripe credentials and the site hook for the default provider", () => {
    expect(arePaymentsOpen({
      provider: PAYMENT_PROVIDERS.STRIPE,
      stripeConfigured: true,
      stripeHookEnabled: true,
    })).toBe(true);

    expect(arePaymentsOpen({
      provider: PAYMENT_PROVIDERS.STRIPE,
      stripeConfigured: false,
      stripeHookEnabled: true,
    })).toBe(false);

    expect(arePaymentsOpen({
      provider: PAYMENT_PROVIDERS.STRIPE,
      stripeConfigured: true,
      stripeHookEnabled: false,
    })).toBe(false);
  });

  test("follows the resolved provider's own credentials", () => {
    expect(arePaymentsOpen({
      provider: PAYMENT_PROVIDERS.CREEM,
      creemConfigured: true,
    })).toBe(true);

    expect(arePaymentsOpen({
      provider: PAYMENT_PROVIDERS.PAYPAL,
      paypalConfigured: false,
    })).toBe(false);
  });
});

describe("pricingCheckoutCtaKey", () => {
  test("never says buy when payments are closed", () => {
    expect(pricingCheckoutCtaKey({ paymentsOpen: false })).toBe("paymentsNotOpen");
    expect(pricingCheckoutCtaKey({ paymentsOpen: true })).toBe("buy");
  });
});
