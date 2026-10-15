import type { PricingPlan } from "@/lib/site-types";

export const PAYMENT_PROVIDERS = {
  STRIPE: "stripe",
  CREEM: "creem",
  PAYPAL: "paypal",
} as const;

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[keyof typeof PAYMENT_PROVIDERS];

export interface CheckoutRequest {
  userId: string;
  plan: PricingPlan;
  successUrl: string;
  cancelUrl: string;
  currency: string;
}

export interface CheckoutSession {
  id: string;
  url: string;
  provider: PaymentProvider;
}

export class PaymentNotConfiguredError extends Error {
  constructor(provider: PaymentProvider) {
    super(`${provider} is not configured`);
    this.name = "PaymentNotConfiguredError";
  }
}

export interface PaymentAdapter {
  readonly id: PaymentProvider;
  isConfigured(): boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
}

export function resolvePaymentProvider({
  value,
}: {
  value: string | undefined;
}): PaymentProvider {
  if (value === PAYMENT_PROVIDERS.CREEM || value === PAYMENT_PROVIDERS.PAYPAL) {
    return value;
  }

  return PAYMENT_PROVIDERS.STRIPE;
}
