import { and, asc, desc, eq, gt, gte, isNull, lt, or, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/db';
import { creditTransaction, userCredit } from '@/db/app.schema';
import { CreditTransactionType } from './types';

export interface AddCreditsParams {
  userId: string;
  amount: number;
  type: CreditTransactionType;
  description?: string;
  paymentId?: string;
  expirationDate?: Date;
}

export interface ConsumeCreditsParams {
  userId: string;
  amount: number;
  description?: string;
}

export interface GetUserCreditsResult {
  balance: number;
  totalUsed: number;
  transactions: Array<{
    id: string;
    type: CreditTransactionType;
    amount: number;
    remaining: number | null;
    expirationDate: Date | null;
    createdAt: Date;
    description: string | null;
  }>;
}

/** Ensure the user has a balance row before writing credits. */
export async function ensureUserCredit(userId: string): Promise<void> {
  const db = getDb();

  const existing = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, userId))
    .limit(1);

  if (!existing.length) {
    await db
      .insert(userCredit)
      .values({
        id: nanoid(),
        userId,
        currentCredits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();
  }
}

/** Grant credits and keep the FIFO ledger in sync. */
export async function addCredits(params: AddCreditsParams): Promise<void> {
  const db = getDb();
  const now = new Date();

  await ensureUserCredit(params.userId);

  await db.insert(creditTransaction).values({
    id: nanoid(),
    userId: params.userId,
    type: params.type,
    amount: params.amount,
    remainingAmount: params.amount,
    description: params.description,
    paymentId: params.paymentId,
    expirationDate: params.expirationDate,
    createdAt: now,
  });

  await db
    .update(userCredit)
    .set({
      currentCredits: sql`${userCredit.currentCredits} + ${params.amount}`,
      updatedAt: now,
    })
    .where(eq(userCredit.userId, params.userId));
}

/** Spend credits FIFO across non-expired grants, guarded by an atomic balance decrement. */
export async function consumeCredits(
  params: ConsumeCreditsParams
): Promise<{ success: boolean; usageTransactionId?: string; error?: string }> {
  const db = getDb();
  const now = new Date();

  await ensureUserCredit(params.userId);

  const updateResult = await db
    .update(userCredit)
    .set({
      currentCredits: sql`${userCredit.currentCredits} - ${params.amount}`,
      updatedAt: now,
    })
    .where(
      and(
        eq(userCredit.userId, params.userId),
        gte(userCredit.currentCredits, params.amount)
      )
    )
    .run();

  if (updateResult.meta.changes === 0) {
    return { success: false, error: 'Insufficient credits' };
  }

  const transactions = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, params.userId),
        gt(creditTransaction.remainingAmount, 0),
        or(
          isNull(creditTransaction.expirationDate),
          gt(creditTransaction.expirationDate, now)
        )
      )
    )
    .orderBy(asc(creditTransaction.createdAt));

  const totalAvailable = transactions.reduce(
    (sum, tx) => sum + Math.max(0, tx.remainingAmount ?? 0),
    0
  );

  if (totalAvailable < params.amount) {
    await db
      .update(userCredit)
      .set({
        currentCredits: sql`${userCredit.currentCredits} + ${params.amount}`,
        updatedAt: now,
      })
      .where(eq(userCredit.userId, params.userId));

    return {
      success: false,
      error: 'Credit ledger is inconsistent. Please retry.',
    };
  }

  let remainingToConsume = params.amount;
  for (const tx of transactions) {
    if (remainingToConsume <= 0) break;
    const consumed = Math.min(tx.remainingAmount ?? 0, remainingToConsume);
    remainingToConsume -= consumed;

    await db
      .update(creditTransaction)
      .set({
        remainingAmount: sql`${creditTransaction.remainingAmount} - ${consumed}`,
      })
      .where(eq(creditTransaction.id, tx.id));
  }

  const usageTransactionId = nanoid();
  await db.insert(creditTransaction).values({
    id: usageTransactionId,
    userId: params.userId,
    type: CreditTransactionType.USAGE,
    amount: -params.amount,
    description: params.description,
    createdAt: now,
  });

  return { success: true, usageTransactionId };
}

