import { describe, expect, it } from "vitest";

import { IMAGE_CATALOG, VIDEO_CATALOG } from "@/lib/kie-model-catalog";
import {
  NAV_AUDIO_MODELS,
  NAV_IMAGE_MODELS,
  NAV_VIDEO_MODELS,
  findNavModel,
  inCatalog,
  navModelHref,
} from "@/lib/nav-models";

describe("nav model lists", () => {
  it("keeps ids unique within each list", () => {
    for (const list of [NAV_VIDEO_MODELS, NAV_IMAGE_MODELS, NAV_AUDIO_MODELS]) {
      expect(new Set(list.map((item) => item.id)).size).toBe(list.length);
    }
  });

  it("leads the video list with the models that can generate today", () => {
    expect(NAV_VIDEO_MODELS.slice(0, 2).map((item) => item.id)).toEqual(["veo-3.1", "wan2.6"]);
  });

  it("links every model to its studio with the model selected", () => {
    expect(navModelHref("video", "veo-3.1")).toBe("/ai/video?model=veo-3.1");
    expect(navModelHref("image", "nano-banana-pro")).toBe("/ai/image?model=nano-banana-pro");
    expect(navModelHref("audio", "elevenlabs_v4")).toBe("/audio?voiceMode=voiceover&audioModel=elevenlabs_v4");
    expect(navModelHref("video", "kling/v4-reference-to-video")).toBe("/ai/video?model=kling%2Fv4-reference-to-video");
  });

  it("resolves every listed model either from the catalogue or as coming soon", () => {
    for (const item of NAV_VIDEO_MODELS) {
      const known = VIDEO_CATALOG.some((entry) => entry.id === item.id);
      expect(inCatalog("video", item.id)).toBe(known);
      expect(findNavModel("video", item.id)?.name).toBe(item.name);
    }
    for (const item of NAV_IMAGE_MODELS) {
      const known = IMAGE_CATALOG.some((entry) => entry.id === item.id);
      expect(inCatalog("image", item.id)).toBe(known);
      expect(findNavModel("image", item.id)?.name).toBe(item.name);
    }
    expect(findNavModel("audio", "nope")).toBeUndefined();
  });

  it("fills both languages for every description", () => {
    for (const item of [...NAV_VIDEO_MODELS, ...NAV_IMAGE_MODELS, ...NAV_AUDIO_MODELS]) {
      expect(item.desc.zh.trim()).not.toBe("");
      expect(item.desc.en.trim()).not.toBe("");
    }
  });
});
