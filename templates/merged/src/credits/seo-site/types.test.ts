import { describe, expect, test } from "vitest";

import {
  CREDIT_LEDGER_TYPES,
  CreditAmountError,
  CreditInsufficientError,
  creditsForRefundAmount,
  nextCreditBalance,
  signedLedgerAmount,
} from "./types";

describe("nextCreditBalance", () => {
  test("adds top-ups, bonuses, and refunds", () => {
    expect(nextCreditBalance({ balance: 10, amount: 5, type: CREDIT_LEDGER_TYPES.TOPUP })).toBe(15);
    expect(nextCreditBalance({ balance: 0, amount: 10, type: CREDIT_LEDGER_TYPES.SIGNUP_BONUS })).toBe(10);
    expect(nextCreditBalance({ balance: 4, amount: 4, type: CREDIT_LEDGER_TYPES.REFUND })).toBe(8);
  });

  test("deducts only when the balance covers the cost", () => {
    expect(nextCreditBalance({ balance: 10, amount: 3, type: CREDIT_LEDGER_TYPES.DEDUCT })).toBe(7);
    expect(() => nextCreditBalance({ balance: 2, amount: 3, type: CREDIT_LEDGER_TYPES.DEDUCT })).toThrow(
      CreditInsufficientError,
    );
  });

  test("claws back a payment refund without going negative", () => {
    expect(nextCreditBalance({ balance: 100, amount: 40, type: CREDIT_LEDGER_TYPES.CLAWBACK })).toBe(60);
    expect(nextCreditBalance({ balance: 10, amount: 40, type: CREDIT_LEDGER_TYPES.CLAWBACK })).toBe(0);
  });

  test("rejects non-positive amounts", () => {
    expect(() => nextCreditBalance({ balance: 1, amount: 0, type: CREDIT_LEDGER_TYPES.TOPUP })).toThrow(
      CreditAmountError,
    );
  });
});

describe("signedLedgerAmount", () => {
  test("stores deducts as a negative delta", () => {
    expect(signedLedgerAmount({ amount: 4, type: CREDIT_LEDGER_TYPES.DEDUCT })).toBe(-4);
    expect(signedLedgerAmount({ amount: 4, type: CREDIT_LEDGER_TYPES.REFUND })).toBe(4);
    expect(signedLedgerAmount({ amount: 4, type: CREDIT_LEDGER_TYPES.CLAWBACK })).toBe(-4);
    expect(signedLedgerAmount({ amount: 10, type: CREDIT_LEDGER_TYPES.CLAWBACK, balance: 4 })).toBe(-4);
  });
});

describe("creditsForRefundAmount", () => {
  test("returns a proportional clawback and ignores invalid inputs", () => {
    expect(creditsForRefundAmount({ planCredits: 100, chargeAmount: 900, refundAmount: 450 })).toBe(50);
    expect(creditsForRefundAmount({ planCredits: 100, chargeAmount: 900, refundAmount: 900 })).toBe(100);
    expect(creditsForRefundAmount({ planCredits: 100, chargeAmount: 0, refundAmount: 450 })).toBe(0);
    expect(creditsForRefundAmount({ planCredits: 0, chargeAmount: 900, refundAmount: 450 })).toBe(0);
  });
});
