import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const THEME_PATH = resolve(process.cwd(), "src/styles/theme.css");
const css = readFileSync(THEME_PATH, "utf8");

/** Read a `--du-*` custom property that holds a 6-digit hex color. */
function readHexVar(name: string): string {
  const pattern = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`);
  const match = css.match(pattern);
  if (!match?.[1]) {
    throw new Error(`Could not find a hex value for --${name} in ${THEME_PATH}`);
  }
  return match[1].toLowerCase();
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    Number.parseInt(h.slice(0, 2), 16) / 255,
    Number.parseInt(h.slice(2, 4), 16) / 255,
    Number.parseInt(h.slice(4, 6), 16) / 255,
  ];
}

/** WCAG 2.x sRGB linearization. */
function linearize(channel: number): number {
  return channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(linearize) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two hex colors. */
function contrast(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("Mystic Universe theme contrast", () => {
  const accent = readHexVar("du-accent");
  const accentHover = readHexVar("du-accent-hover");
  const onAccent = readHexVar("du-on-accent");
  const bg = readHexVar("du-bg");
  const text = readHexVar("du-text");

  it("uses the Mystic Universe accent and background", () => {
    expect(accent).toBe("#66fcf1");
    expect(bg).toBe("#000000");
  });

  it("keeps on-accent text readable on the accent button", () => {
    expect(contrast(onAccent, accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps on-accent text readable on the accent-hover button", () => {
    expect(contrast(onAccent, accentHover)).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps body text readable on the background", () => {
    expect(contrast(text, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("computes WCAG contrast ratios correctly (black on white = 21)", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
  });
});
