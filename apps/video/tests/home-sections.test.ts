import { describe, expect, it } from "vitest";

import {
  ASSISTANT_ROLES,
  COMMUNITY_PROJECTS,
  VFX_PRESETS,
  duplicateForMarquee,
  gradientFor,
} from "../src/lib/home-sections";

describe("home section data", () => {
  it("exposes 15 presets with unique ids", () => {
    expect(VFX_PRESETS).toHaveLength(15);

    const ids = VFX_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(VFX_PRESETS.length);
  });

  it("exposes 8 community projects with unique ids", () => {
    expect(COMMUNITY_PROJECTS).toHaveLength(8);

    const ids = COMMUNITY_PROJECTS.map((project) => project.id);
    expect(new Set(ids).size).toBe(COMMUNITY_PROJECTS.length);
    expect(
      COMMUNITY_PROJECTS.every((project) => project.author === "Studio"),
    ).toBe(true);
  });

  it("exposes 4 unique assistant roles", () => {
    expect(ASSISTANT_ROLES).toHaveLength(4);
    expect(new Set(ASSISTANT_ROLES).size).toBe(ASSISTANT_ROLES.length);
  });
});

describe("duplicateForMarquee", () => {
  it("doubles the length and keeps the original order", () => {
    const doubled = duplicateForMarquee(VFX_PRESETS);

    expect(doubled).toHaveLength(VFX_PRESETS.length * 2);
    expect(doubled.slice(0, VFX_PRESETS.length)).toEqual(VFX_PRESETS);
    expect(doubled.slice(VFX_PRESETS.length)).toEqual(VFX_PRESETS);
  });

  it("does not mutate the input", () => {
    const input = ["a", "b"];
    expect(duplicateForMarquee(input)).toEqual(["a", "b", "a", "b"]);
    expect(input).toEqual(["a", "b"]);
  });
});

describe("gradientFor", () => {
  it("cycles through the gradient list", () => {
    expect(gradientFor(0)).toBe(gradientFor(6));
    expect(gradientFor(0)).not.toBe(gradientFor(1));
  });

  it("uses only token variables", () => {
    for (let index = 0; index < 12; index += 1) {
      const value = gradientFor(index);

      expect(value).toContain("var(--hfh-");
      expect(value).not.toContain("#");
      expect(value).not.toContain("rgb");
    }
  });
});
