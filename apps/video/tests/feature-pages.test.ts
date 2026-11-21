import { describe, expect, it } from "vitest";

import { NEW_USER_GIFT } from "@/config/pricing-user";
import { featureCopy, type FeatureCopy, type FeatureKind } from "@/lib/feature-pages";
import { MAX_BYTES } from "@/lib/image-to-video";
import { PRICING_UNITS } from "@/lib/pricing-units";
import { LIMITS, displayWidth } from "@/lib/site-check";

const KINDS: FeatureKind[] = ["text-to-video", "image-to-video", "reference-to-video", "audio"];
/** The search each page answers, in English, and its Chinese H1. */
const KEYWORD: Record<FeatureKind, { en: string; zh: string }> = {
  "text-to-video": { en: "text to video ai", zh: "AI 文字生成视频" },
  "image-to-video": { en: "image to video ai", zh: "AI 图片生成视频" },
  "reference-to-video": { en: "reference to video ai", zh: "AI 参考图生成视频" },
  audio: { en: "ai text to speech", zh: "AI 文字转语音" },
};
const SUFFIX = " | aivd.ai";

/** All the text the feature section puts on the page. */
function allText(copy: FeatureCopy): string {
  return [
    copy.h1,
    ...copy.intro,
    copy.stepsTitle,
    ...copy.steps.flatMap((step) => [step.title, step.body]),
    copy.tipsTitle,
    ...copy.tips.flatMap((tip) => [tip.title, tip.body]),
    copy.useCasesTitle ?? "",
    ...(copy.useCases ?? []).flatMap((item) => [item.title, item.body]),
    copy.examplesTitle,
    copy.examplesIntro,
    ...copy.examples.flatMap((example) => [example.title, example.prompt]),
    copy.modelsTitle,
    copy.modelsIntro,
    ...copy.models.map((model) => `${model.name} ${model.spec} ${model.credits}`),
    copy.faqTitle,
    ...copy.faqs.flatMap((faq) => [faq.q, faq.a]),
  ].join(" ");
}

describe.each(KINDS)("%s page copy", (kind) => {
  const en = featureCopy(kind, false);
  const zh = featureCopy(kind, true);

  it("names the search it answers in the title, the H1 and the first paragraph", () => {
    const keyword = KEYWORD[kind].en;
    expect(en.title.toLowerCase()).toContain(keyword);
    expect(en.h1.toLowerCase()).toBe(keyword);
    expect(en.intro[0].toLowerCase()).toContain(keyword);
    expect(zh.h1).toBe(KEYWORD[kind].zh);
    expect(zh.title).toContain(zh.h1);
  });

  it("keeps titles and descriptions inside a search result's width", () => {
    for (const copy of [en, zh]) {
      expect(displayWidth(copy.title + SUFFIX)).toBeLessThanOrEqual(LIMITS.title[1]);
      expect(displayWidth(copy.description)).toBeGreaterThanOrEqual(LIMITS.description[0]);
      expect(displayWidth(copy.description)).toBeLessThanOrEqual(LIMITS.description[1]);
    }
  });

  it("has enough text to answer the search (600+ words, 1000+ Chinese characters)", () => {
    expect(allText(en).split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(LIMITS.en.pageWords);
    expect((allText(zh).match(/[㐀-鿿]/g) ?? []).length).toBeGreaterThanOrEqual(LIMITS.zh.pageWords);
  });

  it("quotes prices and limits from the config", () => {
    for (const model of en.models) {
      const unit = PRICING_UNITS.find((item) => item.name === model.name);
      expect(unit?.credits).toBe(model.credits);
    }
    const free = en.faqs.find((faq) => /free/i.test(faq.q))?.a ?? "";
    expect(free).toContain(`${NEW_USER_GIFT.credits} free credits`);
    // Never promises a model the free credits cannot pay for.
    for (const unit of PRICING_UNITS.filter((item) => item.kind === "video" && item.credits > NEW_USER_GIFT.credits)) {
      expect(free).not.toContain(`${unit.name} (`);
    }
    if (kind === "image-to-video" || kind === "reference-to-video") {
      expect(allText(en)).toContain(`${Math.round(MAX_BYTES / 1024 / 1024)} MB`);
    }
  });

  it("makes no promise the site cannot keep", () => {
    for (const copy of [en, zh]) {
      const text = allText(copy);
      expect(text).not.toMatch(/no sign[- ]?up|without (login|sign)|unlimited|no watermark on free|Sora|免登录|无限/i);
    }
  });

  it("links to the related pages and to live model pages", () => {
    expect(en.related.map((link) => link.href)).toContain("/");
    expect(en.related.map((link) => link.href)).toContain(kind === "text-to-video" ? "/image-to-video" : "/text-to-video");
    expect(en.related.map((link) => link.href)).not.toContain(`/${kind}`);
    expect(en.models.length).toBeGreaterThanOrEqual(kind === "reference-to-video" ? 1 : 3);
    if (kind === "text-to-video" || kind === "image-to-video") expect(en.models.filter((model) => model.href).length).toBeGreaterThan(2);
    expect(en.faqs.length).toBeGreaterThanOrEqual(6);
    expect(zh.faqs.length).toBe(en.faqs.length);
  });
});

describe("example prompts", () => {
  it("open the generator only where it takes a prompt", () => {
    expect(featureCopy("audio", false).tryable).toBe(false);
    for (const kind of ["text-to-video", "image-to-video", "reference-to-video"] as const) expect(featureCopy(kind, false).tryable).toBe(true);
  });
});
