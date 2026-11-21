import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { isPaymentsConfigured } from "@/lib/payments";
import {
  createStripeClient,
  getUsableStripeKey,
} from "@/payment/stripe-checkout";
import {
  isEnded,
  loadOwnSubscription,
  recordStripeSubscriber,
  subscriberRecordOf,
  subscriptionViewOf,
} from "@/payment/stripe-customer";

export const dynamic = "force-dynamic";

/**
 * Cancel at period end, or undo that, from the account page.
 *
 * Body: `{ "action": "cancel" | "resume" }`. Cancelling never ends the paid
 * period early and never refunds: Stripe stops renewing at the period end,
 * which is what the terms promise. The result is written to the Customer row
 * straight away, so the page does not wait for the webhook.
 */
export const POST = async (req: NextRequest) => {
  if (!isPaymentsConfigured()) {
    return NextResponse.json({ error: "payments_not_configured" }, { status: 503 });
  }
  const keyResult = getUsableStripeKey();
  if (!keyResult.ok) {
    return NextResponse.json({ error: keyResult.error }, { status: 503 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const action =
    body && typeof body === "object" ? (body as { action?: unknown }).action : undefined;
  if (action !== "cancel" && action !== "resume") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const stripe = createStripeClient(keyResult.key);

  try {
    const subscription = await loadOwnSubscription(stripe, user.id);
    if (!subscription || isEnded(subscription)) {
      return NextResponse.json({ error: "no_subscription" }, { status: 404 });
    }

    // Stripe takes one of the two cancel fields per request. A dated cancel
    // (set in the Stripe dashboard, no period-end flag) is undone by
    // clearing cancel_at.
    const params =
      action === "cancel"
        ? { cancel_at_period_end: true }
        : !subscription.cancel_at_period_end && subscription.cancel_at
          ? { cancel_at: "" as const }
          : { cancel_at_period_end: false };
    const updated = await stripe.subscriptions.update(subscription.id, params);

    const record = subscriberRecordOf(updated);
    if (record) await recordStripeSubscriber(record);

    const view = subscriptionViewOf(updated);
    return NextResponse.json({
      state: view.state,
      date: view.state === "ended" ? null : (view.date?.toISOString() ?? null),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[stripe] subscription ${action} failed: ${message}`);
    return NextResponse.json({ error: "subscription_update_failed" }, { status: 502 });
  }
};
