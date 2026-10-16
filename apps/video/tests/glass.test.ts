import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  GLASS_BUTTON,
  GLASS_CARD,
  GLASS_ON_MEDIA,
  GLASS_ROUND,
  glass,
} from "../src/components/ui/glass";

function read(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

const CONSUMERS = [
  "src/components/seo/seo-landing.tsx",
  "src/app/[locale]/(marketing)/models/[slug]/page.tsx",
  "src/components/hf/du-home.tsx",
];

describe("glass helper", () => {
  it("exports the shared class constants", () => {
    expect(GLASS_CARD).toBe("du-glass");
    expect(GLASS_BUTTON).toBe("du-glass-btn");
    expect(GLASS_ROUND).toBe("du-glass-round");
    expect(GLASS_ON_MEDIA).toBe("du-glass-on-media");
  });

  it("joins the variant with truthy extras", () => {
    expect(glass("card")).toBe("du-glass");
    expect(glass("button", "x")).toBe("du-glass-btn x");
    expect(glass("media-button")).toBe("du-glass-btn du-glass-on-media");
  });

  it("drops falsy extras", () => {
    expect(glass("card", null, undefined, false, "p-2")).toBe("du-glass p-2");
  });
});

describe("theme.css", () => {
  const css = read("src/styles/theme.css");

  it("defines the reusable glass classes", () => {
    expect(css).toContain(".du-glass {");
    expect(css).toContain("backdrop-filter: blur(var(--du-glass-blur))");
    expect(css).toContain(".du-glass-btn {");
  });
});

describe("glass consumers", () => {
  it.each(CONSUMERS)("%s imports the glass helpers", (file) => {
    expect(read(file)).toContain('from "@/components/ui/glass"');
  });

  it("gallery-section uses glass", () => {
    expect(read("src/components/gallery/gallery-section.tsx")).toContain("du-glass");
  });
});
