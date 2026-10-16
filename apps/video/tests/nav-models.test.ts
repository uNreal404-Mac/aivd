import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { headerModels, isVideoModelEnabled } from "../src/config/navigation";
import { VIDEO_MODEL_PRICING } from "../src/config/pricing-user";
import { siteConfig } from "../src/config/site";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(testDir, "..");

/** 被禁用/隐藏的模型关键词：Sora / Veo / Wan */
const DISABLED_MODEL_PATTERN = /Sora|Veo|Wan/;

function collectStrings(value: unknown, acc: string[] = []): string[] {
  if (typeof value === "string") {
    acc.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, acc);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) {
      collectStrings(item, acc);
    }
  }
  return acc;
}

function readJsonStrings(relativePath: string): string[] {
  const raw = fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  return collectStrings(JSON.parse(raw));
}

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

describe("headerModels only exposes enabled video models", () => {
  it("includes at least one model", () => {
    expect(headerModels.length).toBeGreaterThan(0);
  });

  it("every entry is enabled in VIDEO_MODEL_PRICING", () => {
    for (const model of headerModels) {
      expect(model.modelId).toBeTruthy();
      expect(VIDEO_MODEL_PRICING[model.modelId]?.enabled).toBe(true);
      expect(isVideoModelEnabled(model.modelId)).toBe(true);
    }
  });

  it("never lists a disabled model", () => {
    for (const model of headerModels) {
      expect(model.title).not.toMatch(DISABLED_MODEL_PATTERN);
    }
  });
});

describe("isVideoModelEnabled", () => {
  it("returns false for unknown models", () => {
    expect(isVideoModelEnabled("not-a-model")).toBe(false);
  });

  it("returns true for enabled models", () => {
    expect(isVideoModelEnabled("seedance-1.5-pro")).toBe(true);
  });
});

describe("shared copy only advertises enabled models", () => {
  it("siteConfig.description mentions no disabled model", () => {
    expect(siteConfig.description).not.toMatch(DISABLED_MODEL_PATTERN);
  });

  it("en.json mentions no disabled model", () => {
    for (const value of readJsonStrings("src/messages/en.json")) {
      expect(value, `en.json: ${value}`).not.toMatch(DISABLED_MODEL_PATTERN);
    }
  });

  it("zh.json mentions no disabled model", () => {
    for (const value of readJsonStrings("src/messages/zh.json")) {
      expect(value, `zh.json: ${value}`).not.toMatch(DISABLED_MODEL_PATTERN);
    }
  });

  it("content-panel.tsx mentions no disabled model", () => {
    expect(readSource("src/components/tool/content-panel.tsx")).not.toMatch(
      DISABLED_MODEL_PATTERN
    );
  });
});
