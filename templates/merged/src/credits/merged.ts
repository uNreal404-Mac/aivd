/**
 * Merged credits facade.
 * Packages/redemption: ./mkfast
 * Admin credit service: ./shipany
 * Ledger types: ./seo-site
 */

export type CreditBalance = {
  userId: string;
  available: number;
  reserved: number;
  updatedAt?: string;
};

export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  providerPriceId?: string;
};

export type CreditTxn = {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  createdAt: string;
};

export const creditsFeatures = {
  packages: true,
  redemptionCodes: true,
  signupBonus: true,
  adminAdjust: true,
  ledger: true,
} as const;

/** Default packages — override via env / DB in production. */
export const defaultCreditPackages: CreditPackage[] = [
  { id: "starter", name: "Starter", credits: 100, priceCents: 999, currency: "usd" },
  { id: "pro", name: "Pro", credits: 500, priceCents: 3999, currency: "usd" },
  { id: "ultra", name: "Ultra", credits: 2000, priceCents: 12999, currency: "usd" },
];

export async function getBalancePlaceholder(_userId: string): Promise<CreditBalance> {
  return { userId: _userId, available: 0, reserved: 0 };
}

export async function applyCreditDeltaPlaceholder(
  userId: string,
  delta: number,
  reason: string,
): Promise<CreditTxn> {
  return {
    id: "placeholder",
    userId,
    delta,
    reason,
    createdAt: new Date().toISOString(),
  };
}
