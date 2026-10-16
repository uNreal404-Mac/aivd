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
    const css = readSource("src/styles/du-home-tokens.css");
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

describe("site config", () => {
  it("uses the bot inbox as the support address", () => {
    expect(SUPPORT_EMAIL).toBe("tuapi@mail.grokbot.com");
    expect(SUPPORT_EMAIL).not.toContain("example.com");
  });
});
