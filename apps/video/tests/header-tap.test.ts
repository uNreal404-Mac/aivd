import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const source = fs.readFileSync(
  path.join(root, "src/components/landing/header.tsx"),
  "utf8"
);

const marker = 'data-testid="mobile-header"';
const startIndex = source.indexOf(marker);
const mobile = source
  .slice(startIndex)
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const tags =
  mobile.match(
    /<(LocaleLink|a|button|Button|AccordionTrigger)\b[\s\S]*?(?<!=)>/g
  ) ?? [];

describe("mobile header tap targets", () => {
  it("marks the mobile block with a test id", () => {
    expect(startIndex).toBeGreaterThan(-1);
  });

  it("finds clickable elements in the mobile block", () => {
    expect(tags.length).toBeGreaterThan(0);
  });

  it("gives every clickable element a 44px minimum target", () => {
    for (const tag of tags) {
      expect(tag).toContain("min-h-11");
      if (!tag.startsWith("<AccordionTrigger")) {
        expect(tag).toContain("min-w-11");
      }
    }
  });

  it("adds no hard-coded colours", () => {
    expect(mobile).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });
});