/** Re-credit a failed generation by reversing one usage transaction. */
export async function refundCredits(
  userId: string,
  usageTransactionId: string,
  reason?: string
): Promise<void> {
  const db = getDb();
  const now = new Date();

  await ensureUserCredit(userId);

  const usageTx = await db
    .select()
    .from(creditTransaction)
    .where(eq(creditTransaction.id, usageTransactionId))
    .limit(1);

  if (
    !usageTx.length ||
    usageTx[0].amount >= 0 ||
    usageTx[0].userId !== userId
  ) {
    throw new Error('Invalid usage transaction for refund');
  }

  const existingRefund = await db
    .select({ id: creditTransaction.id })
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.type, CreditTransactionType.REFUND),
        eq(creditTransaction.relatedTransactionId, usageTransactionId)
      )
    )
    .limit(1);

  if (existingRefund.length > 0) {
    return;
  }

  const refundAmount = Math.abs(usageTx[0].amount);

  await db.insert(creditTransaction).values({
    id: nanoid(),
    userId,
    type: CreditTransactionType.REFUND,
    amount: refundAmount,
    remainingAmount: refundAmount,
    description: reason || 'Generation failed - automatic refund',
    relatedTransactionId: usageTransactionId,
    createdAt: now,
  });

  await db
    .update(userCredit)
    .set({
      currentCredits: sql`${userCredit.currentCredits} + ${refundAmount}`,
      updatedAt: now,
    })
    .where(eq(userCredit.userId, userId));
}

export async function getUserCredits(
  userId: string
): Promise<GetUserCreditsResult> {
  const db = getDb();

  const creditRecord = await db
    .select()
    .from(userCredit)
    .where(eq(userCredit.userId, userId))
    .limit(1);

  const balance = creditRecord[0]?.currentCredits ?? 0;

  const transactions = await db
    .select()
    .from(creditTransaction)
    .where(eq(creditTransaction.userId, userId))
    .orderBy(desc(creditTransaction.createdAt));

  const [usageSummary] = await db
    .select({
      totalUsed: sql<number>`
        coalesce(
          sum(
            case
              when ${creditTransaction.type} = ${CreditTransactionType.USAGE}
                then abs(${creditTransaction.amount})
              when ${creditTransaction.type} = ${CreditTransactionType.REFUND}
                then -abs(${creditTransaction.amount})
              else 0
            end
          ),
          0
        )
      `,
    })
    .from(creditTransaction)
    .where(eq(creditTransaction.userId, userId));

  return {
    balance,
    totalUsed: Math.max(0, Number(usageSummary?.totalUsed ?? 0)),
    transactions: transactions.map((tx) => ({
      id: tx.id,
      type: tx.type as CreditTransactionType,
      amount: tx.amount,
      remaining: tx.remainingAmount,
      expirationDate: tx.expirationDate,
      createdAt: tx.createdAt,
      description: tx.description,
    })),
  };
}

/** Expire leftover subscription credits, then grant the next renewal batch. */
export async function processSubscriptionRenewal(
  userId: string,
  subscriptionPeriodEnd: Date,
  creditsAmount: number
): Promise<void> {
  const db = getDb();
  const now = new Date();

  const oldCredits = await db
    .select()
    .from(creditTransaction)
    .where(
      and(
        eq(creditTransaction.userId, userId),
        eq(creditTransaction.type, CreditTransactionType.SUBSCRIPTION_RENEWAL),
        and(
          isNull(creditTransaction.relatedTransactionId),
          lt(creditTransaction.expirationDate, now)
        )
      )
    );

  for (const expiredCredit of oldCredits) {
    if ((expiredCredit.remainingAmount ?? 0) > 0) {
      const expireAmount = -(expiredCredit.remainingAmount ?? 0);

      await db.insert(creditTransaction).values({
        id: nanoid(),
        userId,
        type: CreditTransactionType.EXPIRE,
        amount: expireAmount,
        relatedTransactionId: expiredCredit.id,
        description: `Expired: ${expiredCredit.description}`,
        createdAt: now,
      });

      await db
        .update(userCredit)
        .set({
          currentCredits: sql`${userCredit.currentCredits} + ${expireAmount}`,
          updatedAt: now,
        })
        .where(eq(userCredit.userId, userId));
    }
  }

  await addCredits({
    userId,
    amount: creditsAmount,
    type: CreditTransactionType.SUBSCRIPTION_RENEWAL,
    expirationDate: subscriptionPeriodEnd,
  });
}
