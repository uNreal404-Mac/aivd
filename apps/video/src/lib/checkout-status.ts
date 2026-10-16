/**
 * Pure helpers shared by the checkout success page and the read-only
 * checkout status API route. No network access, no database access.
 */

/**
 * Stripe Checkout Session ids look like `cs_test_<random>` / `cs_live_<random>`.
 * Kept intentionally strict to avoid passing user input through to queries.
 */
export const SESSION_ID_PATTERN = /^cs_(test|live)_[A-Za-z0-9]{10,200}$/;

export function isValidSessionId(v: unknown): v is string {
  return typeof v === "string" && SESSION_ID_PATTERN.test(v);
}

/**
 * Order number for a checkout session.
 *
 * MUST match the orderNo used by `stripe-webhook.ts` for
 * `checkout.session.completed` so the credited row can be looked up here.
 */
export function orderNoForSession(sessionId: string): string {
  return `stripe_${sessionId}`;
}

/**
 * Subscription state derived from stored records. `active` is only true when
 * we have a subscription id whose stored period end is still in the future.
 */
export type SubscriptionInfo = {
  active: boolean;
  currentPeriodEnd: string | null;
};

export type CheckoutStatus =
  | {
      status: "paid";
      credits: number;
      subscription?: SubscriptionInfo;
    }
  | { status: "pending"; subscription?: SubscriptionInfo };

/**
 * Map a credit row (if any) to the client-facing status.
 * A missing row simply means the webhook has not (yet) granted credits.
 */
export function toCheckoutStatus(
  row: { initialCredits: number } | undefined | null
): CheckoutStatus {
  if (row && typeof row.initialCredits === "number") {
    return { status: "paid", credits: row.initialCredits };
  }
  return { status: "pending" };
}

/**
 * Map a customer row (if any) to the client-facing subscription status.
 * Pure: `active` requires both a non-empty id and a valid period end that is
 * strictly after `now`. `currentPeriodEnd` is an ISO string or null.
 */
export function toSubscriptionInfo(
  row:
    | {
        stripeSubscriptionId: string | null;
        stripeCurrentPeriodEnd: Date | null;
      }
    | undefined
    | null,
  now: Date
): SubscriptionInfo {
  const id = row?.stripeSubscriptionId ?? null;
  const rawPeriodEnd = row?.stripeCurrentPeriodEnd ?? null;
  const periodEnd =
    rawPeriodEnd instanceof Date && !Number.isNaN(rawPeriodEnd.getTime())
      ? rawPeriodEnd
      : null;

  const hasId = typeof id === "string" && id.length > 0;
  const active = hasId && periodEnd !== null && periodEnd.getTime() > now.getTime();

  return {
    active,
    currentPeriodEnd: periodEnd ? periodEnd.toISOString() : null,
  };
}

export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 60000;

export function shouldKeepPolling(
  status: CheckoutStatus,
  elapsedMs: number
): boolean {
  return status.status === "pending" && elapsedMs < POLL_TIMEOUT_MS;
}
