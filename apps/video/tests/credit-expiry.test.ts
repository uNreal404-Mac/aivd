import { describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";

import { CreditPackageStatus, CreditTransType, creditPackages, creditTransactions, db } from "@/db";
import { creditService, expiryOrderNo } from "@/services/credit";
import { getBalance, giveCredits, uniqueUserId } from "./helpers";

const DAY = 24 * 60 * 60 * 1000;

async function expiryRows(userId: string) {
  return db
    .select()
    .from(creditTransactions)
    .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.transType, CreditTransType.EXPIRED)));
}

async function packageRow(id: number) {
  const [row] = await db.select().from(creditPackages).where(eq(creditPackages.id, id)).limit(1);
  return row;
}

describe("credit expiry ledger", () => {
  it("records one expiry entry per expired package and marks it expired", async () => {
    const userId = uniqueUserId("expiry");
    const { packageId: expired } = await giveCredits(userId, 300, -1);
    await giveCredits(userId, 200, 30);

    const recorded = await creditService.recordExpiries(userId);
    expect(recorded).toBe(1);

    const rows = await expiryRows(userId);
    expect(rows).toHaveLength(1);
    expect(rows[0].credits).toBe(-300);
    expect(rows[0].packageId).toBe(expired);
    expect(rows[0].orderNo).toBe(expiryOrderNo(expired));

    const pkg = await packageRow(expired);
    expect(pkg.status).toBe(CreditPackageStatus.EXPIRED);
    // Dated when the credits expired, not when the entry was written.
    expect(Math.abs(rows[0].createdAt.getTime() - (pkg.expiredAt?.getTime() ?? 0))).toBeLessThan(2000);

    // The live balance never counted the expired package, so it is unchanged.
    expect((await getBalance(userId)).availableCredits).toBe(200);
    expect(rows[0].balanceAfter).toBe(200);
  });

  it("is idempotent", async () => {
    const userId = uniqueUserId("expiry-twice");
    await giveCredits(userId, 50, -1);

    expect(await creditService.recordExpiries(userId)).toBe(1);
    expect(await creditService.recordExpiries(userId)).toBe(0);
    expect(await expiryRows(userId)).toHaveLength(1);
  });

  it("chains the balance from the ledger for packages that expired one after another", async () => {
    const userId = uniqueUserId("expiry-chain");
    const first = await giveCredits(userId, 280, -2);
    const second = await giveCredits(userId, 218, -1);
    // A ledger entry from before both expiries, showing 778 at that time.
    await db.insert(creditTransactions).values({
      transNo: `TXN${Date.now()}${nanoid(6)}`,
      userId,
      transType: CreditTransType.VIDEO_CONSUME,
      credits: -16,
      balanceAfter: 778,
      createdAt: new Date(Date.now() - 10 * DAY),
    });
    // Make the recharge entries older than the expiries too, as they would be.
    await db
      .update(creditTransactions)
      .set({ createdAt: new Date(Date.now() - 20 * DAY) })
      .where(and(eq(creditTransactions.userId, userId), eq(creditTransactions.transType, CreditTransType.ORDER_PAY)));

    expect(await creditService.recordExpiries(userId)).toBe(2);

    const rows = (await expiryRows(userId)).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    expect(rows.map((row) => row.packageId)).toEqual([first.packageId, second.packageId]);
    expect(rows.map((row) => row.balanceAfter)).toEqual([778 - 280, 778 - 280 - 218]);
  });

  it("leaves packages with credits held for a running job until the hold settles", async () => {
    const userId = uniqueUserId("expiry-frozen");
    const { packageId } = await giveCredits(userId, 100, -1);
    await db.update(creditPackages).set({ frozenCredits: 40, remainingCredits: 60 }).where(eq(creditPackages.id, packageId));

    expect(await creditService.recordExpiries(userId)).toBe(0);
    expect((await packageRow(packageId)).status).toBe(CreditPackageStatus.ACTIVE);
  });

  it("only touches the given user", async () => {
    const mine = uniqueUserId("expiry-mine");
    const theirs = uniqueUserId("expiry-theirs");
    await giveCredits(mine, 10, -1);
    const { packageId } = await giveCredits(theirs, 10, -1);

    await creditService.recordExpiries(mine);
    expect((await packageRow(packageId)).status).toBe(CreditPackageStatus.ACTIVE);
    expect(await expiryRows(theirs)).toHaveLength(0);
  });
});
