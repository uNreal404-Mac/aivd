import { describe, expect, it } from "vitest";

import { CREDIT_PACKAGES, FIRST_MONTH_OFFER, PLAN_PERKS, SUBSCRIPTION_PRODUCTS, planTierOfName } from "../src/config/pricing-user";
import { PRICING_UNITS } from "../src/lib/pricing-units";
import {
  checkoutErrorMessage,
  creditsNeededLine,
  creditsShortfall,
  defaultOptionId,
  estimatesFor,
  maxYearlySavingPercent,
  upgradeOptions,
} from "../src/lib/upgrade-options";

const product = (tier: string, period: "month" | "year") =>
  SUBSCRIPTION_PRODUCTS.find((item) => item.period === period && planTierOfName(item.name) === tier)!;
const unitCredits = (id: string) => PRICING_UNITS.find((item) => item.id === id)!.credits;

describe("upgrade dialog rows", () => {
  it("yearly rows: the price over 12 months to one decimal, the monthly price struck, the real charge kept", () => {
    const rows = upgradeOptions("year");
    expect(rows.map((row) => row.tier)).toEqual(["basic", "pro", "ultimate"]);
    expect(rows.map((row) => row.perMonthUsd)).toEqual([7.9, 23.9, 68.9]);
    for (const row of rows) {
      const yearly = product(row.tier!, "year");
      const monthly = product(row.tier!, "month");
      expect(row.id).toBe(yearly.id);
      expect(row.chargedTodayUsd).toBe(yearly.priceUsd);
      expect(row.perMonthUsd).toBe(Math.round((yearly.priceUsd / 12) * 10) / 10);
      expect(row.wasPerMonthUsd).toBe(monthly.priceUsd);
      expect(row.credits).toBe(yearly.credits);
      expect(row.creditsPerMonth).toBe(monthly.credits);
      expect(row.firstMonthUsd).toBeNull();
    }
  });

  it("yearly saving: 20% on Basic and Pro, less on Ultimate, and the tab badge quotes the largest", () => {
    expect(upgradeOptions("year").map((row) => row.savingPercent)).toEqual([20, 20, 14]);
    expect(maxYearlySavingPercent()).toBe(20);
    expect(upgradeOptions("month").every((row) => row.savingPercent === 0 && row.wasPerMonthUsd === null)).toBe(true);
  });

  it("monthly rows charge the monthly price, and only the offer's plan carries a first-month price", () => {
    const rows = upgradeOptions("month");
    expect(rows.map((row) => row.perMonthUsd)).toEqual([9.9, 29.9, 79.9]);
    for (const row of rows) {
      const monthly = product(row.tier!, "month");
      expect(row.id).toBe(monthly.id);
      expect(row.chargedTodayUsd).toBe(monthly.priceUsd);
      expect(row.firstMonthUsd).toBe(FIRST_MONTH_OFFER.enabled && row.tier === FIRST_MONTH_OFFER.tier ? FIRST_MONTH_OFFER.priceUsd : null);
    }
    expect(rows.find((row) => row.tier === "pro")!.firstMonthUsd).toBe(14.9);
  });

  it("plan rows carry the tier's perks and Pro is the popular one", () => {
    for (const tab of ["year", "month"] as const) {
      const rows = upgradeOptions(tab);
      expect(rows.filter((row) => row.popular).map((row) => row.tier)).toEqual(["pro"]);
      for (const row of rows) {
        expect(row.concurrency).toBe(PLAN_PERKS[row.tier!].concurrency);
        expect(row.priorityQueue).toBe(PLAN_PERKS[row.tier!].priorityQueue);
      }
    }
    expect(upgradeOptions("month").map((row) => row.concurrency)).toEqual([1, 3, 6]);
  });

  it("plans estimate clips from one month of credits, also on the yearly tab", () => {
    for (const row of [...upgradeOptions("year"), ...upgradeOptions("month")]) {
      expect(row.estimates.map((item) => item.unitId)).toEqual(["bytedance/seedance-2-5", "kling/v4-reference-to-video"]);
      for (const item of row.estimates) {
        expect(item.count).toBe(Math.floor(row.creditsPerMonth! / unitCredits(item.unitId)));
      }
    }
  });

  it("pack rows: every pack on sale, with whole clips rounded down and no plan perks", () => {
    const rows = upgradeOptions("pack");
    const packs = CREDIT_PACKAGES.filter((pack) => pack.enabled !== false);
    expect(rows.map((row) => row.id)).toEqual(packs.map((pack) => pack.id));
    expect(rows.map((row) => [row.chargedTodayUsd, row.credits])).toEqual([
      [4.9, 330],
      [9.9, 700],
      [29.9, 2200],
      [99.9, 8000],
    ]);
    for (const row of rows) {
      expect(row.tier).toBeNull();
      expect(row.perMonthUsd).toBeNull();
      expect(row.concurrency).toBeNull();
      expect(row.priorityQueue).toBeNull();
      for (const item of row.estimates) {
        expect(item.creditsEach).toBeGreaterThan(0);
        expect(item.count).toBe(Math.floor(row.credits / item.creditsEach));
        expect(item.count * item.creditsEach).toBeLessThanOrEqual(row.credits);
      }
    }
  });

  it("estimates round down and name both models", () => {
    const seedance = unitCredits("bytedance/seedance-2-5");
    const [first, second] = estimatesFor(seedance * 2 - 1);
    expect(first.name).toBe("Seedance 2.5");
    expect(first.count).toBe(1);
    expect(second.name).toBe("Kling 4.0");
    expect(estimatesFor(0).map((item) => item.count)).toEqual([0, 0]);
  });
});

