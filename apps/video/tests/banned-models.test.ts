import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

/** 已禁用/隐藏的模型名称（Sora / Veo / Wan / Kling） */
const BANNED_PATTERN = /\b(wan|veo|sora|kling)\b/i;

const SCAN_DIRS = ["src/app", "src/config", "src/components"];
const SCAN_EXTENSIONS = [".ts", ".tsx", ".json", ".mdx"];

function collectFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectFiles(fullPath, acc);
    } else if (SCAN_EXTENSIONS.includes(path.extname(entry.name))) {
      acc.push(fullPath);
    }
  }
  return acc;
}

describe("banned model names are removed from the source tree", () => {
  const files = SCAN_DIRS.flatMap((dir) =>
    collectFiles(path.join(projectRoot, dir))
  );

  it("finds files to scan", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("no scanned file mentions a disabled model", () => {
    for (const file of files) {
      const content = fs.readFileSync(file, "utf8");
      const match = content.match(BANNED_PATTERN);
      expect(
        match,
        `${path.relative(projectRoot, file)} mentions "${match?.[0]}"`
      ).toBeNull();
    }
  });
});

describe("sitemap only exposes enabled models", () => {
  it("contains neither disabled model names nor their routes", async () => {
    process.env.NEXT_PUBLIC_APP_URL ||= "https://example.com";

    const { default: sitemap } = await import("../src/app/sitemap");
    const entries = await sitemap();

    expect(JSON.stringify(entries)).not.toMatch(BANNED_PATTERN);

    for (const entry of entries) {
      expect(entry.url).not.toContain("/sora-2");
      expect(entry.url).not.toContain("/veo-3-1");
      expect(entry.url).not.toContain("/wan-2-6");
    }
  });
});
