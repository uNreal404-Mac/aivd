import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, creditHolds, creditTransactions, videos } from "@/db";
import { creditService } from "@/services/credit";

export function uniqueUserId(prefix = "test_user"): string {
  return `${prefix}_${nanoid(16)}`;
}

export function uniqueOrderNo(prefix = "order"): string {
  return `${prefix}_${nanoid(16)}`;
}

export async function giveCredits(
  userId: string,
  credits: number,
  expiryDays = 30
): Promise<{ packageId: number }> {
  return creditService.recharge({
    userId,
    credits,
    orderNo: uniqueOrderNo(),
    expiryDays,
  });
}

export async function getBalance(userId: string) {
  return creditService.getBalance(userId);
}

export async function getVideoRow(videoUuid: string) {
  const [row] = await db
    .select()
    .from(videos)
    .where(eq(videos.uuid, videoUuid))
    .limit(1);
  return row ?? null;
}

export async function getHoldRow(videoUuid: string) {
  const [row] = await db
    .select()
    .from(creditHolds)
    .where(eq(creditHolds.videoUuid, videoUuid))
    .limit(1);
  return row ?? null;
}

export async function countTransactions(
  videoUuid: string,
  transType: string
): Promise<number> {
  const rows = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.videoUuid, videoUuid));
  return rows.filter((r) => r.transType === transType).length;
}

export async function countHoldsForUser(userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(creditHolds)
    .where(eq(creditHolds.userId, userId));
  return rows.length;
}