describe("upgrade dialog defaults", () => {
  it("opens plans on Pro", () => {
    expect(defaultOptionId("year")).toBe(product("pro", "year").id);
    expect(defaultOptionId("month")).toBe(product("pro", "month").id);
  });

  it("opens packs on the smallest one that covers the shortfall", () => {
    const packs = upgradeOptions("pack");
    expect(defaultOptionId("pack")).toBe(packs.find((pack) => pack.popular)!.id);
    expect(defaultOptionId("pack", 65)).toBe(packs[0].id);
    expect(defaultOptionId("pack", 331)).toBe(packs[1].id);
    expect(defaultOptionId("pack", 1_000_000)).toBe(packs[packs.length - 1].id);
  });

  it("works out the shortfall", () => {
    expect(creditsShortfall(260, 70)).toBe(190);
    expect(creditsShortfall(260, null)).toBe(260);
    expect(creditsShortfall(260, -5)).toBe(260);
    expect(creditsShortfall(260, 400)).toBe(0);
    expect(creditsShortfall(undefined, 70)).toBeNull();
  });
});

describe("upgrade dialog copy", () => {
  it("says what the generation needs, and the balance when it is known", () => {
    expect(creditsNeededLine(1260, 70, true)).toBe("这次生成需要 1,260 积分，你现在有 70。");
    expect(creditsNeededLine(260, 70, false)).toBe("This generation needs 260 credits. You have 70.");
    expect(creditsNeededLine(260, null, true)).toBe("这次生成需要 260 积分。");
    expect(creditsNeededLine(260, 500, false)).toBe("This generation needs 260 credits.");
    expect(creditsNeededLine(undefined, 70, true)).toBeNull();
  });

  it("never shows a bare error code", () => {
    const codes = ["unauthorized", "payments_not_configured", "rate_limited", "invalid_product", "invalid_body", "checkout_failed", "network", "Missing checkout URL.", undefined];
    for (const zh of [true, false]) {
      for (const code of codes) {
        const message = checkoutErrorMessage(code, zh);
        expect(message.length).toBeGreaterThan(10);
        if (code) expect(message).not.toContain(code);
        expect(message).not.toMatch(/_/);
      }
    }
  });
});

describe("first-month price by account", () => {
  it("shows it to new accounts and hides it from accounts that have paid", () => {
    const pro = (first: boolean) => upgradeOptions("month", first).find((row) => row.tier === "pro");
    expect(pro(true)?.firstMonthUsd).not.toBeNull();
    expect(pro(false)?.firstMonthUsd).toBeNull();
    expect(pro(false)?.chargedTodayUsd).toBe(pro(true)?.chargedTodayUsd);
  });
});
