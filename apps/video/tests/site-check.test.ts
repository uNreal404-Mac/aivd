import { describe, expect, it } from "vitest";

import { checkPage, normalizePath, pageFacts, type CheckContext } from "@/lib/site-check";

const page = ({
  title = "AI Video Generator: Text & Image to Video",
  description = "Make AI videos from text or a photo with Veo 3.1, Seedance 2.5 and Kling 4.0. The credit cost shows before you generate, and failed runs are refunded.",
  canonical = "https://aivd.ai/text-to-video",
  robots = "index, follow",
  h1 = ["Text to Video AI Generator"],
  body = "word ".repeat(700),
  extraHead = "",
} = {}) => `<!DOCTYPE html><html lang="en"><head>
<title>${title}</title>
<meta name="description" content="${description}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">
<link rel="alternate" hreflang="en" href="https://aivd.ai/text-to-video">
<link rel="alternate" hreflang="zh-CN" href="https://aivd.ai/zh/text-to-video">
<link rel="alternate" hreflang="x-default" href="https://aivd.ai/text-to-video">
${extraHead}</head><body>
${h1.map((text) => `<h1>${text}</h1>`).join("")}
<p>${body}</p>
<script>self.__next_f.push([1,"${"payload ".repeat(500)}"])</script>
<a href="/pricing">Pricing</a><a href="https://aivd.ai/zh">中文</a><img src="/a.png"><img src="/b.png" alt="">
</body></html>`;

const context: CheckContext = { path: "/text-to-video", language: "en", home: false, hreflangs: ["en", "zh-CN", "x-default"], preview: false };
const errors = (html: string, ctx: Partial<CheckContext> = {}) =>
  checkPage(pageFacts(html), { ...context, ...ctx }).filter((issue) => issue.level === "error").map((issue) => issue.message);
const warnings = (html: string, ctx: Partial<CheckContext> = {}) =>
  checkPage(pageFacts(html), { ...context, ...ctx }).filter((issue) => issue.level === "warning").map((issue) => issue.message);

describe("pageFacts", () => {
  it("reads the head, headings, visible words, links and images", () => {
    const facts = pageFacts(page());
    expect(facts.title).toBe("AI Video Generator: Text & Image to Video");
    expect(facts.canonical).toBe("https://aivd.ai/text-to-video");
    expect(facts.lang).toBe("en");
    expect(facts.hreflangs).toEqual(["en", "zh-CN", "x-default"]);
    expect(facts.h1).toEqual(["Text to Video AI Generator"]);
    // The RSC payload in <script> is not page text.
    expect(facts.words).toBeGreaterThanOrEqual(700);
    expect(facts.words).toBeLessThan(720);
    expect(facts.links).toEqual(["/pricing", "https://aivd.ai/zh"]);
    expect(facts.imagesWithoutAlt).toBe(1);
  });

  it("finds metadata that Next.js streamed into the body, and ignores an SVG's title", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><script src="/x.js"></script></head><body>
<svg><title>Logo</title></svg><h1>Pricing</h1>
<title>Pricing - Plans &amp; Credits</title><meta name="description" content="Plans and packs.">
<link rel="canonical" href="https://aivd.ai/pricing"><link rel="alternate" hreflang="en" href="https://aivd.ai/pricing">
</body></html>`;
    const facts = pageFacts(html);
    expect(facts.title).toBe("Pricing - Plans & Credits");
    expect(facts.description).toBe("Plans and packs.");
    expect(facts.canonical).toBe("https://aivd.ai/pricing");
    expect(facts.hreflangs).toEqual(["en"]);
  });

  it("counts Chinese by characters", () => {
    const facts = pageFacts(page({ body: "文字生成视频".repeat(10) }));
    expect(facts.cjkChars).toBeGreaterThanOrEqual(60);
  });
});

describe("checkPage", () => {
  it("passes a complete page", () => {
    expect(errors(page())).toEqual([]);
    expect(warnings(page())).toEqual(["1 image(s) without alt"]);
  });

  it("needs exactly one H1", () => {
    expect(errors(page({ h1: [] }))).toContain("no H1");
    expect(errors(page({ h1: ["Text to Video", "Image to Video"] }))[0]).toMatch(/^2 H1s/);
  });

  it("needs a canonical that points to the page itself", () => {
    expect(errors(page({ canonical: "https://aivd.ai/ai/video" }))[0]).toMatch(/canonical points to \/ai\/video/);
  });

  it("flags noindex on a listed page, except on the preview site", () => {
    expect(errors(page({ robots: "noindex, nofollow" }))).toContain("marked noindex but listed in the sitemap");
    expect(errors(page({ robots: "noindex, nofollow" }), { preview: true })).toEqual([]);
  });

  it("warns about thin pages and long titles", () => {
    expect(warnings(page({ body: "word ".repeat(150) })).join(" ")).toMatch(/1\d\d words of text \(aim for 600\+\)/);
    expect(warnings(page({ title: "A".repeat(70) })).join(" ")).toMatch(/title is 70 wide/);
    // Chinese characters count double: 35 of them run past a result's width.
    expect(warnings(page({ title: "文".repeat(35) }), { language: "zh" }).join(" ")).toMatch(/title is 70 wide/);
    expect(warnings(page({ title: "Seedance 2.5 AI 视频生成器 | aivd.ai" }), { language: "zh" }).join(" ")).not.toMatch(/title is/);
    expect(warnings(page(), { home: true }).join(" ")).toMatch(/aim for 800\+/);
  });

  it("ignores the preview site's title suffix", () => {
    const html = page({ title: "AI Video Generator: Text &amp; Image to Video | aivd.ai Preview" });
    expect(warnings(html, { preview: true }).join(" ")).not.toMatch(/title is/);
    const zh = page({ title: "Gemini Omni Flash 1.2 AI 视频生成器 | aivd.ai 预览站" });
    expect(warnings(zh, { preview: true, language: "zh" }).join(" ")).not.toMatch(/title is/);
  });

  it("warns when the title and the H1 share no keyword", () => {
    expect(warnings(page({ h1: ["Direct every frame"] })).join(" ")).toMatch(/share no keyword/);
  });
});

describe("normalizePath", () => {
  it("compares paths, not hosts or trailing slashes", () => {
    expect(normalizePath("https://aivd-preview.pages.dev/zh/pricing/")).toBe("/zh/pricing");
    expect(normalizePath("/")).toBe("/");
  });
});
