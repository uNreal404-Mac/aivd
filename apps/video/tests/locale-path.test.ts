import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { languageSwitchSuffix, localizedHref } from "@/lib/locale-path";

describe("localizedHref", () => {
  it("gives English pages no prefix", () => {
    expect(localizedHref("en", "/pricing")).toBe("/pricing");
    expect(localizedHref("en", "/ai/video?model=veo-3.1")).toBe("/ai/video?model=veo-3.1");
    expect(localizedHref("en", "/models/veo-3-1")).toBe("/models/veo-3-1");
  });

  it("prefixes other languages", () => {
    expect(localizedHref("zh", "/pricing")).toBe("/zh/pricing");
    expect(localizedHref("zh", "/ai/video?model=veo-3.1")).toBe("/zh/ai/video?model=veo-3.1");
  });

  it("links to the home page without a trailing slash", () => {
    expect(localizedHref("en", "/")).toBe("/");
    expect(localizedHref("zh", "/")).toBe("/zh");
    expect(localizedHref("en", "")).toBe("/");
  });

  it("keeps a hash or a query on the home page attached to it", () => {
    expect(localizedHref("en", "/#pricing")).toBe("/#pricing");
    expect(localizedHref("zh", "/#pricing")).toBe("/zh#pricing");
    expect(localizedHref("zh", "/?ref=nav")).toBe("/zh?ref=nav");
  });

  it("leaves in-page links alone", () => {
    expect(localizedHref("en", "#faq")).toBe("#faq");
    expect(localizedHref("zh", "#faq")).toBe("#faq");
  });
});

/** Every TypeScript source file under a directory. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const file = path.join(dir, name);
    if (statSync(file).isDirectory()) return sources(file);
    return /\.tsx?$/.test(name) ? [file] : [];
  });
}

describe("links in the source", () => {
  // `/en/...` only answers with a redirect to the address without the prefix.
  // A link glued together as `/${locale}/...` sends every English visitor and
  // crawler through that redirect, so links go through localizedHref instead.
  it("never glues a language prefix onto a path by hand", () => {
    const glued = /`\/\$\{[A-Za-z.]*(?:lang|Lang|locale|Locale|language)[A-Za-z]*\}/;
    // These handle the default language themselves, on the same line.
    const handlesDefault = /defaultLocale|=== "en"/;
    const offenders: string[] = [];
    for (const file of sources(path.join(process.cwd(), "src"))) {
      const relative = path.relative(process.cwd(), file);
      // The middleware reads incoming paths; it does not write links.
      if (relative === "src/middleware.ts") continue;
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (line.trimStart().startsWith("*") || line.trimStart().startsWith("//")) return;
          if (glued.test(line) && !handlesDefault.test(line)) offenders.push(`${relative}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});


it("retains the tool settings and hash across languages without reissuing an autostart", () => {
  expect(languageSwitchSuffix("?model=wan2.6&autostart=one-time&mode=extend", "#controls"))
    .toBe("?model=wan2.6&mode=extend#controls");
  expect(languageSwitchSuffix("?autostart=one-time", "")).toBe("");
});
