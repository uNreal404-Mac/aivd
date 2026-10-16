import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("home and studio performance split", () => {
  it("keeps the home page a server component with eager hero images", () => {
    const home = read("src/components/hf/du-home.tsx");

    expect(home.startsWith('"use client"')).toBe(false);
    expect(home).toContain('fetchPriority="high"');
    expect(home).toContain('loading="eager"');
  });

  it("keeps the category wall a client component", () => {
    const categories = read("src/components/hf/du-home-categories.tsx");

    expect(categories.startsWith('"use client"')).toBe(true);
  });

  it("lazy-loads the model picker out of the studio bundle", () => {
    const studio = read("src/components/hf/ai-video-studio.tsx");

    expect(studio).toContain("next/dynamic");
    expect(studio).toContain("ai-video-model-picker");
    expect(studio).not.toContain('aria-label="Choose a model"');
  });

  it("keeps the picker markup in its own client component", () => {
    const picker = read("src/components/hf/ai-video-model-picker.tsx");

    expect(picker).toContain('aria-label="Choose a model"');
  });
});
