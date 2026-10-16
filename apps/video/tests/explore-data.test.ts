import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  CATEGORY_LABELS,
  EXPLORE_CATEGORIES,
  EXPLORE_ITEMS,
  EXPLORE_MODELS,
  buildUsePromptHref,
  copyFor,
  filterExplore,
} from "../src/lib/explore-data";

const projectRoot = process.cwd();
const dataPath = path.join(projectRoot, "src/lib/explore-data.ts");
const cssPath = path.join(projectRoot, "src/styles/explore-tokens.css");
const galleryPath = path.join(
  projectRoot,
  "src/components/explore/explore-gallery.tsx",
);

describe("explore data", () => {
  it("has 24 items with unique ids", () => {
    expect(EXPLORE_ITEMS).toHaveLength(24);
    const ids = EXPLORE_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses a valid category for every item and covers every category", () => {
    const valid = EXPLORE_CATEGORIES.filter((c) => c !== "all");
    for (const item of EXPLORE_ITEMS) {
      expect(valid).toContain(item.category);
    }
    for (const category of valid) {
      expect(filterExplore(EXPLORE_ITEMS, category).length).toBeGreaterThan(0);
    }
  });

  it("points every item at an existing image in public", () => {
    for (const item of EXPLORE_ITEMS) {
      const file = path.join(projectRoot, "public", item.image);
      expect(existsSync(file), `missing ${item.image}`).toBe(true);
    }
  });

  it("uses only the four backend model ids", () => {
    const backendIds = ["seedance-1.5-pro", "wan2.6", "veo-3.1", "sora-2"];
    expect(EXPLORE_MODELS.map((m) => m.id)).toEqual(backendIds);
    const allowed = EXPLORE_MODELS.map((m) => m.id);
    for (const item of EXPLORE_ITEMS) {
      expect(allowed).toContain(item.modelId);
    }
  });
});

describe("filterExplore", () => {
  it("returns everything for all", () => {
    expect(filterExplore(EXPLORE_ITEMS, "all")).toHaveLength(24);
  });

  it("returns only matching items for one category", () => {
    const result = filterExplore(EXPLORE_ITEMS, "cinematic");
    expect(result.length).toBeGreaterThan(0);
    for (const item of result) {
      expect(item.category).toBe("cinematic");
    }
  });
});

describe("buildUsePromptHref", () => {
  it("encodes both the prompt and the model", () => {
    const item = EXPLORE_ITEMS[0];
    expect(buildUsePromptHref("en", item)).toBe(
      `/en/ai/video?prompt=${encodeURIComponent(
        item.prompt,
      )}&model=${encodeURIComponent(item.modelId)}`,
    );
    expect(buildUsePromptHref("zh", item).startsWith("/zh/ai/video?")).toBe(true);
  });
});

describe("labels and copy", () => {
  it("has zh and en labels for every category", () => {
    for (const category of EXPLORE_CATEGORIES) {
      expect(CATEGORY_LABELS[category].en.length).toBeGreaterThan(0);
      expect(CATEGORY_LABELS[category].zh.length).toBeGreaterThan(0);
    }
  });

  it("falls back to en for unknown locales", () => {
    expect(copyFor("zh")).toBe(copyFor("zh"));
    expect(copyFor("fr")).toBe(copyFor("en"));
    expect(copyFor("zh").heading).not.toBe(copyFor("en").heading);
  });
});

describe("content hygiene", () => {
  it("does not mention third-party brand names", () => {
    const text = readFileSync(dataPath, "utf8").toLowerCase();
    expect(text).not.toContain("higgsfield");
  });

  it("defines every used --ex-* token and ships the @supports fallback", () => {
    const css = readFileSync(cssPath, "utf8");
    expect(css).toContain("@supports not");

    if (existsSync(galleryPath)) {
      const gallery = readFileSync(galleryPath, "utf8");
      const used = new Set(gallery.match(/--ex-[a-z0-9-]+/gi) ?? []);
      for (const token of used) {
        expect(css, `missing ${token}`).toContain(token);
      }
    }
  });
});
