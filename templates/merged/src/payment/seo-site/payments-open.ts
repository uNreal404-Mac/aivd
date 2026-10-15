import { isStripePaymentsEnabled } from "@/lib/site";

import { hasStripeBillingCredentials } from "./provider-env";
import { PAYMENT_PROVIDERS, type PaymentProvider, resolvePaymentProvider } from "./types";

export function pricingCheckoutCtaKey({
  paymentsOpen,
}: {
  paymentsOpen: boolean;
}): "buy" | "paymentsNotOpen" {
  return paymentsOpen ? "buy" : "paymentsNotOpen";
}

/**
 * Whether customers can start a checkout. One flag for env, site.config, and the resolved
 * provider — pricing UI, checkout, and adapters all read this.
 */
export function arePaymentsOpen({
  provider = resolvePaymentProvider({ value: process.env.PAYMENT_PROVIDER }),
  stripeConfigured = hasStripeBillingCredentials(),
  stripeHookEnabled = isStripePaymentsEnabled(),
  creemConfigured = Boolean(process.env.CREEM_API_KEY),
  paypalConfigured = Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET),
}: {
  provider?: PaymentProvider;
  stripeConfigured?: boolean;
  stripeHookEnabled?: boolean;
  creemConfigured?: boolean;
  paypalConfigured?: boolean;
} = {}): boolean {
  if (provider === PAYMENT_PROVIDERS.CREEM) {
    return creemConfigured;
  }

  if (provider === PAYMENT_PROVIDERS.PAYPAL) {
    return paypalConfigured;
  }

  return stripeConfigured && stripeHookEnabled;
}
