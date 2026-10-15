/**
 * Merged auth facade.
 * Primary implementation reference: ./mkfast (better-auth)
 * RBAC helpers reference: ./shipany
 *
 * This file is the stable import surface for consumers of templates/merged.
 * Wire `createAuth` to your runtime env when promoting to a full app.
 */

export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  emailVerified?: boolean;
};

export type AuthSession = {
  user: AuthUser;
  sessionId: string;
  expiresAt?: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

export type SignUpInput = {
  email: string;
  password: string;
  name?: string;
};

/** Feature flags for which auth paths are enabled in the fused template. */
export const authFeatures = {
  emailPassword: true,
  googleOAuth: true,
  magicLink: false,
  passkey: false,
  inviteCodes: true, // from shipany
  rbac: true, // from shipany
} as const;

/**
 * Placeholder session helper — replace with better-auth client/server calls.
 * See ./mkfast/auth.ts and ./shipany/index.ts for full implementations.
 */
export async function getSessionPlaceholder(): Promise<AuthSession | null> {
  return null;
}

export function requireAuthPlaceholder(session: AuthSession | null): AuthSession {
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}
