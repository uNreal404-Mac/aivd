import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { CREATIVE_SKILL_CATEGORIES, CREATIVE_SKILLS, skillsFor } from "@/lib/creative-skills";

describe("creative space skills", () => {
  it("gives every category at least one skill", () => {
    for (const category of CREATIVE_SKILL_CATEGORIES) {
      expect(skillsFor(category.id).length).toBeGreaterThan(0);
    }
  });

  it("uses unique ids and fills both languages", () => {
    expect(new Set(CREATIVE_SKILLS.map((item) => item.id)).size).toBe(CREATIVE_SKILLS.length);
    for (const item of CREATIVE_SKILLS) {
      for (const field of [item.title, item.description, item.brief]) {
        expect(field.zh.trim()).not.toBe("");
        expect(field.en.trim()).not.toBe("");
      }
    }
  });

  it("points every card at an image that ships in public/", () => {
    for (const item of CREATIVE_SKILLS) {
      expect(existsSync(path.join(process.cwd(), "public", item.image)), item.image).toBe(true);
    }
  });
});
