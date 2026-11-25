import { and, eq, isNull, or } from "drizzle-orm";
import { db, mediaAssets, videos, VideoStatus } from "@/db";
import { ApiError } from "@/lib/api/error";
import { isOwnUploadKey } from "@/lib/image-url-allowlist";
import { getStorage } from "@/lib/storage";
import { resolveKlingKeyframes } from "./kling-keyframes";
import { readMovieBox, readVideoTrack } from "@/lib/video-track";
import {
  VIDEO_EDIT_MODEL,
  VIDEO_MOTION_MODEL,
  type VideoToolSource,
} from "@/lib/video-tool";

const MB = 1024 * 1024;
const invalid = (message: string, code = "INVALID_TOOL_SOURCE") =>
  new ApiError(message, 400, { code });

async function ownedBytes(
  key: string,
  recorded: number | null,
  limit: number,
  movieOnly = false,
) {
  const storage = getStorage();
  try {
    const size = recorded ?? (await storage.getObjectSize(key));
    if (!Number.isSafeInteger(size) || size < 1 || size > limit)
      throw invalid("The file exceeds the supported size.");
    const signedUrl = storage.getSignedUrl(key, 3600);
    async function read(start: number, end: number) {
      const complete = start === 0 && end === size - 1;
      const response = await fetch(signedUrl, {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
        cache: "no-store",
        ...(complete ? {} : { headers: { Range: `bytes=${start}-${end}` } }),
      });
      const expected = end - start + 1;
      if (
        Number(response.headers.get("content-length")) !== expected ||
        (complete
          ? response.status !== 200
          : response.status !== 206 ||
            response.headers.get("content-range") !==
              `bytes ${start}-${end}/${size}`)
      ) {
        await response.body?.cancel();
        throw new ApiError(
          "Could not verify the stored file. Try again.",
          503,
          { code: "TOOL_SOURCE_UNVERIFIED" },
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== expected)
        throw new ApiError("Incomplete file from storage.", 503, {
          code: "TOOL_SOURCE_UNVERIFIED",
        });
      return bytes;
    }
    let bytes: Uint8Array;
    if (movieOnly) {
      try {
        bytes = await readMovieBox(size, read);
      } catch (error) {
        if (
          error instanceof ApiError ||
          error instanceof TypeError ||
          error instanceof DOMException
        )
          throw error;
        throw invalid("Use a standard MP4 or MOV with a readable video track.");
      }
    } else bytes = await read(0, size - 1);
    return { bytes, signedUrl };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Could not read the original file. Try again.", 503, {
      code: "TOOL_SOURCE_UNVERIFIED",
    });
  }
}

export async function measuredVideoSource(
  userId: string,
  model: string,
  source: VideoToolSource,
) {
  const { sourceVideoKey, sourceVideoUuid } = source;
  if (!!sourceVideoKey === !!sourceVideoUuid)
    throw invalid("Choose one video.");
  let key: string | undefined;
  let size: number | null = null;
  if (sourceVideoKey && isOwnUploadKey(sourceVideoKey, userId)) {
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.userId, userId),
          eq(mediaAssets.key, sourceVideoKey),
        ),
      )
      .limit(1);
    if (row && ["video/mp4", "video/quicktime"].includes(row.mimeType)) {
      key = row.key;
      size = row.size;
    }
  } else if (sourceVideoUuid) {
    const [row] = await db
      .select({ key: videos.videoUrl, size: videos.fileSize })
      .from(videos)
      .where(
        and(
          eq(videos.userId, userId),
          eq(videos.uuid, sourceVideoUuid),
          eq(videos.isDeleted, false),
          eq(videos.status, VideoStatus.COMPLETED),
          or(eq(videos.mediaType, "video"), isNull(videos.mediaType)),
        ),
      )
      .limit(1);
    if (
      row?.key?.startsWith(`videos/${sourceVideoUuid}/`) &&
      /^videos\/[\w-]+\/[\w.-]+\.(mp4|mov)$/i.test(row.key)
    ) {
      key = row.key;
      size = row.size;
    }
  }
  if (!key) throw invalid("Choose an available MP4 or MOV from your account.");
  const { bytes, signedUrl } = await ownedBytes(
    key,
    size,
    (sourceVideoKey ? 25 : 50) * MB,
    true,
  );
  let track: ReturnType<typeof readVideoTrack>;
  try {
    track = readVideoTrack(bytes);
  } catch {
    throw invalid("Use a standard MP4 or MOV with a readable video timeline.");
  }
  const { seconds, width, height, fps } = track;
  const ratio = width / height;
  if (model === VIDEO_EDIT_MODEL) {
    if (
      seconds < 3 ||
      seconds > 15.5 ||
      Math.min(width, height) < 700 ||
      Math.max(width, height) > 4553 ||
      width * height > 8294400 ||
      ratio < 0.4 ||
      ratio > 2 ||
      fps < 23.97 ||
      fps > 60.01
    ) {
      throw invalid(
        "Edit needs 3–15.5s, 24–60fps video; 700–4553px per side, up to 8.29MP, ratio 2:5 to 2:1.",
        "EDIT_CLIP_FORMAT",
      );
    }
  } else if (
    model !== VIDEO_MOTION_MODEL ||
    seconds < 3 ||
    seconds > 30 ||
    Math.min(width, height) <= 340 ||
    ratio < 0.4 ||
    ratio > 2.5
  ) {
    throw invalid(
      "Motion needs a 3–30s video, over 340px per side, with a 2:5 to 5:2 aspect ratio.",
      "MOTION_CLIP_FORMAT",
    );
  }
  return {
    signedUrl,
    seconds: Math.ceil(seconds),
    track,
    uuid: sourceVideoUuid,
    key: sourceVideoKey,
  };
}

