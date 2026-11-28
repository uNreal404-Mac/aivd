import { and, eq } from "drizzle-orm";

import { db, mediaAssets, videos } from "@/db";
import { requireAuth } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/error";
import { handleApiError } from "@/lib/api/response";
import { getStorage } from "@/lib/storage";

/** Same-origin read for Agent visual samples; storage URLs remain private. */
export async function GET(request: Request) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const keyParam = url.searchParams.get("key");
    const uuid = url.searchParams.get("uuid");
    const index = Number(url.searchParams.get("index") ?? "0");
    if (!Number.isInteger(index) || index < 0 || index > 8) throw new ApiError("Invalid asset index.", 400);
    let key: string | null = null;
    let mimeType = "application/octet-stream";
    if (keyParam) {
      const [asset] = await db.select().from(mediaAssets)
        .where(and(eq(mediaAssets.userId, user.id), eq(mediaAssets.key, keyParam))).limit(1);
      if (asset) { key = asset.key; mimeType = asset.mimeType; }
    } else if (uuid) {
      const [output] = await db.select().from(videos)
        .where(and(eq(videos.userId, user.id), eq(videos.uuid, uuid))).limit(1);
      if (output?.status === "COMPLETED" && output.videoUrl) {
        const extra = Array.isArray(output.parameters?.extraKeys) ? output.parameters.extraKeys : [];
        const candidate = [output.videoUrl, ...extra][index];
        key = typeof candidate === "string" ? candidate : null;
        mimeType = output.mediaType === "image" ? "image/png" : output.mediaType === "video" ? "video/mp4" : "application/octet-stream";
      }
    }
    if (!key) throw new ApiError("Asset not found.", 404);
    const response = await fetch(getStorage().getSignedUrl(key));
    if (!response.ok) throw new ApiError("Could not read asset.", 502);
    return new Response(response.body, { headers: { "content-type": response.headers.get("content-type") ?? mimeType, "cache-control": "private, no-store" } });
  } catch (error) { return handleApiError(error); }
}
