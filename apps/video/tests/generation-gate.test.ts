import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  canUploadImage,
  isI2VGenerationEnabled,
} from "../src/lib/image-to-video";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readSource(relativePath: string): string {
  return readFileSync(resolve(projectRoot, relativePath), "utf8");
}

describe("canUploadImage", () => {
  it("mirrors the generation flag", () => {
    expect(canUploadImage(false)).toBe(false);
    expect(canUploadImage(true)).toBe(true);
  });
});

describe("isI2VGenerationEnabled", () => {
  it("stays closed unless the flag is exactly 'true'", () => {
    expect(isI2VGenerationEnabled({})).toBe(false);
    expect(
      isI2VGenerationEnabled({ VIDEO_GENERATION_ENABLED: "false" }),
    ).toBe(false);
    expect(isI2VGenerationEnabled({ VIDEO_GENERATION_ENABLED: "1" })).toBe(
      false,
    );
    expect(isI2VGenerationEnabled({ VIDEO_GENERATION_ENABLED: "true" })).toBe(
      true,
    );
  });
});

describe("client upload guard", () => {
  const source = readSource("src/components/image-to-video/i2v-studio.tsx");

  it("checks canUploadImage(generationEnabled) before calling uploadImage", () => {
    const guardIndex = source.indexOf("canUploadImage(generationEnabled)");
    const uploadIndex = source.indexOf("await uploadImage(");

    expect(guardIndex).toBeGreaterThan(-1);
    expect(uploadIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(uploadIndex);
  });
});

describe("server generation gate", () => {
  const source = readSource("src/app/api/v1/video/generate/route.ts");

  it("treats anything other than 'true' as disabled", () => {
    expect(source).toContain('VIDEO_GENERATION_ENABLED !== "true"');
  });

  it("no longer opens on an explicit 'false' check", () => {
    expect(source).not.toContain('VIDEO_GENERATION_ENABLED === "false"');
  });
});
