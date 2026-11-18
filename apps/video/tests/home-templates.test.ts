import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  HOME_TEMPLATE_CATEGORIES,
  HOME_TEMPLATES,
  templatesFor,
} from "@/lib/home-templates";

describe("home templates", () => {
  it("has unique ids", () => {
    const ids = HOME_TEMPLATES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("points every template at an image that exists", () => {
    for (const item of HOME_TEMPLATES) {
      const file = path.join(process.cwd(), "public", item.image);
      expect(fs.existsSync(file), item.image).toBe(true);
    }
  });

  it("has a title and a usable prompt in both languages", () => {
    for (const item of HOME_TEMPLATES) {
      for (const lang of ["zh", "en"] as const) {
        expect(item.title[lang].trim(), `${item.id} title ${lang}`).not.toBe("");
        expect(item.prompt[lang].trim().length, `${item.id} prompt ${lang}`).toBeGreaterThan(20);
        expect(item.prompt[lang].length, `${item.id} prompt ${lang}`).toBeLessThanOrEqual(2000);
      }
    }
  });

  it("fills every category so no tab renders an empty grid", () => {
    for (const category of HOME_TEMPLATE_CATEGORIES) {
      expect(templatesFor(category.id).length, category.id).toBeGreaterThanOrEqual(3);
    }
  });
});
