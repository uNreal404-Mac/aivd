import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  CATEGORY_LABELS,
  EFFECT_CATEGORIES,
  EFFECT_TEMPLATES,
  PRESET_ID_PATTERN,
  copyFor,
  filterEffects,
  labelFor,
  useHref,
} from "../src/lib/effects-data";

const NON_ALL_CATEGORIES = EFFECT_CATEGORIES.filter(
  (category) => category !== "all",
);

const CJK_PATTERN = /[\u3400-\u9FFF\uF900-\uFAFF]/;
const IMAGE_PATTERN = /^\/effects\/effect-\d{2}\.webp$/;
const COUNT_KEYS = ["likes", "uses", "views", "count"];

// Resolve files relative to the app root regardless of the runner's cwd.
function resolveRepoFile(relativePath: string): string | null {
  const candidates = [
    join(process.cwd(), relativePath),
    join(process.cwd(), "apps", "video", relativePath),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

const tokensPath = resolveRepoFile("src/styles/effects-tokens.css");

describe("EFFECT_TEMPLATES", () => {
  it("contains exactly 16 templates", () => {
    expect(EFFECT_TEMPLATES).toHaveLength(16);
  });

  it("has unique ids that all match PRESET_ID_PATTERN", () => {
    const ids = EFFECT_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(PRESET_ID_PATTERN);
    }
  });

  it("only uses known non-all categories", () => {
    for (const template of EFFECT_TEMPLATES) {
      expect(NON_ALL_CATEGORIES).toContain(template.category);
    }
  });

  it("has at least two templates in every category", () => {
    for (const category of NON_ALL_CATEGORIES) {
      const count = EFFECT_TEMPLATES.filter(
        (template) => template.category === category,
      ).length;
      expect(count).toBeGreaterThanOrEqual(2);
    }
  });

  it("marks at most three templates as new", () => {
    const newCount = EFFECT_TEMPLATES.filter(
      (template) => template.badge === "new",
    ).length;
    expect(newCount).toBeLessThanOrEqual(3);
  });

  it("provides English and Chinese names and descriptions", () => {
    for (const template of EFFECT_TEMPLATES) {
      expect(template.name.en.trim().length).toBeGreaterThan(0);
      expect(template.name.zh.trim().length).toBeGreaterThan(0);
      expect(template.description.en.trim().length).toBeGreaterThan(0);
      expect(template.description.zh.trim().length).toBeGreaterThan(0);
      expect(template.name.zh).toMatch(CJK_PATTERN);
      expect(template.description.zh).toMatch(CJK_PATTERN);
    }
  });

  it("provides an English prompt for every template", () => {
    for (const template of EFFECT_TEMPLATES) {
      expect(template.prompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("does not invent count or engagement fields", () => {
    for (const template of EFFECT_TEMPLATES) {
      const keys = Object.keys(template);
      for (const key of COUNT_KEYS) {
        expect(keys).not.toContain(key);
      }
    }
  });

  it("does not reference third-party brand names", () => {
    const serialized = JSON.stringify(EFFECT_TEMPLATES).toLowerCase();
    expect(serialized).not.toContain("higgsfield");
  });
});

describe("effect images", () => {
  it("uses a stable public path for every template", () => {
    for (const template of EFFECT_TEMPLATES) {
      expect(template.image).toMatch(IMAGE_PATTERN);
    }
  });

  it("references images that exist in public", () => {
    const effectsDir = resolveRepoFile("public/effects");
    if (!effectsDir) {
      return;
    }
    for (const template of EFFECT_TEMPLATES) {
      const file = join(
        effectsDir,
        template.image.replace(/^\/effects\//, ""),
      );
      expect(existsSync(file)).toBe(true);
    }
  });
});

describe("useHref", () => {
  it("encodes preset and prompt for the studio", () => {
    const template = EFFECT_TEMPLATES[0];
    const href = useHref("en", template);
    expect(href.startsWith("/en/ai/video?preset=")).toBe(true);
    expect(href).toContain(`preset=${encodeURIComponent(template.id)}`);
    expect(href).toContain(`prompt=${encodeURIComponent(template.prompt)}`);
  });
});

describe("filterEffects", () => {
  it("returns every template for the all category", () => {
    expect(filterEffects(EFFECT_TEMPLATES, "all")).toHaveLength(
      EFFECT_TEMPLATES.length,
    );
  });

  it("filters down to a single category", () => {
    const result = filterEffects(EFFECT_TEMPLATES, "camera");
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((template) => template.category === "camera")).toBe(
      true,
    );
  });
});

describe("copy helpers", () => {
  it("defines labels for every category in both locales", () => {
    for (const category of EFFECT_CATEGORIES) {
      expect(CATEGORY_LABELS[category].en.trim().length).toBeGreaterThan(0);
      expect(CATEGORY_LABELS[category].zh.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns Chinese copy for zh and English otherwise", () => {
    expect(copyFor("zh").use).toBe("使用");
    expect(copyFor("en").use).toBe("Use");
    expect(copyFor("fr").use).toBe("Use");
  });

  it("labels localized text for the requested locale", () => {
    expect(labelFor({ en: "Effects", zh: "特效" }, "zh")).toBe("特效");
    expect(labelFor({ en: "Effects", zh: "特效" }, "en")).toBe("Effects");
  });
});

describe("effects tokens", () => {
  it("ships a tokens stylesheet with the glass button fallback", () => {
    expect(tokensPath).not.toBeNull();
    const css = readFileSync(tokensPath as string, "utf8");
    expect(css).toContain("@supports not");
    expect(css).toContain(".fx-glass-btn");
  });

  it("defines every --fx-* variable used by the gallery", () => {
    const galleryPath = resolveRepoFile(
      "src/components/effects/effects-gallery.tsx",
    );
    if (!galleryPath) {
      return;
    }
    const css = tokensPath ? readFileSync(tokensPath, "utf8").toLowerCase() : "";
    const gallery = readFileSync(galleryPath, "utf8");

    const used = new Set<string>();
    const pattern = /var\(\s*(--fx-[a-z0-9-]+)/gi;
    for (const match of gallery.matchAll(pattern)) {
      used.add(match[1].toLowerCase());
    }

    expect(used.size).toBeGreaterThan(0);
    for (const name of used) {
      expect(css).toContain(`${name}:`);
    }
  });
});
