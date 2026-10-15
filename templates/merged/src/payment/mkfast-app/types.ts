import type { PaymentConfig } from '@/types';

/**
 * Payment types: subscription and one-time
 */
export type PaymentType = 'subscription' | 'one_time';

export const PaymentTypes = {
  SUBSCRIPTION: 'subscription' as const,
  ONE_TIME: 'one_time' as const,
};

/**
 * Payment scene:
 * - subscription: recurring subscription payment
 * - lifetime:     one-time lifetime plan purchase
 * - credit:       one-time credit-package purchase
 */
export type PaymentScene = 'subscription' | 'lifetime' | 'credit';

export const PaymentScenes = {
  LIFETIME: 'lifetime' as const,
  SUBSCRIPTION: 'subscription' as const,
  CREDIT: 'credit' as const,
};

export type PlanInterval = 'month' | 'year';

export const PlanIntervals = {
  MONTH: 'month' as const,
  YEAR: 'year' as const,
};

/**
 * Status of a payment or subscription
 */
export type PaymentStatus =
  | 'active'
  | 'canceled'
  | 'incomplete'
  | 'incomplete_expired'
  | 'past_due'
  | 'paused'
  | 'trialing'
  | 'unpaid'
  | 'completed'
  | 'processing'
  | 'failed';

/**
 * Price definition for a plan
 */
export interface Price {
  type: PaymentType;                 // Type of payment (subscription or one_time)
  priceId: string;                   // Stripe price ID (not product id)
  amount: number;                    // Price amount in currency units (dollars, euros, etc.)
  currency: string;                  // Currency code (e.g., USD)
  interval?: PlanInterval;           // Billing interval for recurring payments
  trialPeriodDays?: number;          // Free trial period in days
  allowPromotionCode?: boolean;      // Whether to allow promotion code for this price
  disabled?: boolean;                // Whether to disable this price in UI
}

/**
 * Price plan definition (subscription / lifetime / free).
 *
 * Credit packages are NOT plans — see `CreditPackage` below. Subscription
 * plans are currently not rendered in this project (credit-only UI), but
 * the type is kept intact for future template sync.
 *
 * 1. When to set the plan disabled?
 * When the plan is not available anymore, but you should keep it for existing users
 * who have already purchased it, otherwise they can not see the plan in the Billing page.
 *
 * 2. When to set the price disabled?
 * When the price is not available anymore, but you should keep it for existing users
 * who have already purchased it, otherwise they can not see the price in the Billing page.
 */
export interface PricePlan {
  id: string;                        // Unique identifier for the plan
  name?: string;                     // Display name of the plan
  description?: string;              // Description of the plan features
  features?: string[];               // List of features included in this plan
  limits?: string[];                 // List of limits for this plan
  prices: Price[];                   // Available prices for this plan
  isFree: boolean;                   // Whether this is a free plan
  isLifetime: boolean;               // Whether this is a lifetime plan
  popular?: boolean;                 // Whether to mark this plan as popular in UI
  disabled?: boolean;                // Whether to disable this plan in UI
}

/**
 * Price of a credit package (a single one-time price; no interval).
 */
export interface CreditPackagePrice {
  priceId: string;                   // Stripe price ID
  amount: number;                    // Price amount in currency units (cents)
  currency: string;                  // Currency code (e.g., USD)
  allowPromotionCode?: boolean;      // Whether to allow promotion code for this price
}

/** Visual tier for a credit package — drives card styling. */
export type CreditPackageTier = 'free' | 'starter' | 'pro' | 'ultimate';

/**
 * Credit package definition (one-time purchase).
 *
 * Kept as a dedicated type rather than reusing `PricePlan` because credit
 * packages have their own UI, webhook handling, and accounting flow.
 */
