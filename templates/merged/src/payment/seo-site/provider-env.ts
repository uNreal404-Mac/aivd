/** Shared Stripe credential predicate. `isBillingEnabled` and `arePaymentsOpen` both call this. */
export function hasStripeBillingCredentials(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY
    && process.env.STRIPE_WEBHOOK_SECRET
    && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  );
}
