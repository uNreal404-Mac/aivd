import { describe, expect, it } from "vitest";
import { buildDropdowns } from "@/components/hf/nav-menus";
import { normalize, scoreEntry, searchSite, type SearchEntry } from "@/lib/site-search";

const entry = (over: Partial<SearchEntry>): SearchEntry => ({
  id: over.title ?? "x",
  tab: "models",
  section: "Video models",
  title: "Kling 4.0",
  desc: "",
  href: "/ai/video",
  ...over,
});

describe("site search", () => {
  it("ignores case, spaces and punctuation", () => {
    expect(normalize("GPT-Image 2.6")).toBe("gptimage26");
    expect(scoreEntry(entry({ title: "GPT Image 2.6 Sunburst" }), "gpt image 2.6")).toBeGreaterThan(0);
  });

  it("ranks title matches above keyword and description matches", () => {
    const byTitle = scoreEntry(entry({ title: "Upscale video" }), "upscale");
    const byKeyword = scoreEntry(entry({ title: "视频画质提升", keywords: ["Upscale video"] }), "upscale");
    const byDesc = scoreEntry(entry({ title: "Studio", desc: "upscale anything" }), "upscale");
    expect(byTitle).toBeGreaterThan(byKeyword);
    expect(byKeyword).toBeGreaterThan(byDesc);
    expect(scoreEntry(entry({ title: "Kling" }), "suno")).toBe(0);
  });

  it("groups by section, filters by tab and puts live entries first", () => {
    const entries = [
      entry({ id: "a", title: "Kling 3.0", soon: true }),
      entry({ id: "b", title: "Kling 4.0" }),
      entry({ id: "c", title: "Kling Image 4.0", section: "Image models" }),
      entry({ id: "d", title: "Kling page", tab: "pages", section: "Pages" }),
    ];
    const all = searchSite(entries, "kling");
    expect(all.map((section) => section.section)).toEqual(["Video models", "Image models", "Pages"]);
    expect(all[0].items.map((item) => item.id)).toEqual(["b", "a"]);
    expect(searchSite(entries, "kling", "pages").map((section) => section.section)).toEqual(["Pages"]);
    expect(searchSite(entries, "")).toEqual([]);
  });

  it("builds the nav menus with the same shape in both languages", () => {
    const zh = buildDropdowns(true);
    const en = buildDropdowns(false);
    expect(zh.map((menu) => menu.id)).toEqual(en.map((menu) => menu.id));
    zh.forEach((menu, m) => {
      menu.columns.forEach((column, c) => {
        expect(column.items.map((item) => item.href)).toEqual(en[m].columns[c].items.map((item) => item.href));
      });
    });
  });
});
