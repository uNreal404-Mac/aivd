import { db, users } from "@/db";
import { eq } from "drizzle-orm";

/** The preview's internal account is the only exception to its disabled generator. */
export function canGenerateInPreview(user: { isAdmin?: boolean | null; isSuperAccount?: boolean | null }): boolean {
  return process.env.VIDEO_GENERATION_ENABLED === "true" ||
    (process.env.NEXT_PUBLIC_IS_PREVIEW === "true" && user.isAdmin === true && user.isSuperAccount === true);
}

/** Always read privileges from the database before waiving a charge. */
export async function isFreeInternalAccount(userId: string): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_IS_PREVIEW !== "true") return false;
  const [user] = await db
    .select({ isAdmin: users.isAdmin, isSuperAccount: users.isSuperAccount })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user?.isAdmin === true && user.isSuperAccount === true;
}
