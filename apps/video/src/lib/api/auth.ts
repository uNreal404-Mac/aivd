import { auth, type User } from "@/lib/auth";
import { db, users } from "@/db";
import { eq } from "drizzle-orm";
import {
  getAdminPanelPrincipal,
  type AdminPrincipal,
} from "@/lib/admin/session";

import { ApiError } from "./error";

/**
 * Get authenticated user from request headers
 * Returns null if not authenticated
 */
export async function getAuthUser(request: Request): Promise<User | null> {
  const session = await auth.api.getSession({
    headers: request.headers,
  });

  if (!session?.user) {
    return null;
  }

  const [accountState] = await db
    .select({ isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);
  if (!accountState || accountState.isBanned) return null;

  return session.user as User;
}

/**
 * Require authentication - throws ApiError if not authenticated
 */
export async function requireAuth(request: Request): Promise<User> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new ApiError("Unauthorized", 401);
  }
  return user;
}

/**
 * Require admin role - throws ApiError if not admin
 */
export async function requireAdmin(
  request: Request,
): Promise<User | AdminPrincipal> {
  const panelAdmin = await getAdminPanelPrincipal(request.headers);
  if (panelAdmin) return panelAdmin;

  const user = await requireAuth(request);
  if (!user.isAdmin) {
    throw new ApiError("Forbidden", 403);
  }
  return user;
}
