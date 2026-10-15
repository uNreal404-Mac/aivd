import "server-only";

import { getDB } from "@/db";
import { getSignupBonus, isCreditsEnabled } from "@/lib/site";
import { createRandomId } from "@/utils/random-token";

import {
  CREDIT_LEDGER_TYPES,
  CREDIT_PROVIDERS,
  CreditInsufficientError,
  type CreditMutationInput,
  type CreditMutationResult,
  nextCreditBalance,
  signedLedgerAmount,
} from "./types";

function unixSeconds(date = new Date()) {
  return Math.floor(date.getTime() / 1000);
}

function requiresAvailableBalance(type: CreditMutationInput["type"]) {
  return type === CREDIT_LEDGER_TYPES.DEDUCT;
}

async function applyCreditMutation(input: CreditMutationInput): Promise<CreditMutationResult> {
  nextCreditBalance({
    balance: requiresAvailableBalance(input.type) ? input.amount : 0,
    amount: input.amount,
    type: input.type,
  });

  const db = getDB();
  const d1 = db.$client;
  const now = unixSeconds();
  const accountId = `cacc_${createRandomId()}`;
  const ledgerId = `cled_${createRandomId()}`;
  const signed = signedLedgerAmount({ amount: input.amount, type: input.type });
  const provider = input.provider ?? CREDIT_PROVIDERS.SYSTEM;
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;
  const requireFunds = requiresAvailableBalance(input.type) ? 1 : 0;

  await d1.batch([
    d1.prepare(`
      INSERT OR IGNORE INTO credit_account (id, userId, balance, createdAt, updatedAt, updateCounter)
      VALUES (?, ?, 0, ?, ?, 0)
    `).bind(accountId, input.userId, now, now),
    d1.prepare(`
      INSERT INTO credit_ledger (
        id, userId, accountId, type, amount, balanceAfter, idempotencyKey,
        reason, provider, providerRef, metadata, createdAt, updatedAt, updateCounter
      )
      SELECT
        ?,
        a.userId,
        a.id,
        ?,
        CASE WHEN ? = 1 THEN -MIN(a.balance, ?) ELSE ? END,
        a.balance + CASE WHEN ? = 1 THEN -MIN(a.balance, ?) ELSE ? END,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        ?,
        0
      FROM credit_account a
      WHERE a.userId = ?
        AND (? = 0 OR a.balance >= ?)
      ON CONFLICT(idempotencyKey) DO NOTHING
    `).bind(
      ledgerId,
      input.type,
      input.type === CREDIT_LEDGER_TYPES.CLAWBACK ? 1 : 0,
      input.amount,
      signed,
      input.type === CREDIT_LEDGER_TYPES.CLAWBACK ? 1 : 0,
      input.amount,
      signed,
      input.idempotencyKey,
      input.reason ?? null,
      provider,
      input.providerRef ?? null,
      metadata,
      now,
      now,
      input.userId,
      requireFunds,
      input.amount,
    ),
    d1.prepare(`
      UPDATE credit_account
      SET balance = (
        SELECT balanceAfter FROM credit_ledger WHERE id = ?
      ),
      updatedAt = ?
      WHERE userId = ?
        AND EXISTS (SELECT 1 FROM credit_ledger WHERE id = ?)
    `).bind(ledgerId, now, input.userId, ledgerId),
  ]);

  const existing = await db.query.creditLedgerTable.findFirst({
    where: { idempotencyKey: input.idempotencyKey },
    columns: {
      id: true,
      balanceAfter: true,
    },
  });

  if (!existing) {
    if (requiresAvailableBalance(input.type)) {
      throw new CreditInsufficientError();
    }
    throw new Error("Credit ledger write did not persist");
  }

  return {
    balance: existing.balanceAfter,
    ledgerId: existing.id,
    reused: existing.id !== ledgerId,
  };
}

export async function topUpCredits({
  userId,
  amount,
  idempotencyKey,
  reason,
  provider,
  providerRef,
  metadata,
}: Omit<CreditMutationInput, "type">) {
  return applyCreditMutation({
    userId,
    amount,
    type: CREDIT_LEDGER_TYPES.TOPUP,
    idempotencyKey,
    reason,
    provider,
    providerRef,
    metadata,
  });
}

export async function deductCredits({
  userId,
  amount,
  idempotencyKey,
  reason,
  provider,
  providerRef,
  metadata,
}: Omit<CreditMutationInput, "type">) {
  return applyCreditMutation({
    userId,
    amount,
    type: CREDIT_LEDGER_TYPES.DEDUCT,
    idempotencyKey,
    reason,
    provider,
    providerRef,
    metadata,
  });
}

export async function refundCredits({
  userId,
  amount,
  idempotencyKey,
  reason,
  provider,
  providerRef,
  metadata,
}: Omit<CreditMutationInput, "type">) {
  return applyCreditMutation({
    userId,
    amount,
    type: CREDIT_LEDGER_TYPES.REFUND,
    idempotencyKey,
    reason,
    provider,
    providerRef,
    metadata,
  });
}

export async function clawbackCredits({
  userId,
  amount,
  idempotencyKey,
  reason,
  provider,
  providerRef,
  metadata,
}: Omit<CreditMutationInput, "type">) {
  return applyCreditMutation({
    userId,
    amount,
    type: CREDIT_LEDGER_TYPES.CLAWBACK,
    idempotencyKey,
    reason,
    provider,
    providerRef,
    metadata,
  });
}

export async function grantSignupBonus({ userId }: { userId: string }) {
  if (!isCreditsEnabled()) {
    return null;
  }

  const amount = getSignupBonus();
  if (amount <= 0) {
    return null;
  }

  return applyCreditMutation({
    userId,
    amount,
    type: CREDIT_LEDGER_TYPES.SIGNUP_BONUS,
    idempotencyKey: `signup-bonus:${userId}`,
    reason: "Signup bonus",
    provider: CREDIT_PROVIDERS.SYSTEM,
  });
}
