import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Component stylesheets that follow the ds.css scale.
const DIRS = ["src/components/hf", "src/components/section", "src/components/creative-space", "src/components/landing"];
const FILES = [
  ...DIRS.flatMap((dir) =>
    readdirSync(path.join(process.cwd(), dir))
      .filter((name) => name.endsWith(".css"))
      .map((name) => path.join(dir, name)),
  ),
  "src/styles/states.css",
];
const SCALE = readFileSync(path.join(process.cwd(), "src/styles/ds.css"), "utf8");
const defined = new Set([...SCALE.matchAll(/(--ds-[a-z0-9-]+):/g)].map((match) => match[1]));

describe("design scale", () => {
  it("uses scale variables for corner radii and font sizes", () => {
    const raw: string[] = [];
    for (const file of FILES) {
      readFileSync(path.join(process.cwd(), file), "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (/^\s*(border-radius|font-size):\s*\d+(\.\d+)?px;/.test(line)) raw.push(`${file}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(raw).toEqual([]);
  });

  it("only refers to variables the scale defines", () => {
    const unknown: string[] = [];
    for (const file of FILES) {
      for (const match of readFileSync(path.join(process.cwd(), file), "utf8").matchAll(/var\((--ds-[a-z0-9-]+)\)/g)) {
        if (!defined.has(match[1])) unknown.push(`${file}: ${match[1]}`);
      }
    }
    expect(unknown).toEqual([]);
  });
});
