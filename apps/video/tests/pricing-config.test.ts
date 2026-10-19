import { describe, expect, it } from "vitest";

import {
  CREDITS_CONFIG,
  calculateModelCredits,
  getModelConfig,
  getOnetimeProducts,
  getSubscriptionProducts,
} from "@/config/credits";
import { yearlySavingsPercent } from "@/components/pricing/pricing-data";

/**
 * Guards the numbers the public /pricing page derives from config, so a
 * pricing change in pricing-user.ts shows up here instead of silently
 * changing the page.
 */
describe("/pricing derives its numbers from config", () => {
  it("prices 720p video per second with the server calculator", () => {
    const durations = getModelConfig("seedance-1.5-pro")?.durations ?? [];
    expect(durations.length).toBeGreaterThan(0);
    const perSecond = calculateModelCredits("seedance-1.5-pro", {
      duration: 1,
      quality: "720p",
    });
    expect(perSecond).toBe(4);
    for (const duration of durations) {
      expect(
        calculateModelCredits("seedance-1.5-pro", { duration, quality: "720p" })
      ).toBe(duration * perSecond);
    }
    expect(
      calculateModelCredits("seedance-1.5-pro", { duration: 4, quality: "720p" })
    ).toBe(16);
  });

  it("has USD prices on every plan and pack", () => {
    for (const product of [
      ...getSubscriptionProducts(),
      ...getOnetimeProducts(),
    ]) {
      expect(product.price.currency).toBe("USD");
      expect(product.price.amount).toBeGreaterThan(0);
      expect(product.credits).toBeGreaterThan(0);
    }
  });

  it("keeps the welcome gift small and honest", () => {
    const gift = CREDITS_CONFIG.registerGift;
    const cheapest = calculateModelCredits("seedance-1.5-pro", {
      duration: 4,
      quality: "720p",
    });
    // The page must not imply the gift covers a video.
    expect(gift.amount).toBeLessThan(cheapest);
  });

  it("computes a positive yearly saving from the real plans", () => {
    expect(yearlySavingsPercent(getSubscriptionProducts())).toBeGreaterThan(0);
  });
});
