import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const messagesDir = join(root, "src", "messages");

const SCOPES = ["DuHome", "HfNav", "HfPromo"];

function readMessages(locale: string): unknown {
  return JSON.parse(readFileSync(join(messagesDir, `${locale}.json`), "utf8")) as unknown;
}

function flatten(value: unknown, prefix = ""): Record<string, string> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const flat: Record<string, string> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      Object.assign(flat, flatten(child, prefix ? `${prefix}.${key}` : key));
    }
    return flat;
  }
  return { [prefix]: String(value) };
}

function inScope(key: string): boolean {
  return SCOPES.some((scope) => key === scope || key.startsWith(`${scope}.`));
}

const en = flatten(readMessages("en"));
const zh = flatten(readMessages("zh"));

describe("i18n keys", () => {
  it("has the same key set in every locale", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
  });

  it("translates every scoped string", () => {
    const untranslated = Object.keys(en)
      .filter(inScope)
      .filter((key) => {
        const value = zh[key];
        if (value === undefined) {
          return true;
        }
        if (value === en[key] && !value.includes("DreamUtopia")) {
          return true;
        }
        return false;
      });

    expect(untranslated).toEqual([]);
  });

  it("wires the hard-coded UI copy through next-intl", () => {
    const files = [
      "src/components/hf/promo-bar.tsx",
      "src/components/hf/top-nav.tsx",
      "src/components/hf/du-home.tsx",
    ];

    for (const file of files) {
      const source = readFileSync(join(root, file), "utf8");
      expect(source).toContain("useTranslations(");
    }
  });
});
