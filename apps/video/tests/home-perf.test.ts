import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("homepage perf", () => {
  it("home-faq is a server component without framer-motion or BlurFade", () => {
    const source = read("src/components/hf/home-faq.tsx");

    expect(source).not.toContain("use client");
    expect(source).not.toContain("framer-motion");
    expect(source).not.toContain("BlurFade");
  });

  it("home-faq keeps the six FAQ question keys", () => {
    const source = read("src/components/hf/home-faq.tsx");

    for (const key of [
      "general",
      "commercial",
      "aiModels",
      "credits",
      "refund",
      "support",
    ]) {
      expect(source).toContain(`${key}.question`);
    }
  });

  it("explore-home is a server component", () => {
    const source = read("src/components/hf/explore-home.tsx");

    expect(source).not.toContain("use client");
  });

  it("marketing page imports HomeFaq and not FAQSection", () => {
    const source = read("src/app/[locale]/(marketing)/page.tsx");

    expect(source).toContain('@/components/hf/home-faq');
    expect(source).not.toContain("faq-section");
  });
});
