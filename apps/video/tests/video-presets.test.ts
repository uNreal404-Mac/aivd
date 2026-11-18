import { describe, expect, it } from "vitest";
import { VIDEO_PRESETS, findVideoPreset, promptWithPreset } from "@/lib/video-presets";
import { PRESET_PATTERN, buildGenerateRequest, defaultSettings, toMillis } from "@/lib/ai-video-studio";

describe("video presets", () => {
  it("have unique ids the URL pattern accepts", () => {
    const ids = VIDEO_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(PRESET_PATTERN.test(id)).toBe(true);
  });

  it("append the camera direction to the prompt", () => {
    expect(promptWithPreset("A fox in the snow", "push-in")).toBe("A fox in the snow. Camera slowly pushes in toward the subject.");
    expect(promptWithPreset("一只狐狸在雪地里。", "orbit")).toBe("一只狐狸在雪地里。 Camera orbits smoothly around the subject.");
  });

  it("leave the prompt alone for unknown or missing presets", () => {
    expect(promptWithPreset("  A fox  ", undefined)).toBe("A fox");
    expect(promptWithPreset("A fox", "some-effect")).toBe("A fox");
    expect(findVideoPreset("some-effect")).toBeUndefined();
  });

  it("are sent with the generate request", () => {
    const settings = { ...defaultSettings(), prompt: "A fox", preset: "crane-up" };
    const request = buildGenerateRequest(settings, "key");
    expect(request.ok && request.body.prompt).toBe("A fox. Camera cranes up into a high aerial view.");
  });
});

describe("toMillis", () => {
  it("reads seconds, milliseconds and ISO strings", () => {
    expect(toMillis(1_700_000_000)).toBe(1_700_000_000_000);
    expect(toMillis(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(toMillis("2026-11-18T00:00:00.000Z")).toBe(Date.parse("2026-11-18T00:00:00.000Z"));
    expect(toMillis(null)).toBeUndefined();
    expect(toMillis("not a date")).toBeUndefined();
  });
});
