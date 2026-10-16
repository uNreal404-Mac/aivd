import { describe, expect, it } from "vitest";

import {
  FAQ_ITEMS,
  asPricingProducts,
  costPer100Credits,
  displayPlanName,
  monthlyEquivalentCents,
  plansForPeriod,
  type PricingProduct,
} from "../src/components/pricing/pricing-data";

const monthly: PricingProduct = {
  id: "pro-monthly",
  name: "Pro",
  credits: 2000,
  price: { amount: 3900, currency: "USD" },
  billingPeriod: "month",
};

const yearly: PricingProduct = {
  id: "pro-yearly",
  name: "Pro (Yearly)",
  credits: 24000,
  price: { amount: 39000, currency: "USD" },
  billingPeriod: "year",
};

describe("plansForPeriod", () => {
  it("keeps only the requested billing period", () => {
    expect(plansForPeriod([monthly, yearly], "month")).toEqual([monthly]);
    expect(plansForPeriod([monthly, yearly], "year")).toEqual([yearly]);
  });

  it("preserves the original order", () => {
    const second: PricingProduct = { ...monthly, id: "team-monthly" };
    expect(plansForPeriod([monthly, second], "month")).toEqual([monthly, second]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(plansForPeriod([monthly], "year")).toEqual([]);
    expect(plansForPeriod([], "month")).toEqual([]);
  });
});

describe("monthlyEquivalentCents", () => {
  it("returns the monthly price unchanged", () => {
    expect(monthlyEquivalentCents(monthly)).toBe(3900);
  });

  it("divides yearly prices by twelve", () => {
    expect(monthlyEquivalentCents(yearly)).toBe(3250);
  });

  it("rounds to the nearest cent", () => {
    const odd: PricingProduct = {
      ...yearly,
      price: { amount: 10000, currency: "USD" },
    };
    expect(monthlyEquivalentCents(odd)).toBe(833);
  });
});

describe("costPer100Credits", () => {
  it("computes the cost of 100 credits in cents", () => {
    expect(costPer100Credits(monthly)).toBe(195);
  });

  it("rounds fractional results", () => {
    expect(costPer100Credits(yearly)).toBe(163);
  });

  it("returns 0 when the product has no credits", () => {
    expect(costPer100Credits({ ...monthly, credits: 0 })).toBe(0);
  });
});

describe("displayPlanName", () => {
  it("strips a yearly suffix", () => {
    expect(displayPlanName("Pro (Yearly)")).toBe("Pro");
  });

  it("strips an annual suffix case-insensitively", () => {
    expect(displayPlanName("Team (annual)")).toBe("Team");
  });

  it("leaves unrelated names untouched", () => {
    expect(displayPlanName("Basic")).toBe("Basic");
    expect(displayPlanName("Pro Plan")).toBe("Pro Plan");
  });

  it("trims trailing whitespace", () => {
    expect(displayPlanName("Pro (Yearly)  ")).toBe("Pro");
  });
});

describe("asPricingProducts", () => {
  it("narrows config objects to the render props", () => {
    const result = asPricingProducts([
      {
        id: "basic-monthly",
        name: "Basic",
        credits: 1000,
        price: { amount: 1900, currency: "USD" },
        type: "subscription",
        billingPeriod: "month",
      },
    ]);

    expect(result).toEqual([
      {
        id: "basic-monthly",
        name: "Basic",
        credits: 1000,
        price: { amount: 1900, currency: "USD" },
        billingPeriod: "month",
      },
    ]);
  });
});

describe("FAQ_ITEMS", () => {
  it("exposes six answered questions with unique ids", () => {
    expect(FAQ_ITEMS).toHaveLength(6);
    for (const item of FAQ_ITEMS) {
      expect(item.question.length).toBeGreaterThan(0);
      expect(item.answer.length).toBeGreaterThan(0);
    }
    expect(new Set(FAQ_ITEMS.map((item) => item.id)).size).toBe(6);
  });
});
