import { nanoid } from "nanoid";

import { db, mediaAssets } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { assertMediaAccount } from "@/lib/api/media-account";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { getStorage, SIGNED_URL_DEFAULT_TTL } from "@/lib/storage";

const MAX_AUDIO_SIZE = 25 * 1024 * 1024;
const AUDIO_TYPES = new Map([
  ["audio/mpeg", "mp3"],
  ["audio/wav", "wav"],
  ["audio/x-wav", "wav"],
  ["audio/mp4", "m4a"],
  ["audio/webm", "webm"],
]);

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    assertMediaAccount(request, user.id);
    const form = await request.formData();
    const file = form.get("file");
    const canvasUpload = form.get("scope") === "canvas";
    if (!(file instanceof File) || !AUDIO_TYPES.has(file.type) || !file.size || file.size > MAX_AUDIO_SIZE) {
      throw new ApiError("Use an MP3, WAV, M4A, or WebM audio file up to 25 MB.", 400);
    }
    const key = `uploads/${user.id}/${canvasUpload ? "canvas/" : ""}${nanoid()}.${AUDIO_TYPES.get(file.type)}`;
    const storage = getStorage();
    await storage.uploadFile({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
    await db.insert(mediaAssets).values({ id: nanoid(), userId: user.id, key, name: file.name, mimeType: file.type, size: file.size });
    return apiSuccess({ key, signedUrl: storage.getSignedUrl(key, SIGNED_URL_DEFAULT_TTL) });
  } catch (error) { return handleApiError(error); }
}
