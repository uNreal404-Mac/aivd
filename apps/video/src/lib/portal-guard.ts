export type PortalPreflight =
  | { status: 401; error: "unauthorized" }
  | { status: 503; error: "payments_not_configured" | "test_mode_only" };

/**
 * Pure ordering guard for the billing-portal route.
 *
 * Precedence matters: an unauthenticated caller must get 401 even when
 * payments are not configured, so auth is checked before config.
 *
 * Returns `null` when the request may proceed.
 */
export const portalPreflight = (args: {
  authenticated: boolean;
  paymentsConfigured: boolean;
  secretKey: string | undefined | null;
}): PortalPreflight | null => {
  if (!args.authenticated) {
    return { status: 401, error: "unauthorized" };
  }

  if (!args.paymentsConfigured) {
    return { status: 503, error: "payments_not_configured" };
  }

  if (!args.secretKey || !args.secretKey.startsWith("sk_test_")) {
    return { status: 503, error: "test_mode_only" };
  }

  return null;
};
