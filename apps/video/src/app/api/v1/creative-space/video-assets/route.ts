import { nanoid } from "nanoid";

import { db, mediaAssets } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { fileToDataUrl, isSafetyApproved, moderateContent, safetyMessage } from "@/lib/content-safety";
import { getStorage, SIGNED_URL_DEFAULT_TTL } from "@/lib/storage";

const MAX_VIDEO_SIZE = 25 * 1024 * 1024;
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request);
    const form = await request.formData();
    const file = form.get("file");
    const frame = form.get("frame");
    if (!(file instanceof File) || !VIDEO_TYPES.has(file.type) || file.size > MAX_VIDEO_SIZE || file.size === 0) {
      throw new ApiError("Use an MP4, WebM, or MOV video up to 25 MB.", 400);
    }
    if (!(frame instanceof File) || frame.type !== "image/jpeg" || frame.size > 2 * 1024 * 1024) {
      throw new ApiError("A video preview frame is required.", 400);
    }
    const safety = await moderateContent({
      text: "",
      images: [{ url: await fileToDataUrl(frame), label: file.name }],
      context: "upload",
    });
    if (!isSafetyApproved(safety)) throw new ApiError(safetyMessage(safety, request.headers.get("accept-language") ?? "en"), 422);
    const ext = file.type === "video/webm" ? "webm" : file.type === "video/quicktime" ? "mov" : "mp4";
    const key = `uploads/${user.id}/${nanoid()}.${ext}`;
    const storage = getStorage();
    await storage.uploadFile({ key, body: Buffer.from(await file.arrayBuffer()), contentType: file.type });
    await db.insert(mediaAssets).values({ id: nanoid(), userId: user.id, key, name: file.name, mimeType: file.type, size: file.size });
    return apiSuccess({ key, signedUrl: storage.getSignedUrl(key, SIGNED_URL_DEFAULT_TTL) });
  } catch (error) { return handleApiError(error); }
}
