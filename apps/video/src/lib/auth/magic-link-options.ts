/**
 * Shared magic-link plugin options.
 *
 * `storeToken: "hashed"` makes Better Auth hash the token before it builds
 * the verification identifier, so the `verification` table never holds a
 * usable plain-text magic-link token. The link sent by email is unchanged.
 * https://www.better-auth.com/docs/plugins/magic-link
 */
export const MAGIC_LINK_OPTIONS = {
  expiresIn: 300, // 5 minutes
  storeToken: "hashed",
} as const;
