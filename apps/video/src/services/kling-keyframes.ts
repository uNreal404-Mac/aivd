import { and, eq, inArray } from "drizzle-orm";
import { db, mediaAssets, videos } from "@/db";
import { ApiError } from "@/lib/api/error";
import { isOwnUploadKey } from "@/lib/image-url-allowlist";
import { KLING_KEYFRAME_MODEL, KLING_MAX_MIDDLE_FRAMES, mapKlingFrames, maxKlingFrames, orderedKlingFrames, type KlingKeyframes } from "@/lib/kling-keyframes";

export function invalidKeyframes(): ApiError {
  return new ApiError("Choose available images from your account for the Kling first, middle or last frames.", 400, { code: "INVALID_KEYFRAMES" });
}

export function validateKlingKeyframes(params: {
  model: string; prompt: string; duration?: number; resolution?: string;
  keyframes: KlingKeyframes; hasOtherInputs: boolean;
}): void {
  const { duration = 10, keyframes } = params;
  const count = orderedKlingFrames(keyframes).length;
  if (params.model !== KLING_KEYFRAME_MODEL || params.hasOtherInputs ||
      !Number.isInteger(duration) || duration < 3 || duration > 30 ||
      (params.resolution !== undefined && !["720p", "1080p"].includes(params.resolution)) ||
      (keyframes.middle?.length ?? 0) > KLING_MAX_MIDDLE_FRAMES || !count || count > maxKlingFrames(duration)) {
    throw invalidKeyframes();
  }
  if (params.prompt.length > 8000) {
    throw new ApiError("Kling keyframe prompts support up to 8,000 characters.", 400, { code: "PROMPT_TOO_LONG", max: 8000 });
  }
  for (const [, name, index] of params.prompt.matchAll(/@(first_frame|last_frame|keyframe_(\d+))(?![A-Za-z0-9_])/g)) {
    if ((name === "first_frame" && !keyframes.first) || (name === "last_frame" && !keyframes.last) ||
        (index !== undefined && (!/^[1-8]$/.test(index) || Number(index) > (keyframes.middle?.length ?? 0)))) throw invalidKeyframes();
  }
}

/** Rebuild every role from authenticated library rows. Client preview URLs can expire. */
export async function resolveKlingKeyframes(userId: string, frames: KlingKeyframes): Promise<KlingKeyframes> {
  const refs = new Set(orderedKlingFrames(frames));
  const resolved = new Map<string, string>();
  const uploads: string[] = [];
  const works = new Map<string, { uuid: string; index: number }>();
  for (const ref of refs) {
    if (isOwnUploadKey(ref, userId)) {
      uploads.push(ref);
      continue;
    }
    const match = /^work:([A-Za-z0-9_-]{1,80}):(0|[1-9]\d?)$/.exec(ref);
    if (!match) throw invalidKeyframes();
    works.set(ref, { uuid: match[1], index: Number(match[2]) });
  }
  if (uploads.length) {
    const assets = await db.select({ key: mediaAssets.key, type: mediaAssets.mimeType }).from(mediaAssets)
      .where(and(eq(mediaAssets.userId, userId), inArray(mediaAssets.key, uploads)));
    for (const asset of assets) {
      if (asset.type.startsWith("image/")) resolved.set(asset.key, asset.key);
    }
  }
  if (works.size) {
    const ids = [...new Set(Array.from(works.values(), (item) => item.uuid))];
    const rows = await db.select({ uuid: videos.uuid, first: videos.videoUrl, params: videos.parameters }).from(videos)
      .where(and(eq(videos.userId, userId), eq(videos.mediaType, "image"), eq(videos.status, "COMPLETED"), eq(videos.isDeleted, false), inArray(videos.uuid, ids)));
    const outputs = new Map(rows.map((row) => [row.uuid, [row.first, ...(Array.isArray(row.params?.extraKeys) ? row.params.extraKeys : [])]]));
    for (const [ref, { uuid, index }] of works) {
      const value = outputs.get(uuid)?.[index];
      if (typeof value === "string" && value) resolved.set(ref, value);
    }
  }
  return mapKlingFrames(frames, (ref) => {
    const value = resolved.get(ref);
    if (!value) throw invalidKeyframes();
    return value;
  });
}
