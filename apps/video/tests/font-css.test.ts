import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const readSource = (relativePath: string) =>
  readFileSync(path.join(root, relativePath), "utf8");

const layoutSource = readSource("src/app/layout.tsx");
const globalsCss = readSource("src/styles/globals.css");

describe("font loading", () => {
  it("uses font-display swap for every configured font", () => {
    const swaps = layoutSource.match(/display:\s*"swap"/g) ?? [];
    expect(swaps.length).toBeGreaterThanOrEqual(3);
  });

  it("does not preload the local display font", () => {
    const localFontBlock = layoutSource.match(/localFont\(\{[\s\S]*?\}\)/)?.[0];
    expect(localFontBlock).toBeDefined();
    expect(localFontBlock).toContain("preload: false");
  });

  it("does not reference fonts.googleapis.com", () => {
    expect(layoutSource).not.toContain("fonts.googleapis.com");
  });
});

describe("tailwind css source scanning", () => {
  it("scopes content detection to src", () => {
    expect(globalsCss).toContain('@import "tailwindcss" source("../");');
  });
});
