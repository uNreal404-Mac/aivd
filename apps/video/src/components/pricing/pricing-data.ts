import type { CreditPackageConfig } from "@/config/credits";

/**
 * Pure, dependency-free helpers for the /pricing page.
 * Nothing in here touches React, the DOM or the network so it can be
 * unit-tested in isolation and reused on the server.
 */

export type BillingPeriod = "month" | "year";

/**
 * Minimal structural shape of a sellable product.
 * `CreditPackageConfig` from "@/config/credits" satisfies it, but tests can
 * build tiny literals instead of full config objects.
 */
export interface PricingProduct {
  id: string;
  name: string;
  /** Credits granted per billing period. */
  credits: number;
  price: {
    /** Price in cents. */
    amount: number;
    currency: string;
  };
  billingPeriod?: "month" | "year";
}

/** Normalize a value coming from config into the props we render. */
export function asPricingProducts(
  products: readonly CreditPackageConfig[]
): PricingProduct[] {
  return products.map((product) => ({
    id: product.id,
    name: product.name,
    credits: product.credits,
    price: {
      amount: product.price.amount,
      currency: product.price.currency,
    },
    billingPeriod: product.billingPeriod,
  }));
}

/** Products belonging to a single billing period, original order preserved. */
export function plansForPeriod<T extends PricingProduct>(
  products: readonly T[],
  period: BillingPeriod
): T[] {
  return products.filter((product) => product.billingPeriod === period);
}

/**
 * Price expressed as "per month", in cents.
 * Monthly plans return their own price; yearly plans are divided by 12.
 */
export function monthlyEquivalentCents(product: PricingProduct): number {
  if (product.billingPeriod !== "year") {
    return Math.round(product.price.amount);
  }
  return Math.round(product.price.amount / 12);
}

/** Effective cost of 100 credits, in cents. Returns 0 when credits is 0. */
export function costPer100Credits(product: PricingProduct): number {
  if (!product.credits || product.credits <= 0) return 0;
  return Math.round((product.price.amount / product.credits) * 100);
}

/** Display name with the billing-period suffix removed, e.g. "Pro (Yearly)". */
export function displayPlanName(name: string): string {
  return name.replace(/\s*\((?:yearly|annual|year)\)\s*$/i, "").trim();
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "credits",
    question: "What are credits and how are they used?",
    answer:
      "Credits are the single currency for every generation on DreamUtopia. Each video model has a fixed cost per second, so the number of clips you can render depends on the model, the duration and the resolution you pick. Your remaining balance is always visible before you press generate.",
  },
  {
    id: "expiry",
    question: "Do my credits expire?",
    answer:
      "Credits included with a subscription stay valid for the length of the plan, while credits bought as a one-time pack remain available for the purchase window shown at checkout, so you always know how long your balance lasts.",
  },
  {
    id: "switching",
    question: "Can I switch between monthly and yearly billing?",
    answer:
      "Yes. You can move from monthly to yearly at any time and the yearly rate is applied from the next billing cycle. Moving from yearly back to monthly takes effect when the current yearly term ends, so you keep everything you already paid for.",
  },
  {
    id: "refunds",
    question: "What happens if a generation fails?",
    answer:
      "Credits for a failed render are returned to your balance automatically, so an unsuccessful generation never costs you anything.",
  },
  {
    id: "payment",
    question: "Which payment methods do you accept?",
    answer:
      "All payments are processed securely by Stripe. We accept major debit and credit cards, and your card details never touch our servers. Invoices and receipts are available from your billing settings after every purchase.",
  },
  {
    id: "cancel",
    question: "Can I cancel my subscription anytime?",
    answer:
      "You can cancel at any time from the billing page with a single click. Your plan stays active until the end of the period you already paid for, and you are never charged again after that. No cancellation fees, no phone calls.",
  },
];
