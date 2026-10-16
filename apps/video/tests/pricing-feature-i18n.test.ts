import { describe, expect, it } from "vitest";

import en from "@/messages/en.json";
import zh from "@/messages/zh.json";
import { CREDIT_PACKAGES, SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";

type FeatureDict = Record<string, string>;

/**
 * Every product exported from `@/config/pricing-user` that declares a
 * `features: [...]` list. Keep this in sync when new product arrays are added.
 */
const productsWithFeatures = [...SUBSCRIPTION_PRODUCTS, ...CREDIT_PACKAGES];

const featureKeys = Array.from(
  new Set(productsWithFeatures.flatMap((product) => product.features ?? [])),
).sort();

const enFeatures = (en as unknown as { Credits: { features: FeatureDict } }).Credits.features;
const zhFeatures = (zh as unknown as { Credits: { features: FeatureDict } }).Credits.features;

describe("pricing feature i18n", () => {
  it("pricing-user declares at least one feature key", () => {
    expect(featureKeys.length).toBeGreaterThan(0);
  });

  it.each(featureKeys)(
    "en.Credits.features.%s is a non-empty string",
    (key) => {
      const value = enFeatures[key];
      expect(typeof value).toBe("string");
      expect(value.trim().length).toBeGreaterThan(0);
    },
  );

  it.each(featureKeys)(
    "zh.Credits.features.%s is a non-empty string",
    (key) => {
      const value = zhFeatures[key];
      expect(typeof value).toBe("string");
      expect(value.trim().length).toBeGreaterThan(0);
    },
  );
});
