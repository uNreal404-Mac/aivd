import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import * as duHome from "../src/lib/du-home";
import { SUPPORT_EMAIL } from "@/config/site";
import {
  CATEGORY_CARDS,
  CATEGORY_FILTERS,
  EFFECT_CARDS,
  MODEL_CARDS,
  STEPS,
  localizedHref,
} from "../src/lib/du-home";

const projectRoot = path.resolve(__dirname, "..");

const readSource = (relativePath: string): string =>
  fs.readFileSync(path.resolve(projectRoot, relativePath), "utf8");

/** Collects every string value stored under a `href` key, at any depth. */
function collectHrefs(value: unknown, hrefs: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectHrefs(item, hrefs);
    }
    return hrefs;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "href" && typeof child === "string") {
        hrefs.push(child);
      } else {
        collectHrefs(child, hrefs);
      }
    }
  }

  return hrefs;
}

/** Collects every string value stored under an `image` key, at any depth. */
function collectImages(value: unknown, images: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectImages(item, images);
    }
    return images;
  }

  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "image" && typeof child === "string") {
        images.push(child);
      } else {
        collectImages(child, images);
      }
    }
  }

  return images;
}

describe("du-home data", () => {
  it("exposes the expected number of items", () => {
    expect(CATEGORY_CARDS).toHaveLength(8);
    expect(MODEL_CARDS).toHaveLength(4);
    expect(EFFECT_CARDS).toHaveLength(6);
    expect(STEPS).toHaveLength(3);
    expect(CATEGORY_FILTERS).toHaveLength(9);
  });

  it("only tags category cards with known filters", () => {
    for (const card of CATEGORY_CARDS) {
      expect(CATEGORY_FILTERS).toContain(card.category);
    }
  });

  it("never mentions higgsfield", () => {
    expect(JSON.stringify(duHome).toLowerCase()).not.toContain("higgsfield");
  });

  it("ships local /home webp images that exist on disk", () => {
    const images = collectImages(duHome);

    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image.startsWith("/home/")).toBe(true);
      expect(image.endsWith(".webp")).toBe(true);
      expect(
        fs.existsSync(path.resolve(__dirname, "..", "public", image.slice(1))),
      ).toBe(true);
    }
  });

  it("does not reference picsum", () => {
    expect(readSource("src/lib/du-home.ts")).not.toContain("picsum");
  });

  it("only uses allowed hrefs", () => {
    const hrefs = collectHrefs(duHome);

    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      expect(href.startsWith("/") || href.startsWith("#")).toBe(true);
    }
  });
});

describe("localizedHref", () => {
  it("prefixes route hrefs with the locale", () => {
    expect(localizedHref("en", "/pricing")).toBe("/en/pricing");
  });

  it("leaves anchor hrefs untouched", () => {
    expect(localizedHref("en", "#")).toBe("#");
  });
});

describe("du-home styling", () => {
  it("defines every --du-* variable used by the component", () => {
    const css = readSource("src/styles/theme.css");
    const tsx = readSource("src/components/hf/du-home.tsx");

    const used = new Set(
      Array.from(tsx.matchAll(/var\((--du-[a-zA-Z0-9-]+)\)/g)).map(
        (match) => match[1],
      ),
    );

    expect(used.size).toBeGreaterThan(0);
    for (const variable of used) {
      expect(css).toContain(`${variable}:`);
    }
  });

  it("never hardcodes a hex color in the component", () => {
    const tsx = readSource("src/components/hf/du-home.tsx");

    expect(tsx).not.toMatch(/#[0-9a-fA-F]{6}\b/);
  });
});

describe("du-glass styling", () => {
  it("defines every --du-glass-* variable used by the glass styles", () => {
    const css = readSource("src/styles/theme.css");
    const tsx = readSource("src/components/hf/du-home.tsx");

    const used = new Set(
      Array.from(
        `${css}\n${tsx}`.matchAll(/var\((--du-glass-[a-zA-Z0-9-]+)\)/g),
      ).map((match) => match[1]),
    );

    expect(used.size).toBeGreaterThan(0);
    for (const variable of used) {
      expect(css).toContain(`${variable}:`);
    }
  });

  it("declares the full --du-glass-* token surface", () => {
    const css = readSource("src/styles/theme.css");

    const tokens = [
      "--du-glass-blur",
      "--du-glass-saturate",
      "--du-glass-bg",
      "--du-glass-bg-hover",
      "--du-glass-bg-strong",
      "--du-glass-sheen",
      "--du-glass-border",
      "--du-glass-border-hover",
      "--du-glass-highlight",
      "--du-glass-shadow",
      "--du-glass-radius-card",
      "--du-glass-radius-btn",
      "--du-glass-fallback-bg",
      "--du-glass-text",
      "--du-glass-overlay-scrim",
    ];

    for (const token of tokens) {
      expect(css).toContain(`${token}:`);
    }
  });

  it("provides a backdrop-filter fallback", () => {
    const css = readSource("src/styles/theme.css");

    expect(css).toContain("@supports not");
    expect(css).toContain("backdrop-filter");
  });

  it("uses the glass classes in the component", () => {
    const tsx = readSource("src/components/hf/du-home.tsx");

    expect(tsx).toContain("du-glass-btn");
    expect(tsx).toContain("du-glass");
  });
});

describe("site config", () => {
  it("uses the bot inbox as the support address", () => {
    expect(SUPPORT_EMAIL).toBe("tuapi@mail.grokbot.com");
    expect(SUPPORT_EMAIL).not.toContain("example.com");
  });
});

describe("layout", () => {
  it("does not use the vercel analytics packages", () => {
    const source = readSource("src/app/layout.tsx");

    expect(source).not.toContain("@vercel/analytics");
    expect(source).not.toContain("@vercel/speed-insights");
  });
});
