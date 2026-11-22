import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { HOME_SEO } from "@/lib/home-seo";
import { LIMITS, displayWidth } from "@/lib/site-check";

const SUFFIX = " | aivd.ai";

describe("homepage title, description and H1", () => {
  // Pinned on purpose: once the homepage has search traffic, changing the
  // title or the H1 makes search engines rank it afresh. Change these only as
  // a decision, and the test with them.
  it("are the agreed ones", () => {
    expect(HOME_SEO.en.title).toBe("AI Video Generator with Sound, from Text or Images");
    expect(HOME_SEO.en.h1).toBe("AI Video Generator — Turn Dreams into Reality");
    expect(HOME_SEO.zh.title).toBe("AI 视频生成器：文字或图片生成有声视频");
    expect(HOME_SEO.zh.h1).toBe("AI视频生成器 把梦想照进现实");
  });

  it("lead with the main keyword and fit a search result", () => {
    for (const copy of [HOME_SEO.en, HOME_SEO.zh]) {
      expect(copy.title.toLowerCase()).toMatch(/^ai (video generator|视频生成器)/);
      expect(copy.h1.toLowerCase()).toMatch(/^ai\s?(video generator|视频生成器)/);
      expect(displayWidth(copy.title + SUFFIX)).toBeLessThanOrEqual(LIMITS.title[1]);
      expect(displayWidth(copy.description)).toBeGreaterThanOrEqual(LIMITS.description[0]);
      expect(displayWidth(copy.description)).toBeLessThanOrEqual(LIMITS.description[1]);
    }
  });

  it("are what the page renders", () => {
    const hero = readFileSync(resolve(__dirname, "../src/components/hf/du-home.tsx"), "utf8");
    const page = readFileSync(resolve(__dirname, "../src/app/[locale]/(marketing)/page.tsx"), "utf8");
    expect(hero).toContain("homeSeo(");
    expect(page).toContain("HOME_SEO.en.title");
    // One H1 on the homepage.
    expect(hero.match(/<h1\b/g)?.length).toBe(1);
  });

  it("claim only what the site does", () => {
    const hero = readFileSync(resolve(__dirname, "../src/components/hf/du-home.tsx"), "utf8");
    // There is no caption or subtitle feature to promise.
    expect(hero).not.toMatch(/subtitles|字幕/);
    for (const copy of [HOME_SEO.en, HOME_SEO.zh]) {
      expect(`${copy.title} ${copy.description} ${copy.h1}`).not.toMatch(/free|免费|unlimited|无限|no sign|免登录|Sora/i);
    }
  });
});
