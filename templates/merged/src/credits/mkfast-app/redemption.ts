import { and, eq, lt, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '@/db';
import { redemptionCode, redemptionRecord } from '@/db/app.schema';
import { addCredits } from './credits';
import { CreditTransactionType } from './types';

export interface CreateRedemptionCodeParams {
  code: string;
  creditsAmount: number;
  /** null = unlimited */
  maxRedemptions?: number;
  /** Default 1 */
  perUserLimit?: number;
  expiresAt?: Date;
  /** Override expiration of granted credits (otherwise permanent). */
  creditExpiresAt?: Date;
  /** When set, only this user can redeem (admin one-off). */
  boundUserId?: string;
  note?: string;
  /** Admin actor id. */
  createdBy: string;
}

export interface RedeemCodeResult {
  success: boolean;
  creditsGranted?: number;
  error?: string;
  reason?: string;
}

export function generateRedemptionCode(length: number = 8): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function createRedemptionCode(
  params: CreateRedemptionCodeParams
): Promise<string> {
  const db = getDb();
  const now = new Date();
  const codeId = nanoid();

  await db.insert(redemptionCode).values({
    id: codeId,
    code: params.code,
    creditsAmount: params.creditsAmount,
    maxRedemptions: params.maxRedemptions ?? null,
    redemptionsCount: 0,
    perUserLimit: params.perUserLimit ?? 1,
    expiresAt: params.expiresAt ?? null,
    creditExpiresAt: params.creditExpiresAt ?? null,
    boundUserId: params.boundUserId ?? null,
    note: params.note,
    createdBy: params.createdBy,
    disabled: false,
    createdAt: now,
    updatedAt: now,
  });

  return codeId;
}

/** Validate a code, enforce caps/binding, then grant and record credits. */
export async function redeemCode(
  userId: string,
  codeInput: string
): Promise<RedeemCodeResult> {
  const db = getDb();
  const now = new Date();
  const normalizedCode = codeInput.toUpperCase().trim();

  const codes = await db
    .select()
    .from(redemptionCode)
    .where(eq(redemptionCode.code, normalizedCode))
    .limit(1);

  if (!codes.length) {
    return { success: false, error: 'Code not found', reason: 'invalid_code' };
  }

  const code = codes[0];

  if (code.disabled) {
    return {
      success: false,
      error: 'Code is disabled',
      reason: 'code_disabled',
    };
  }

  if (code.expiresAt && code.expiresAt < now) {
    return {
      success: false,
      error: 'Code has expired',
      reason: 'code_expired',
    };
  }

  if (code.boundUserId && code.boundUserId !== userId) {
    return {
      success: false,
      error: 'This code is not for you',
      reason: 'user_mismatch',
    };
  }

  if (code.maxRedemptions && code.redemptionsCount >= code.maxRedemptions) {
    return {
      success: false,
      error: 'Code has reached max redemptions',
      reason: 'max_redeemed',
    };
  }

  const userRedemptions = await db
    .select()
    .from(redemptionRecord)
    .where(
      and(
        eq(redemptionRecord.codeId, code.id),
        eq(redemptionRecord.userId, userId)
      )
    );

  if (userRedemptions.length >= code.perUserLimit) {
    return {
      success: false,
      error: 'You have reached the limit for this code',
      reason: 'per_user_limit_reached',
    };
  }

  try {
    const updateResult = await db
      .update(redemptionCode)
      .set({
        redemptionsCount: sql`${redemptionCode.redemptionsCount} + 1`,
        updatedAt: now,
      })
      .where(
        code.maxRedemptions
          ? and(
              eq(redemptionCode.id, code.id),
              lt(redemptionCode.redemptionsCount, code.maxRedemptions)
            )
          : eq(redemptionCode.id, code.id)
      )
      .run();

    if (updateResult.meta.changes === 0) {
      return {
        success: false,
        error: 'Code has been exhausted',
        reason: 'max_redeemed',
      };
    }

    const creditTransactionId = nanoid();
    await addCredits({
      userId,
      amount: code.creditsAmount,
      type: CreditTransactionType.REDEMPTION_CODE,
      description: `Redeemed code: ${code.code}`,
      expirationDate: code.creditExpiresAt ?? undefined,
    });

    await db.insert(redemptionRecord).values({
      id: nanoid(),
      codeId: code.id,
      userId,
      creditsGranted: code.creditsAmount,
      creditTransactionId,
      createdAt: now,
    });

    return { success: true, creditsGranted: code.creditsAmount };
  } catch (error) {
    return { success: false, error: String(error), reason: 'unknown_error' };
  }
}

export async function getRedemptionCode(codeId: string) {
  const db = getDb();

  const code = await db
    .select()
    .from(redemptionCode)
    .where(eq(redemptionCode.id, codeId))
    .limit(1);

  if (!code.length) return null;

  const records = await db
    .select()
    .from(redemptionRecord)
    .where(eq(redemptionRecord.codeId, codeId));

  return {
    ...code[0],
    redemptions: records,
  };
}

/** Disable a code so future redemption attempts fail. */
export async function disableRedemptionCode(codeId: string): Promise<void> {
  const db = getDb();

  await db
    .update(redemptionCode)
    .set({
      disabled: true,
      updatedAt: new Date(),
    })
    .where(eq(redemptionCode.id, codeId));
}
