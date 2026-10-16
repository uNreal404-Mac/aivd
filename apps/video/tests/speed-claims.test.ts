import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SCAN_DIRS = ["src/app", "src/config", "src/components", "src/messages"];
const SCAN_EXTS = new Set([".ts", ".tsx", ".json", ".mdx"]);

const FORBIDDEN =
  /in seconds|\d+\s*-\s*\d+\s*minutes|fast generation|快速生成|lightning fast|faster generation|闪电般快速|更快生成|faster takes|longer shots|generation speed|生成速度|average time|generation time/i;

function collectFiles(dir: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      files.push(...collectFiles(fullPath));
    } else if (SCAN_EXTS.has(extname(fullPath))) {
      files.push(fullPath);
    }
  }

  return files;
}

describe("speed claims", () => {
  it("does not promise speed that is not guaranteed", () => {
    const files = SCAN_DIRS.flatMap((dir) => collectFiles(join(root, dir)));
    const violations: string[] = [];

    for (const file of files) {
      const lines = readFileSync(file, "utf8").split("\n");

      lines.forEach((line, index) => {
        const match = line.match(FORBIDDEN);
        if (match) {
          violations.push(`${file}:${index + 1} matched "${match[0]}"`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
