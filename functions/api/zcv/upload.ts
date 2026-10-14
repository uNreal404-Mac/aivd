import { ensureGuestCookie, identifyZcvRequest, imageExtensionFromUpload, storeZcvAsset, type ZcvEnv } from "../../../libs/zcvService";
import { reserveZcvUploadSlot, releaseZcvQuotaSlot, ZCV_MAX_UPLOAD_BYTES } from "../../../libs/zcv";
import { json } from "../../../libs/utils";
import { zcvQuotaKey } from "../../../libs/zcvService";

export const onRequestPost: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.SESSIONS || !env.MEDIA) return json({ error: "zcv_storage_unavailable" }, 503);
  const identity = await identifyZcvRequest(request, env);
  const guest = identity.userId ? null : ensureGuestCookie(request);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > ZCV_MAX_UPLOAD_BYTES) return json({ error: "file_too_large" }, 413);
  let bytes: ArrayBuffer;
  try { bytes = await request.arrayBuffer(); } catch { return json({ error: "upload_read_failed" }, 400); }
  if (bytes.byteLength < 32 || bytes.byteLength > ZCV_MAX_UPLOAD_BYTES) return json({ error: "file_size_invalid" }, bytes.byteLength > ZCV_MAX_UPLOAD_BYTES ? 413 : 400);
  const ext = imageExtensionFromUpload(bytes, request.headers.get("content-type") || "");
  if (!ext) return json({ error: "unsupported_image" }, 415);
  const owner = identity.userId
    ? { ownerKind: "user" as const, userId: identity.userId, guestId: null }
    : { ownerKind: "guest" as const, userId: null, guestId: guest!.id };
  const quotaKey = await zcvQuotaKey(request, identity.userId, identity.guestId || guest?.id || null, "upload");
  if (!(await reserveZcvUploadSlot(env.DB, quotaKey))) return json({ error: "daily_upload_limit_reached", limit: 8, window: "24 hours" }, 429, guest ? { "set-cookie": guest.header } : undefined);
  try {
    const asset = await storeZcvAsset(env, owner, "input", bytes, ext === "jpg" ? "image/jpeg" : `image/${ext}`, ext);
    return json({ ok: true, assetId: asset.id, contentType: asset.content_type, guest: !identity.userId }, 201,
      guest ? { "set-cookie": guest.header } : undefined);
  } catch (error) {
    await releaseZcvQuotaSlot(env.DB, quotaKey);
    return json({ error: "upload_store_failed", message: error instanceof Error ? error.message : "storage failed" }, 502);
  }
};
