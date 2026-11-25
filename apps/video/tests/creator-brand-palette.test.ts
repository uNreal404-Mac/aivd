import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const readCss = (path: string) => postcss.parse(readFileSync(resolve(process.cwd(), "src", path), "utf8"));

describe("creator brand palette", () => {
  it("inherits the same brand controls in the homepage, studios, and their portals", () => {
    const theme = readCss("styles/theme.css");
    const overrides: string[] = [];
    theme.walkRules((rule) => {
      if (!/\.(du-hero|hmp-backdrop|is-root|vst-root|au-root|is-draw-dialog|vst-menu|au-pop|au-vpicker)\b/.test(rule.selector)) return;
      rule.walkDecls(/^--du-(?:accent(?:-.+)?|on-accent)$/, (decl) => { overrides.push(rule.selector + " " + decl.prop); });
    });
    expect(overrides).toEqual([]);
  });

  it.each([
    ["ai-image-studio.css", ".is-generate"],
    ["ai-video-studio.css", ".vst-generate"],
    ["audio-studio/audio-studio.css", ".au-generate"],
  ])("draws the primary button in %s with the shared solid accent", (file, button) => {
    const css = readCss("components/hf/" + file);
    let fill: string | undefined;
    let ink: string | undefined;
    css.walkRules((rule) => {
      if (!rule.selectors.includes(button)) return;
      rule.walkDecls("background", (decl) => { fill = decl.value; });
      rule.walkDecls("color", (decl) => { ink = decl.value; });
    });
    expect(fill).toBe("var(--du-accent)");
    expect(ink).toBe("var(--du-on-accent)");
  });
});
