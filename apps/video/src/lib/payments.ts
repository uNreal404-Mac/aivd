/**
 * Determines whether the payment integration is fully configured.
 *
 * Both conditions must hold:
 * - `CREEM_API_KEY` is a non-empty (trimmed) string.
 * - `NEXT_PUBLIC_PAYMENTS_ENABLED` is exactly `"true"`.
 *
 * Values are read with bracket access so bundlers do not inline them at
 * build time and the decision can be made per-environment at runtime.
 */
const CREEM_API_KEY_VAR = "CREEM_API_KEY";
const PAYMENTS_FLAG_VAR = "NEXT_PUBLIC_PAYMENTS_ENABLED";

export function isPaymentsConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  const apiKey = env[CREEM_API_KEY_VAR];
  const enabledFlag = env[PAYMENTS_FLAG_VAR];

  const hasApiKey = typeof apiKey === "string" && apiKey.trim().length > 0;

  return hasApiKey && enabledFlag === "true";
}
