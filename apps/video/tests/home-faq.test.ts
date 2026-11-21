import { describe, expect, it } from "vitest";

import { LEGAL_CONFIG } from "@/config/legal";
import { CREDIT_PACKAGES, NEW_USER_GIFT, SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";
import { homeFaqs } from "@/lib/home-faq";
import { PRICING_UNITS, cheapestUnit } from "@/lib/pricing-units";

const en = homeFaqs(false);
const zh = homeFaqs(true);
const answer = (faqs: typeof en, about: RegExp) => faqs.find((faq) => about.test(faq.q))?.a ?? "";

describe("homepage questions", () => {
  it("asks eight to ten questions, the same ones in both languages", () => {
    expect(en.length).toBeGreaterThanOrEqual(8);
    expect(en.length).toBeLessThanOrEqual(10);
    expect(zh.length).toBe(en.length);
  });

  it("phrases every entry as a question with a real answer", () => {
    for (const faq of [...en, ...zh]) {
      expect(faq.q).toMatch(/[?？]$/);
      expect(faq.a.length).toBeGreaterThan(20);
      expect(faq.a).not.toMatch(/undefined|NaN|null/);
    }
  });

  it("covers what people search for: free, cost, models, commercial use", () => {
    const questions = en.map((faq) => faq.q.toLowerCase()).join(" | ");
    for (const topic of ["free", "cost", "models", "commercially", "refund", "sound", "photo"]) {
      expect(questions).toContain(topic);
    }
  });

  it("quotes the free credits and what they cover from the config", () => {
    const free = answer(en, /free/i);
    const cheapVideo = cheapestUnit("video");
    expect(free).toContain(`${NEW_USER_GIFT.credits} free credits`);
    expect(free).toContain(`${NEW_USER_GIFT.validDays} days`);
    expect(cheapVideo).toBeDefined();
    if (cheapVideo && cheapVideo.credits <= NEW_USER_GIFT.credits) {
      expect(free).toContain(cheapVideo.name);
      expect(free).toContain(`${cheapVideo.credits} credits`);
    }
    // It must not promise a video the free credits cannot pay for.
    for (const unit of PRICING_UNITS.filter((item) => item.kind === "video" && item.credits > NEW_USER_GIFT.credits)) {
      expect(free).not.toContain(`${unit.name} video`);
    }
    expect(answer(zh, /免费/)).toContain(`${NEW_USER_GIFT.credits} 积分`);
  });

  it("names every video model the free credits pay for, so it never says they all need a plan", () => {
    const freeEn = answer(en, /free/i);
    const freeZh = answer(zh, /免费/);
    const affordable = PRICING_UNITS.filter((unit) => unit.kind === "video" && unit.credits > 0 && unit.credits <= NEW_USER_GIFT.credits);
    for (const unit of affordable) {
      expect(freeEn).toContain(`${unit.name} video`);
      expect(freeEn).toContain(`${unit.credits} credits`);
      expect(freeZh).toContain(`${unit.name} 视频`);
    }
    // The old wording claimed every other model needed a plan.
    expect(freeEn).not.toMatch(/other video models/i);
    expect(freeZh).not.toContain("其他视频模型");
    if (PRICING_UNITS.some((unit) => unit.kind === "video" && unit.credits > NEW_USER_GIFT.credits)) {
      expect(freeEn).toContain(`more than ${NEW_USER_GIFT.credits} credits a clip`);
    }
  });

  it("quotes prices from the plans and packs on sale", () => {
    const cost = answer(en, /cost/i);
    const plan = SUBSCRIPTION_PRODUCTS.filter((item) => item.enabled !== false && item.period === "month").sort((a, b) => a.priceUsd - b.priceUsd)[0];
    const pack = CREDIT_PACKAGES.filter((item) => item.enabled !== false).sort((a, b) => a.priceUsd - b.priceUsd)[0];
    const veo = PRICING_UNITS.find((unit) => unit.id === "veo-3.1");
    expect(cost).toContain(`US$${plan.priceUsd} a month for ${plan.credits.toLocaleString("en-US")} credits`);
    expect(cost).toContain(`US$${pack.priceUsd} for ${pack.credits.toLocaleString("en-US")}`);
    expect(cost).toContain(`Veo 3.1 (${veo?.spec.en}) costs ${veo?.credits} credits`);
  });

  it("names only models that are in the pricing table", () => {
    const models = answer(en, /which ai video models/i);
    for (const unit of PRICING_UNITS) expect(models).toContain(unit.name);
    // The starter template's answers named a model that cannot generate here.
    for (const faq of [...en, ...zh]) expect(faq.a).not.toContain("Sora");
  });

  it("gives the refund window from the legal config", () => {
    expect(answer(en, /refund/i)).toContain(`${LEGAL_CONFIG.refundWindowDays} days`);
    expect(answer(zh, /退款/)).toContain(`${LEGAL_CONFIG.refundWindowDays} 天`);
  });

  it("does not repeat the starter template's claims", () => {
    for (const faq of [...en, ...zh]) {
      expect(faq.a).not.toMatch(/24\/7|7x24|Team plan|团队版|satisfaction guarantee|满意度保证/);
    }
  });
});
