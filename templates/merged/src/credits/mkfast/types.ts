export enum CreditTransactionType {
  REGISTER_GIFT = 'REGISTER_GIFT',
  SUBSCRIPTION_RENEWAL = 'SUBSCRIPTION_RENEWAL',
  PURCHASE_PACKAGE = 'PURCHASE_PACKAGE',
  REDEMPTION_CODE = 'REDEMPTION_CODE',
  REFUND = 'REFUND',
  USAGE = 'USAGE',
  EXPIRE = 'EXPIRE',
}

/** Whether a credit batch expires at the next renewal or stays permanent. */
export enum CreditValidity {
  BILLING_CYCLE = 'BILLING_CYCLE',
  PERMANENT = 'PERMANENT',
}

export const TRANSACTION_VALIDITY_MAP: Record<
  CreditTransactionType,
  CreditValidity
> = {
  [CreditTransactionType.SUBSCRIPTION_RENEWAL]: CreditValidity.BILLING_CYCLE,
  [CreditTransactionType.REGISTER_GIFT]: CreditValidity.PERMANENT,
  [CreditTransactionType.PURCHASE_PACKAGE]: CreditValidity.PERMANENT,
  [CreditTransactionType.REDEMPTION_CODE]: CreditValidity.PERMANENT,
  [CreditTransactionType.REFUND]: CreditValidity.PERMANENT,
  [CreditTransactionType.USAGE]: CreditValidity.PERMANENT,
  [CreditTransactionType.EXPIRE]: CreditValidity.PERMANENT,
};

export const CreditTransactionTypes = {
  REGISTER_GIFT: 'REGISTER_GIFT' as const,
  SUBSCRIPTION_RENEWAL: 'SUBSCRIPTION_RENEWAL' as const,
  PURCHASE_PACKAGE: 'PURCHASE_PACKAGE' as const,
  REDEMPTION_CODE: 'REDEMPTION_CODE' as const,
  REFUND: 'REFUND' as const,
  USAGE: 'USAGE' as const,
  EXPIRE: 'EXPIRE' as const,
};
