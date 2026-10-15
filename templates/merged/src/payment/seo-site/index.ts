import "server-only";

import { creemPaymentAdapter } from "./creem";
import { paypalPaymentAdapter } from "./paypal";
import { stripePaymentAdapter } from "./stripe";
import {
  PAYMENT_PROVIDERS,
  type PaymentAdapter,
  type PaymentProvider,
  resolvePaymentProvider,
} from "./types";

const adapters: Record<PaymentProvider, PaymentAdapter> = {
  [PAYMENT_PROVIDERS.STRIPE]: stripePaymentAdapter,
  [PAYMENT_PROVIDERS.CREEM]: creemPaymentAdapter,
  [PAYMENT_PROVIDERS.PAYPAL]: paypalPaymentAdapter,
};

export function getPaymentAdapter({
  provider = resolvePaymentProvider({ value: process.env.PAYMENT_PROVIDER }),
}: {
  provider?: PaymentProvider;
} = {}): PaymentAdapter {
  return adapters[provider];
}

export { PaymentNotConfiguredError } from "./types";
