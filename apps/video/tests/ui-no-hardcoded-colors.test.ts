import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards against hardcoded colors in the app/UI source under src/app and
// src/components. --du-* tokens are defined in src/styles/theme.css and
// src/styles/*-tokens.css, which are intentionally not scanned.
// Use var(--du-*) tokens via Tailwind arbitrary values, e.g.
// bg-[var(--du-surface)] text-[var(--du-text-muted)].

const SCAN_DIRS = ["src/app", "src/components"];
const ALLOWED_EXTENSIONS = [".ts", ".tsx", ".css"];

// Files that are allowed to contain hardcoded colors, mapped to the reason.
const EXCEPTIONS: Record<string, string> = {
  "src/components/ui/icons.tsx":
    "third-party brand logos (Google, GitHub, etc.) must keep their official brand colors",
};

// #hex colors, but only when preceded by a quote, space, colon, comma, ( or [,
// so that URL fragments and id selectors are ignored. The hex part must be
// exactly 3, 4, 6 or 8 characters long.
const HEX_COLOR_RE =
  /(?<=["'\s:,(\[])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})\b/;

const RGB_HSL_RE = /\b(?:rgba?|hsla?)\(/;

const TAILWIND_PALETTE_RE =
  /(?<![\w-])(?:[a-z-]+:)*(?:bg|text|border|from|to|via|ring|ring-offset|fill|stroke|shadow|outline|divide|placeholder|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d{2,3})?(?:\/\d{1,3})?(?![\w-])/;

function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

function walk(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) {
    return results;
  }
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full));
    } else if (entry.isFile()) {
      results.push(full);
    }
  }
  return results;
}

function collectSourceFiles(): string[] {
  return SCAN_DIRS.flatMap((dir) => walk(path.join(process.cwd(), dir)))
    .map((full) => toPosix(path.relative(process.cwd(), full)))
    .filter((rel) => ALLOWED_EXTENSIONS.includes(path.extname(rel)))
    .filter((rel) => !(rel in EXCEPTIONS))
    .sort();
}

function hasHardcodedColor(line: string): boolean {
  return (
    HEX_COLOR_RE.test(line) ||
    RGB_HSL_RE.test(line) ||
    TAILWIND_PALETTE_RE.test(line)
  );
}

describe("ui hardcoded colors", () => {
  it("no hardcoded colors in src/app or src/components", () => {
    const offenders: string[] = [];

    for (const rel of collectSourceFiles()) {
      const contents = fs.readFileSync(path.join(process.cwd(), rel), "utf8");
      contents.split(/\r?\n/).forEach((line, index) => {
        if (hasHardcodedColor(line)) {
          offenders.push(`${rel}:${index + 1}: ${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });

  it("exceptions only list existing files", () => {
    const missing = Object.keys(EXCEPTIONS).filter(
      (rel) => !fs.existsSync(path.join(process.cwd(), rel)),
    );

    expect(missing).toEqual([]);
  });
});
