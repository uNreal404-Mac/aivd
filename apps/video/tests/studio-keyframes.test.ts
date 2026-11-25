import { describe, expect, it } from "vitest";
import { buildGenerateRequest, defaultSettings, STUDIO_MODELS } from "@/lib/ai-video-studio";
import { KLING_KEYFRAME_MODEL } from "@/lib/kling-keyframes";
import { changeFrame, frameKeys, parseStudioFrames, prepareKeyframePrompt, renumberFrameMentions, validFrameCount } from "@/lib/studio-keyframes";

const image = (name: string) => ({ key: `uploads/current/${name}.jpg`, url: `/preview/${name}`, name });
const first = image("first");
const mid = image("middle");
const last = image("last");
const frames = { first, middle: [mid], last };
const settings = { ...defaultSettings(STUDIO_MODELS.find(m => m.id === KLING_KEYFRAME_MODEL)), prompt: "A transition", duration: 3, resolution: "1080p" };

describe("Kling keyframe handoff", () => {
  it("requires account ownership for uploads and accepts opaque work IDs for server resolution", () => {
    const raw = JSON.stringify({ ownerId: "current", ...frames });
    expect(parseStudioFrames(raw, "current")).toEqual(frames);
    expect(parseStudioFrames(raw, "other")).toBeNull();
    expect(parseStudioFrames(JSON.stringify({ ownerId: "other", ...frames }), "other")).toBeNull();
    const work = { ...first, key: "work:vid_01-abc:1" };
    expect(parseStudioFrames(JSON.stringify({ ownerId: "current", first: work }), "current")?.first).toEqual(work);
    expect(parseStudioFrames(JSON.stringify({ ownerId: "current", first: { ...first, mimeType: "video/mp4" } }), "current")).toBeNull();
  });

  it("preserves role identity for sparse inputs and maps Chinese or English mentions", () => {
    expect(prepareKeyframePrompt("@图片1 @image2 @图片3", frames)).toEqual({ ok: true, prompt: "@first_frame @keyframe_1 @last_frame" });
    expect(prepareKeyframePrompt("@image1", { last })).toEqual({ ok: true, prompt: "@last_frame" });
    expect(prepareKeyframePrompt("@图片1 → @图片2", { middle: [mid, first] })).toEqual({ ok: true, prompt: "@keyframe_1 → @keyframe_2" });
    expect(prepareKeyframePrompt("@图片2", { last })).toEqual({ ok: false, index: 2 });
    expect(prepareKeyframePrompt("@视频1", frames)).toEqual({ ok: false, index: 1 });
  });

  it("keeps stable mentions on replacement and renumbers only the surviving entries on insertion or removal", () => {
    const text = "@图片1 @image2 @图片3";
    expect(renumberFrameMentions(text, frames, changeFrame(frames, 0, image("replacement")))).toBe(text);
    expect(renumberFrameMentions(text, frames, changeFrame(frames, "first"))).toBe(" @image1 @图片2");
    expect(renumberFrameMentions(text, frames, changeFrame(frames, 0))).toBe("@图片1  @图片2");
    expect(renumberFrameMentions(text, frames, changeFrame(frames, 1, image("extra")))).toBe("@图片1 @image2 @图片4");
  });

  it("rejects mixed inputs, unsupported models, too many frames, and empty selections", () => {
    const keys = frameKeys(frames);
    const fail = { ok: false, reason: "invalid-keyframes" };
    expect(buildGenerateRequest(settings, "x", first.key, [], keys)).toEqual(fail);
    expect(buildGenerateRequest(settings, "x", null, [first.key], keys)).toEqual(fail);
    expect(buildGenerateRequest({ ...settings, modelId: "wan2.6" }, "x", null, [], keys)).toEqual(fail);
    expect(buildGenerateRequest(settings, "x", null, [], {})).toEqual(fail);
    expect(buildGenerateRequest(settings, "x", null, [], { ...keys, middle: [mid.key, mid.key, mid.key] })).toEqual(fail);
    expect(validFrameCount({ middle: Array(9).fill(mid) }, 30)).toBe(false);
    expect(validFrameCount({ first, middle: Array(8).fill(mid), last }, 30)).toBe(true);
  });

  it("can send just one end frame and includes only the vendor's supported options", () => {
    const keyframes = { last: last.key };
    expect(buildGenerateRequest(settings, "key", null, [], keyframes)).toEqual({ ok: true, body: {
      prompt: "A transition", duration: 3, model: KLING_KEYFRAME_MODEL, quality: "1080p",
      mode: "reference-to-video", keyframes, idempotencyKey: "key",
    } });
  });
});
