export const CREDIT_LEDGER_TYPES = {
  TOPUP: "topup",
  DEDUCT: "deduct",
  REFUND: "refund",
  CLAWBACK: "clawback",
  SIGNUP_BONUS: "signup_bonus",
} as const;

type CreditLedgerType = (typeof CREDIT_LEDGER_TYPES)[keyof typeof CREDIT_LEDGER_TYPES];

export const CREDIT_PROVIDERS = {
  STRIPE: "stripe",
  CREEM: "creem",
  PAYPAL: "paypal",
  SYSTEM: "system",
} as const;

type CreditProvider = (typeof CREDIT_PROVIDERS)[keyof typeof CREDIT_PROVIDERS];

export interface CreditMutationInput {
  userId: string;
  amount: number;
  type: CreditLedgerType;
  idempotencyKey: string;
  reason?: string;
  provider?: CreditProvider;
  providerRef?: string;
  metadata?: Record<string, unknown>;
}

export interface CreditMutationResult {
  balance: number;
  ledgerId: string;
  reused: boolean;
}

export class CreditInsufficientError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "CreditInsufficientError";
  }
}

export class CreditAmountError extends Error {
  constructor() {
    super("Credit amount must be a positive integer");
    this.name = "CreditAmountError";
  }
}

export function nextCreditBalance({
  balance,
  amount,
  type,
}: {
  balance: number;
  amount: number;
  type: CreditLedgerType;
}): number {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new CreditAmountError();
  }

  if (type === CREDIT_LEDGER_TYPES.DEDUCT) {
    if (balance < amount) {
      throw new CreditInsufficientError();
    }
    return balance - amount;
  }

  if (type === CREDIT_LEDGER_TYPES.CLAWBACK) {
    return Math.max(0, balance - amount);
  }

  return balance + amount;
}

export function signedLedgerAmount({
  amount,
  type,
  balance,
}: {
  amount: number;
  type: CreditLedgerType;
  balance?: number;
}): number {
  if (type === CREDIT_LEDGER_TYPES.CLAWBACK) {
    const available = typeof balance === "number" ? Math.max(0, balance) : amount;
    return -Math.min(available, amount);
  }

  return type === CREDIT_LEDGER_TYPES.DEDUCT ? -amount : amount;
}

export function creditsForRefundAmount({
  planCredits,
  chargeAmount,
  refundAmount,
}: {
  planCredits: number;
  chargeAmount: number;
  refundAmount: number;
}): number {
  if (
    !Number.isInteger(planCredits) ||
    planCredits <= 0 ||
    !Number.isFinite(chargeAmount) ||
    chargeAmount <= 0 ||
    !Number.isFinite(refundAmount) ||
    refundAmount <= 0
  ) {
    return 0;
  }

  return Math.floor((planCredits * refundAmount) / chargeAmount);
}
