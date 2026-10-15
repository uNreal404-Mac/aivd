import "server-only";

import { arePaymentsOpen } from "./payments-open";
import {
  PAYMENT_PROVIDERS,
  PaymentNotConfiguredError,
  type CheckoutRequest,
  type PaymentAdapter,
} from "./types";

export const creemPaymentAdapter: PaymentAdapter = {
  id: PAYMENT_PROVIDERS.CREEM,
  isConfigured() {
    return arePaymentsOpen({ provider: PAYMENT_PROVIDERS.CREEM });
  },
  async createCheckout(__request: CheckoutRequest) {
    throw new PaymentNotConfiguredError(PAYMENT_PROVIDERS.CREEM);
  },
};
