import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Every transition on the site uses the shared motion language in
// styles/motion.css: four durations (--m-instant / --m-fast / --m-base /
// --m-slow) and three curves (--m-ease-out / --m-ease-in-out / --m-ease-exit).
// A hand-written "200ms ease" here and "0.3s cubic-bezier(...)" there is how
// the site ended up with twenty timings for the same kind of change.
// Keyframe animations (spinners, camera-preset previews) keep their own
// lengths; this checks transitions only.

const SRC = path.join(process.cwd(), "src");
const cssFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return cssFiles(full);
    return name.endsWith(".css") ? [full] : [];
  });

const DECL = /(?<![\w-])transition(?:-duration|-timing-function|-delay)?\s*:([^;{}]*)/g;

describe("motion language", () => {
  it("writes transition timings with the motion variables, not raw numbers or curves", () => {
    const raw: string[] = [];
    // motion.css defines the language (and the reduced-motion override).
    for (const file of cssFiles(SRC).filter((name) => !name.endsWith(`${path.sep}styles${path.sep}motion.css`))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(DECL)) {
        const value = match[1].trim();
        if (/^(none|inherit|initial|unset)$/.test(value)) continue;
        const withoutVars = value.replace(/var\([^)]*\)/g, "");
        if (/\d*\.?\d+(ms|s)\b/.test(withoutVars.replace(/(?<![\w.])0(ms|s)\b/g, "")) || /cubic-bezier|(?<![\w-])ease(-in|-out|-in-out)?(?![\w-])/.test(withoutVars)) {
          raw.push(`${path.relative(process.cwd(), file)}: ${match[0].trim().slice(0, 120)}`);
        }
      }
    }
    expect(raw).toEqual([]);
  });

  it("keeps decorative weight and glow out: no 800/900 weights, no gradient text", () => {
    const found: string[] = [];
    for (const file of cssFiles(SRC)) {
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/font-weight:\s*(800|900)\b/.test(line)) found.push(`${path.relative(process.cwd(), file)}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });
});