export async function validateCharacterImage(
  userId: string,
  key: string | undefined,
) {
  if (!key) throw invalid("Choose a character image from your account.");
  let resolved = key,
    size: number | null = null;
  if (key.startsWith("work:")) {
    try {
      resolved = (await resolveKlingKeyframes(userId, { first: key })).first!;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      throw invalid("The selected image is no longer available.");
    }
  } else {
    if (!isOwnUploadKey(key, userId))
      throw invalid("Choose a character image from your account.");
    const [row] = await db
      .select()
      .from(mediaAssets)
      .where(and(eq(mediaAssets.userId, userId), eq(mediaAssets.key, key)))
      .limit(1);
    if (!row || !["image/png", "image/jpeg"].includes(row.mimeType))
      throw invalid("Choose a PNG or JPEG character image.");
    size = row.size;
  }
  const { bytes, signedUrl } = await ownedBytes(resolved, size, 10 * MB);
  let width = 0,
    height = 0;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length >= 24 &&
    view.getUint32(0) === 0x89504e47 &&
    view.getUint32(4) === 0x0d0a1a0a &&
    view.getUint32(12) === 0x49484452
  ) {
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (bytes.length >= 4 && view.getUint16(0) === 0xffd8) {
    for (let i = 2; i + 8 < bytes.length && bytes[i] === 0xff; ) {
      const marker = bytes[i + 1];
      if ([0xc0, 0xc1, 0xc2].includes(marker)) {
        height = view.getUint16(i + 5);
        width = view.getUint16(i + 7);
        break;
      }
      if (marker === 0xda || marker === 0xd9) break;
      const len = view.getUint16(i + 2);
      if (len < 2) break;
      i += len + 2;
    }
  }
  if (
    Math.min(width, height) <= 340 ||
    width / height < 0.4 ||
    width / height > 2.5
  )
    throw invalid(
      "Character image must be over 340px per side with a 2:5 to 5:2 aspect ratio.",
      "CHARACTER_IMAGE_FORMAT",
    );
  return { key: resolved, signedUrl };
}

export async function ownedExtendUpload(userId: string, key: string) {
  const unavailable = () =>
    new ApiError(
      "Choose one of your available video uploads up to 25 MB.",
      400,
      { code: "SOURCE_VIDEO_UNAVAILABLE" },
    );
  if (!isOwnUploadKey(key, userId)) throw unavailable();
  const [row] = await db
    .select()
    .from(mediaAssets)
    .where(and(eq(mediaAssets.userId, userId), eq(mediaAssets.key, key)))
    .limit(1);
  if (
    !row ||
    !["video/mp4", "video/quicktime", "video/webm"].includes(row.mimeType) ||
    row.size <= 0 ||
    row.size > 25 * MB
  )
    throw unavailable();
  return {
    signedUrl: getStorage().getSignedUrl(row.key, 3600),
    name: row.name,
  };
}
