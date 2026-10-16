import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const read = (relativePath: string) =>
  readFileSync(path.join(ROOT, relativePath), "utf8");

const ENV_FILES = ["src/env.mjs", "src/lib/auth/env.mjs"];
const ENV_EXAMPLE = ".env.example";

/**
 * Collect the names of variables declared inside the `server` / `client`
 * blocks of a createEnv config whose zod chain is NOT marked `.optional()`.
 */
function requiredKeys(source: string): string[] {
  const keys: string[] = [];
  const blockRe = /(?:^|\n)\s*(server|client):\s*\{([\s\S]*?)\n\s*\},/g;

  for (const match of Array.from(source.matchAll(blockRe))) {
    const body = match[2];
    for (const line of body.split("\n")) {
      const kv = line.match(/^\s*([A-Z0-9_]+):\s*(.+?),?\s*$/);
      if (!kv) continue;
      const [, name, value] = kv;
      if (!value.startsWith("z.")) continue;
      if (value.includes(".optional()")) continue;
      keys.push(name);
    }
  }

  return keys;
}

/** The REQUIRED comment block lives at the very top of .env.example. */
function requiredCommentBlock(example: string): string {
  const marker = example.indexOf("Database (PostgreSQL)");
  return marker === -1 ? example : example.slice(0, marker);
}

const SECRET_VALUE_RE =
  /=(['"]?)(sk_live_|sk_test_[A-Za-z0-9]{10,}|re_[A-Za-z0-9]{20,}|whsec_[A-Za-z0-9]{10,})/;

describe("env.mjs <-> .env.example parity", () => {
  const example = read(ENV_EXAMPLE);

  it("documents every non-optional env var from src/env.mjs and src/lib/auth/env.mjs", () => {
    for (const file of ENV_FILES) {
      const source = read(file);
      const keys = requiredKeys(source);
      expect(keys.length).toBeGreaterThan(0);

      for (const key of keys) {
        const documented =
          new RegExp(`^\\s*#?\\s*${key}\\s*=`, "m").test(example) ||
          requiredCommentBlock(example).includes(key);

        expect(
          documented,
          `${key} (declared in ${file}) is missing from ${ENV_EXAMPLE}`,
        ).toBe(true);
      }
    }
  });

  it("contains no real-looking secret values", () => {
    const offenders = example
      .split("\n")
      .filter((line) => SECRET_VALUE_RE.test(line));

    expect(offenders).toEqual([]);
  });
});

describe("build scripts skip env validation at build time only", () => {
  const pkg = JSON.parse(read("package.json")) as {
    scripts: Record<string, string>;
  };

  it("cf:build and cf:preview set SKIP_ENV_VALIDATION=1", () => {
    expect(pkg.scripts["cf:build"]).toContain("SKIP_ENV_VALIDATION=1");
    expect(pkg.scripts["cf:preview"]).toContain("SKIP_ENV_VALIDATION=1");
  });

  it("cf:deploy does not skip env validation", () => {
    expect(pkg.scripts["cf:deploy"]).not.toContain("SKIP_ENV_VALIDATION");
  });
});

describe("createEnv configs skip validation at build time", () => {
  it("every env.mjs enables skipValidation", () => {
    for (const file of ENV_FILES) {
      expect(read(file), `${file} must set skipValidation`).toContain(
        "skipValidation",
      );
    }
  });
});
