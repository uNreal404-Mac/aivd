import { KLING_MAX_MIDDLE_FRAMES, maxKlingFrames, mapKlingFrames, orderedKlingFrames, type KlingKeyframes } from "./kling-keyframes";
import { prepareVideoReferencePrompt, type UploadedVideoReference } from "./video-references";

export const STUDIO_KEYFRAME_STORAGE = "aivd:home-video-keyframes";
export type StudioFrames = KlingKeyframes<UploadedVideoReference>;
export type FrameSlot = "first" | "last" | number;

export const frameReferences = orderedKlingFrames;

export function frameKeys(frames: StudioFrames): KlingKeyframes {
  return mapKlingFrames(frames, item => item.key);
}

export function validFrameCount<T>(frames: KlingKeyframes<T>, duration: number) {
  const length = frameReferences(frames).length;
  return length > 0 && length <= maxKlingFrames(duration) && (frames.middle?.length ?? 0) <= KLING_MAX_MIDDLE_FRAMES;
}

export function ownedFrameKey(key: string, userId: string) {
  return Boolean(userId) && (key.startsWith(`uploads/${userId}/`) || /^work:[a-zA-Z0-9_-]{1,80}:(0|[1-9]\d?)$/.test(key));
}

/** Read one account's handoff without using names or array indexes as roles. */
export function parseStudioFrames(raw: string, userId: string): StudioFrames | null {
  try {
    const record = JSON.parse(raw);
    if (!userId || record?.ownerId !== userId || (record.middle !== undefined && !Array.isArray(record.middle))) return null;
    const frames: StudioFrames = { first: record.first, middle: record.middle, last: record.last };
    for (const item of frameReferences(frames)) {
      if (!item || typeof item.key !== "string" || !ownedFrameKey(item.key, userId) ||
        typeof item.name !== "string" || typeof item.url !== "string" || (item.mimeType && !item.mimeType.startsWith("image/"))) return null;
    }
    if ((frames.middle?.length ?? 0) > KLING_MAX_MIDDLE_FRAMES) return null;
    return frames;
  } catch { return null; }
}

export function changeFrame(frames: StudioFrames, slot: FrameSlot, value?: UploadedVideoReference): StudioFrames {
  if (typeof slot !== "number") return { ...frames, [slot]: value };
  const middle = [...(frames.middle ?? [])];
  if (value) middle[slot] = value;
  else middle.splice(slot, 1);
  return { ...frames, middle };
}

export function prepareKeyframePrompt(prompt: string, frames: StudioFrames) {
  const roles = [
    ...(frames.first ? ["@first_frame"] : []),
    ...(frames.middle ?? []).map((_, index) => `@keyframe_${index + 1}`),
    ...(frames.last ? ["@last_frame"] : []),
  ];
  const checked = prepareVideoReferencePrompt(prompt, roles.length, "image");
  if (!checked.ok) return checked;
  return { ok: true as const, prompt: prompt.replace(/@(?:图片|image)(\d+)(?!\d)/gi, (_, index: string) => roles[Number(index) - 1]) };
}

export function renumberFrameMentions(prompt: string, previous: StudioFrames, next: StudioFrames) {
  const before = frameReferences(previous);
  const after = frameReferences(next);
  if (before.length === after.length) return prompt;
  return prompt.replace(/@(图片|image)(\d+)(?!\d)/gi, (token, label: string, number: string) => {
    const prior = before[Number(number) - 1];
    if (!prior) return token;
    const index = after.indexOf(prior);
    return index < 0 ? "" : `@${label}${index + 1}`;
  });
}
