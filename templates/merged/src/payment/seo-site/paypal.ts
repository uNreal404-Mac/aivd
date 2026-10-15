import "server-only";

import { arePaymentsOpen } from "./payments-open";
import {
  PAYMENT_PROVIDERS,
  PaymentNotConfiguredError,
  type CheckoutRequest,
  type PaymentAdapter,
} from "./types";

export const paypalPaymentAdapter: PaymentAdapter = {
  id: PAYMENT_PROVIDERS.PAYPAL,
  isConfigured() {
    return arePaymentsOpen({ provider: PAYMENT_PROVIDERS.PAYPAL });
  },
  async createCheckout(__request: CheckoutRequest) {
    throw new PaymentNotConfiguredError(PAYMENT_PROVIDERS.PAYPAL);
  },
};
