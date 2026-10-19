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
 * Test-mode sessions never charge real money; the UI surfaces a notice.
 * Purely prefix-based (session may not be validated yet by the caller).
 */
export function isTestModeSession(sessionId: string): boolean {
  return sessionId.startsWith("cs_test_");
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

export type CheckoutStatus =
  | { status: "paid"; credits: number }
  | { status: "pending" };

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

export const POLL_INTERVAL_MS = 2000;
export const POLL_TIMEOUT_MS = 60000;

export function shouldKeepPolling(
  status: CheckoutStatus,
  elapsedMs: number
): boolean {
  return status.status === "pending" && elapsedMs < POLL_TIMEOUT_MS;
}

export type CheckoutFetchOutcome = "unauthorized" | "failed";

/** 401/403 mean "not signed in" (or no access) rather than a transient error. */
export function classifyStatusResponse(status: number): CheckoutFetchOutcome {
  return status === 401 || status === 403 ? "unauthorized" : "failed";
}
