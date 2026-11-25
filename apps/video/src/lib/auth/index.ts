// Server-only exports - these should only be imported in server components
// For client components, import from "@/lib/auth/client" instead

import { cache } from "react";
import { hasDbBinding } from "@/db";
import type { User } from "./auth";
import { getLoginRedirectURL } from "./redirect";
import { getRequestCallbackURL } from "./server-redirect";

// Re-export auth instance (server-only)
export { auth, type Session, type User } from "./auth";

/**
 * Get current session on the server side (deduplicated per request).
 * Must be called from App Router (uses next/headers)
 */
export const getServerSession = cache(async () => {
  if (!hasDbBinding()) {
    return null;
  }
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";
  if (!cookie.includes("session_token") && !requestHeaders.get("authorization")) {
    return null;
  }
  const { auth } = await import("./auth");
  return auth.api.getSession({
    headers: requestHeaders,
  });
});

/**
 * Get current user session on the server side (RSC / Server Actions)
 * Must be called from App Router (uses next/headers)
 * @see https://www.better-auth.com/docs/integrations/next
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getServerSession();
  return (session?.user as User) ?? null;
}

/**
 * Server-side auth guard - redirects if not logged in
 * Must be called from App Router
 */
export async function requireAuth(redirectTo = "/login"): Promise<User> {
  const { redirect } = await import("next/navigation");
  const user = await getCurrentUser();
  if (!user) {
    redirect(getLoginRedirectURL(redirectTo, await getRequestCallbackURL()));
  }
  return user as User;
}

/**
 * Server-side admin guard - redirects if not admin
 * Must be called from App Router
 */
export async function requireAdmin(redirectTo = "/"): Promise<User> {
  const { redirect } = await import("next/navigation");
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    redirect(redirectTo);
  }
  return user as User;
}
