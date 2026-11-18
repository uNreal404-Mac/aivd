import { describe, expect, it } from "vitest";

import { calculateModelCredits, getAvailableModels } from "@/config/credits";
import {
  CREDIT_BUDGET_USD,
  KIE_PER_IMAGE_USD,
  KIE_PER_SECOND_USD,
  imageCreditsFromCost,
  kieVideoCostUsd,
  videoBudgetUsd,
  videoCreditsFromCost,
} from "@/config/kie-pricing";
import { CREDIT_PACKAGES, NEW_USER_GIFT, SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";

describe("credit formula", () => {
  it("rounds video prices up to a multiple of 5", () => {
    expect(videoCreditsFromCost(0.205)).toBe(65); // Seedance 2.0 Mini 720p 5s
    expect(videoCreditsFromCost(1.025)).toBe(285); // Seedance 2.0 720p 5s
    expect(videoCreditsFromCost(0.3)).toBe(90); // Veo 3.1 Fast
    expect(videoCreditsFromCost(0.35)).toBe(100); // Wan 2.6 5s 720p
  });

  it("prices images in single credits with a floor of 2", () => {
    expect(imageCreditsFromCost(0.004)).toBe(2);
    expect(imageCreditsFromCost(0.04)).toBe(12);
    expect(imageCreditsFromCost(0.09)).toBe(25);
  });

  it("never lets a credit cost more than the budget it stands for", () => {
    const costs = [
      ...Object.values(KIE_PER_SECOND_USD).flatMap((tiers) =>
        Object.values(tiers).flatMap((perSecond) => [perSecond * 5, perSecond * 10]),
      ),
      0.3, 1.275, 0.35, 0.525, 0.7, 1.05, 1.575,
    ];
    for (const cost of costs) {
      const perCredit = videoBudgetUsd(cost) / videoCreditsFromCost(cost);
      expect(perCredit, `cost ${cost}`).toBeLessThanOrEqual(CREDIT_BUDGET_USD + 1e-12);
    }
    for (const cost of Object.values(KIE_PER_IMAGE_USD)) {
      const perCredit = (cost * 1.15 + 0.002) / imageCreditsFromCost(cost);
      expect(perCredit, `image ${cost}`).toBeLessThanOrEqual(CREDIT_BUDGET_USD + 1e-12);
    }
  });
});

describe("charging what KIE will be asked for", () => {
  it("charges Wan 2.6 as 1080p unless 720p is explicit", () => {
    expect(kieVideoCostUsd("wan2.6", { duration: 5, quality: "720p" })).toBe(0.35);
    expect(kieVideoCostUsd("wan2.6", { duration: 5, quality: "standard" })).toBe(0.35);
    expect(kieVideoCostUsd("wan2.6", { duration: 5 })).toBe(0.525);
    expect(kieVideoCostUsd("wan2.6", { duration: 5, quality: "480p" })).toBe(0.525);
    expect(kieVideoCostUsd("wan2.6", { duration: 5, quality: "1080P" })).toBe(0.525);
  });

  it("rounds Wan 2.6 lengths up to the next billed length", () => {
    expect(kieVideoCostUsd("wan2.6", { duration: 7, quality: "720p" })).toBe(0.7);
    expect(kieVideoCostUsd("wan2.6", { duration: 15, quality: "720p" })).toBe(1.05);
  });

  it("charges Veo 3.1 Quality when the request selects it", () => {
    expect(calculateModelCredits("veo-3.1", { duration: 8, quality: "720p" })).toBe(90);
    expect(calculateModelCredits("veo-3.1", { duration: 8 })).toBe(90);
    expect(calculateModelCredits("veo-3.1", { duration: 8, quality: "1080p" })).toBe(350);
    expect(calculateModelCredits("veo-3.1", { duration: 8, quality: "high" })).toBe(350);
  });

  it("has no price for models without a verified KIE cost", () => {
    expect(kieVideoCostUsd("sora-2", { duration: 10 })).toBeNull();
    expect(calculateModelCredits("sora-2", { duration: 10 })).toBe(0);
    expect(calculateModelCredits("seedance-1.5-pro", { duration: 4 })).toBe(0);
    expect(calculateModelCredits("no-such-model", { duration: 5 })).toBe(0);
  });

  it("only sells models that have a price", () => {
    const onSale = getAvailableModels();
    expect(onSale.map((model) => model.id)).toEqual(["veo-3.1", "wan2.6"]);
    for (const model of onSale) {
      for (const duration of model.durations) {
        expect(calculateModelCredits(model.id, { duration }), `${model.id} ${duration}s`).toBeGreaterThan(0);
      }
    }
  });
});

describe("plans", () => {
  const WORST_BUDGET_PER_CREDIT = CREDIT_BUDGET_USD;
  const PAYMENT_AND_AFFILIATE = 0.18;

  it("keeps the monthly contribution above 30% in the worst case", () => {
    for (const plan of SUBSCRIPTION_PRODUCTS.filter((item) => item.period === "month")) {
      const budget = plan.credits * WORST_BUDGET_PER_CREDIT;
      const contribution = (plan.priceUsd * (1 - PAYMENT_AND_AFFILIATE) - budget) / plan.priceUsd;
      expect(contribution, plan.name).toBeGreaterThanOrEqual(0.3);
    }
  });

  it("keeps the yearly contribution above 25% in the worst case", () => {
    for (const plan of SUBSCRIPTION_PRODUCTS.filter((item) => item.period === "year")) {
      const budget = plan.credits * WORST_BUDGET_PER_CREDIT;
      const contribution = (plan.priceUsd * (1 - PAYMENT_AND_AFFILIATE) - budget) / plan.priceUsd;
      expect(contribution, plan.name).toBeGreaterThanOrEqual(0.25);
    }
  });

  it("never sells pack credits cheaper than the Basic plan's", () => {
    const basic = SUBSCRIPTION_PRODUCTS.find((item) => item.period === "month" && item.priceUsd === 12);
    expect(basic).toBeDefined();
    const basicPerCredit = (basic?.priceUsd ?? 0) / (basic?.credits ?? 1);
    for (const pack of CREDIT_PACKAGES) {
      expect(pack.priceUsd / pack.credits, pack.name).toBeGreaterThan(basicPerCredit);
    }
  });

  it("gives new users enough for one video but caps the cost near $0.30", () => {
    expect(NEW_USER_GIFT.credits).toBe(70);
    expect(NEW_USER_GIFT.credits * CREDIT_BUDGET_USD).toBeLessThanOrEqual(0.3);
  });
});
