/**
 * Merged payment facade.
 * Provider interface + Stripe/Creem/Waffo: ./mkfast
 * Extra adapters (PayPal/Alipay/WeChat): ./shipany
 * Team billing / payment-return: ./seo-site
 */

export type PaymentProviderId = "stripe" | "creem" | "waffo" | "paypal" | "alipay" | "wechat";

export type CheckoutInput = {
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  mode?: "payment" | "subscription";
  metadata?: Record<string, string>;
};

export type CheckoutResult = {
  provider: PaymentProviderId;
  checkoutUrl: string;
  sessionId?: string;
};

export const paymentFeatures = {
  stripe: true,
  creem: true,
  waffo: true,
  paypal: true,
  alipay: false, // optional shipany adapter
  wechat: false, // optional shipany adapter
  customerPortal: true,
  webhooks: true,
} as const;

export function resolvePaymentProvider(
  raw: string | undefined = process.env.VITE_PAYMENT_PROVIDER,
): PaymentProviderId {
  const v = (raw || "stripe").toLowerCase();
  if (v === "creem" || v === "waffo" || v === "paypal" || v === "alipay" || v === "wechat") {
    return v;
  }
  return "stripe";
}

export async function createCheckoutPlaceholder(
  input: CheckoutInput,
  provider: PaymentProviderId = resolvePaymentProvider(),
): Promise<CheckoutResult> {
  return {
    provider,
    checkoutUrl: `${input.successUrl}?placeholder=1`,
    sessionId: "placeholder-session",
  };
}
