import { describe, expect, it } from "vitest";

import { calculateModelCredits, getAvailableModels } from "@/config/credits";
import {
  CREDIT_BUDGET_USD,
  CREDIT_LIST_USD,
  KIE_PER_IMAGE_USD,
  KIE_PER_SECOND_USD,
  MAX_VIDEO_COST_PER_CREDIT_USD,
  imageCreditsFromCost,
  kieVideoCostUsd,
  videoCreditsFromCost,
  videoListPriceUsd,
} from "@/config/kie-pricing";
import { CREDIT_PACKAGES, NEW_USER_GIFT, SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";

describe("credit formula", () => {
  it("rounds video prices up to a multiple of 5", () => {
    expect(videoCreditsFromCost(0.06)).toBe(25); // Grok Imagine 480p 5s
    expect(videoCreditsFromCost(0.205)).toBe(50); // Seedance 2.0 Mini 720p 5s
    expect(videoCreditsFromCost(0.3)).toBe(65); // Veo 3.1 Fast
    expect(videoCreditsFromCost(0.35)).toBe(70); // Wan 2.6 5s 720p
    expect(videoCreditsFromCost(1.025)).toBe(175); // Seedance 2.5 Flash 720p 5s
    expect(videoCreditsFromCost(1.575)).toBe(260); // Seedance 2.5 720p 5s
  });

  it("marks cheap clips up more than dear ones", () => {
    const multiple = (cost: number) => (videoCreditsFromCost(cost) * CREDIT_LIST_USD) / cost;
    expect(multiple(0.06)).toBeGreaterThan(4);
    expect(multiple(3.95)).toBeLessThan(1.7);
    expect(multiple(0.3)).toBeGreaterThan(multiple(1.575));
  });

  it("prices images in single credits with a floor of 2", () => {
    expect(imageCreditsFromCost(0.004)).toBe(2);
    expect(imageCreditsFromCost(0.04)).toBe(12);
    expect(imageCreditsFromCost(0.09)).toBe(25);
  });

  it("never lets a credit stand for more KIE cost than its ceiling", () => {
    const costs = [
      ...Object.values(KIE_PER_SECOND_USD).flatMap((tiers) =>
        Object.values(tiers).flatMap((perSecond) => [perSecond * 5, perSecond * 10, perSecond * 30]),
      ),
      0.3, 1.275, 0.35, 0.525, 0.7, 1.05, 1.575,
    ];
    for (const cost of costs) {
      const credits = videoCreditsFromCost(cost);
      expect(credits * CREDIT_LIST_USD, `cost ${cost}`).toBeGreaterThanOrEqual(videoListPriceUsd(cost) - 1e-9);
      expect(cost / credits, `cost ${cost}`).toBeLessThanOrEqual(MAX_VIDEO_COST_PER_CREDIT_USD + 1e-12);
    }
    for (const cost of Object.values(KIE_PER_IMAGE_USD)) {
      const perCredit = (cost * 1.15 + 0.002) / imageCreditsFromCost(cost);
      expect(perCredit, `image ${cost}`).toBeLessThanOrEqual(CREDIT_BUDGET_USD + 1e-12);
    }
    // Image and audio credits stand for less cost than video credits, so the
    // video ceiling is the worst case for every plan below.
    expect(CREDIT_BUDGET_USD).toBeLessThan(MAX_VIDEO_COST_PER_CREDIT_USD);
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
    expect(calculateModelCredits("veo-3.1", { duration: 8, quality: "720p" })).toBe(65);
    expect(calculateModelCredits("veo-3.1", { duration: 8 })).toBe(65);
    expect(calculateModelCredits("veo-3.1", { duration: 8, quality: "1080p" })).toBe(215);
    expect(calculateModelCredits("veo-3.1", { duration: 8, quality: "high" })).toBe(215);
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
  // Card processing only (Stripe's 2.9% + $0.30, rounded up for cross-border
  // cards). Storage, retries, refunds and tax are not in this figure.
  const PAYMENT_FEE = 0.05;
  const netPerCredit = (plan: { priceUsd: number; credits: number }) => (plan.priceUsd * (1 - PAYMENT_FEE)) / plan.credits;
  const worstCaseMargin = (plan: { priceUsd: number; credits: number }) =>
    (plan.priceUsd * (1 - PAYMENT_FEE) - plan.credits * MAX_VIDEO_COST_PER_CREDIT_USD) / plan.priceUsd;

  it("nets more per credit than a credit can cost, on every plan and pack", () => {
    for (const product of [...SUBSCRIPTION_PRODUCTS, ...CREDIT_PACKAGES]) {
      expect(netPerCredit(product), product.name).toBeGreaterThan(MAX_VIDEO_COST_PER_CREDIT_USD);
    }
  });

  it("keeps the monthly margin above 15% when every credit goes on the dearest clips", () => {
    for (const plan of SUBSCRIPTION_PRODUCTS.filter((item) => item.period === "month")) {
      expect(worstCaseMargin(plan), plan.name).toBeGreaterThanOrEqual(0.15);
    }
  });

  it("keeps the yearly margin above 5% when every credit goes on the dearest clips", () => {
    for (const plan of SUBSCRIPTION_PRODUCTS.filter((item) => item.period === "year")) {
      expect(worstCaseMargin(plan), plan.name).toBeGreaterThanOrEqual(0.05);
    }
  });

  it("prices every plan and pack to end in .9", () => {
    for (const product of [...SUBSCRIPTION_PRODUCTS, ...CREDIT_PACKAGES]) {
      expect(Math.round(product.priceUsd * 100) % 100, product.name).toBe(90);
    }
  });

  it("makes each bigger monthly plan cheaper per credit", () => {
    const monthly = SUBSCRIPTION_PRODUCTS.filter((item) => item.period === "month").sort((a, b) => a.priceUsd - b.priceUsd);
    for (let index = 1; index < monthly.length; index += 1) {
      expect(monthly[index].priceUsd / monthly[index].credits).toBeLessThan(monthly[index - 1].priceUsd / monthly[index - 1].credits);
    }
  });

  it("never sells pack credits cheaper than the Basic plan's", () => {
    const basic = SUBSCRIPTION_PRODUCTS.filter((item) => item.period === "month").sort((a, b) => a.priceUsd - b.priceUsd)[0];
    const basicPerCredit = basic.priceUsd / basic.credits;
    for (const pack of CREDIT_PACKAGES) {
      expect(pack.priceUsd / pack.credits, pack.name).toBeGreaterThan(basicPerCredit);
    }
  });

  it("gives new users enough for one video on the default model, for under $0.50 of KIE cost", () => {
    expect(NEW_USER_GIFT.credits).toBeGreaterThanOrEqual(calculateModelCredits("veo-3.1", { duration: 8, quality: "720p" }));
    expect(NEW_USER_GIFT.credits * MAX_VIDEO_COST_PER_CREDIT_USD).toBeLessThanOrEqual(0.5);
  });
});