export interface CreditPackage {
  id: string;                        // Unique identifier for the package
  amount: number;                    // Number of credits granted on purchase
  price: CreditPackagePrice;         // The (single) one-time price
  popular: boolean;                  // Whether to mark this package as popular in UI
  name?: string;                     // Display name of the package
  description?: string;              // Description shown on the package card
  tagline?: string;                  // Short subtitle under the name
  tier?: CreditPackageTier;          // Visual tier
  saveBadge?: string;                // Right-side badge text (e.g. "SAVE 10%")
  originalAmount?: number;           // Original price (cents) shown struck-through
  creditsValueDescription?: string;  // Helper line under credits, e.g. "Up to 1,100 images"
  features?: string[];               // Bullet-list of perks
  ctaLabel?: string;                 // Button label override
  expireDays?: number;               // Days until granted credits expire; undefined = permanent
  disabled?: boolean;                // Whether to hide this package in UI
  isFreeTier?: boolean;              // Free placeholder card — rendered without a checkout button
}

/**
 * Subscription data
 */
export interface Subscription {
  id: string;
  customerId: string;
  status: PaymentStatus;
  priceId: string;
  type: PaymentType;
  interval?: PlanInterval;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  trialStartDate?: Date;
  trialEndDate?: Date;
  createdAt: Date;
}

/**
 * Payment data
 */
export interface Payment {
  id: string;
  customerId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  createdAt: Date;
  metadata?: Record<string, string>;
}

/**
 * Parameters for creating a checkout session (subscription / lifetime / free).
 */
export interface CreateCheckoutParams {
  planId: string;
  priceId: string;
  customerEmail: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  locale?: string;
  /**
   * Optional UI theme hint for hosted checkout pages. Providers that host
   * their own checkout page (Waffo via `darkMode`, Creem via a `?theme=`
   * URL override) honor this to match the caller's site theme; Stripe's
   * hosted checkout ignores it.
   */
  theme?: 'dark' | 'light';
}

/**
 * Parameters for creating a credit-package checkout session.
 */
export interface CreateCreditCheckoutParams {
  packageId: string;
  priceId: string;
  customerEmail: string;
  successUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
  locale?: string;
}

/**
 * Result of creating a checkout session
 */
export interface CheckoutResult {
  url: string;
  id: string;
}

/**
 * Parameters for creating a customer portal session
 */
export interface CreatePortalParams {
  customerId: string;
  returnUrl?: string;
  locale?: string;
}

/**
 * Result of creating a customer portal session
 */
export interface PortalResult {
  url: string;
}

/**
 * Payment providers (actual provider names from config)
 */
export type PaymentProviderName = Exclude<NonNullable<PaymentConfig['provider']>, ''>;

/**
 * Payment provider interface
 */
export interface PaymentProvider {
  /**
   * Whether createCustomerPortal needs a stored user.customerId.
   * Providers with a shared hosted portal (no per-merchant customer record)
   * set this to false. Defaults to true when omitted.
   */
  readonly requiresCustomerId?: boolean;

  /**
   * Whether the provider hosts its own post-checkout page.
   *
   * Stripe replaces `{CHECKOUT_SESSION_ID}` in the return URL, so we route
   * the buyer through an in-app confirmation page that polls by sessionId.
   * Providers that host their own confirmation page (Creem, Waffo) round-trip
   * a server-generated order reference through metadata and the webhook.
   * Defaults to false when omitted (behaves like Stripe).
   */
  readonly hostsPostCheckoutPage?: boolean;

  /**
   * Get the provider's name
   */
  getProviderName(): string;

  /**
   * Create a checkout session for a subscription / lifetime / free plan
   */
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;

  /**
   * Create a checkout session for a credit-package purchase
   */
  createCreditCheckout(params: CreateCreditCheckoutParams): Promise<CheckoutResult>;

  /**
   * Create a customer portal session
   */
  createCustomerPortal(params: CreatePortalParams): Promise<PortalResult>;

  /**
   * Handle webhook events
   */
  handleWebhookEvent(payload: string, signature: string): Promise<void>;
}
