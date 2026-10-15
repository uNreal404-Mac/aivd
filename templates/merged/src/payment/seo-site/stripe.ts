import "server-only";

import { SITE_NAME } from "@/constants";
import { getStripe } from "@/lib/stripe";

import { arePaymentsOpen } from "./payments-open";

import {
  PAYMENT_PROVIDERS,
  PaymentNotConfiguredError,
  type CheckoutRequest,
  type CheckoutSession,
  type PaymentAdapter,
} from "./types";

export const stripePaymentAdapter: PaymentAdapter = {
  id: PAYMENT_PROVIDERS.STRIPE,
  isConfigured() {
    return arePaymentsOpen({ provider: PAYMENT_PROVIDERS.STRIPE });
  },
  async createCheckout(request: CheckoutRequest): Promise<CheckoutSession> {
    if (!this.isConfigured()) {
      throw new PaymentNotConfiguredError(PAYMENT_PROVIDERS.STRIPE);
    }

    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: request.userId,
      success_url: request.successUrl,
      cancel_url: request.cancelUrl,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: request.currency,
            unit_amount: request.plan.price,
            product_data: {
              name: `${request.plan.name} — ${request.plan.credits} credits`,
              description: request.plan.description,
            },
          },
        },
      ],
      metadata: {
        kind: "credits",
        planId: request.plan.id,
        userId: request.userId,
        credits: String(request.plan.credits),
        site: SITE_NAME,
      },
      payment_intent_data: {
        metadata: {
          kind: "credits",
          planId: request.plan.id,
          userId: request.userId,
          credits: String(request.plan.credits),
        },
      },
    });

    if (!session.url) {
      throw new Error("Stripe checkout session did not return a URL");
    }

    return {
      id: session.id,
      url: session.url,
      provider: PAYMENT_PROVIDERS.STRIPE,
    };
  },
};
