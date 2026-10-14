import { getSession, tokenFromRequest, type Session } from "./auth";
import { guestCookieHeader, guestIdFromRequest, ensureGuestId, hashIp } from "./guest";
import { extForResultType, mimeForExt, sniffImageExt } from "./media";
import { newProviderToken, makeZcvAssetKey, newZcvId, type ZcvAsset } from "./zcv";
import type { Env } from "./utils";

export type ZcvEnv = Env & { DB: D1Database; SESSIONS: KVNamespace; MEDIA: R2Bucket };

export async function identifyZcvRequest(request: Request, env: Env): Promise<{
  session: Session | null;
  userId: number | null;
  guestId: string | null;
}> {
  const session = env.SESSIONS ? await getSession(env as { SESSIONS: KVNamespace }, tokenFromRequest(request)) : null;
  return {
    session,
    userId: session?.userId ?? null,
    guestId: session ? null : guestIdFromRequest(request),
  };
}

export function ensureGuestCookie(request: Request): { id: string; header: string } {
  const id = ensureGuestId(request);
  return { id, header: guestCookieHeader(id, request) };
}

export async function zcvQuotaKey(request: Request, userId: number | null, guestId: string | null, purpose: "preview" | "upload"): Promise<string> {
  if (userId !== null) return `${purpose}_user_${userId}`;
  const ip = request.headers.get("cf-connecting-ip")?.trim() || "";
  if (ip) return `${purpose}_ip_${await hashIp(ip)}`;
  return `${purpose}_guest_${guestId || "anonymous"}`;
}

export async function storeZcvAsset(
  env: ZcvEnv,
  owner: { ownerKind: "user" | "guest"; userId: number | null; guestId: string | null },
  kind: ZcvAsset["asset_kind"],
  bytes: ArrayBuffer | Uint8Array,
  contentType: string,
  ext: string,
  stableId?: string,
): Promise<ZcvAsset> {
  const id = stableId || newZcvId("zcv");
  const key = makeZcvAssetKey(id, ext);
  await env.MEDIA.put(key, bytes, {
    httpMetadata: { contentType, cacheControl: "private, no-store, max-age=0" },
    customMetadata: {
      visibility: "private",
      ownerKind: owner.ownerKind,
      userId: owner.userId === null ? "" : String(owner.userId),
      guestId: owner.guestId || "",
      assetKind: kind,
    },
  });
  try {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO zcv_assets (id,r2_key,owner_kind,user_id,guest_id,asset_kind,content_type) VALUES (?,?,?,?,?,?,?)"
    ).bind(id, key, owner.ownerKind, owner.userId, owner.guestId, kind, contentType).run();
  } catch (e) {
    await env.MEDIA.delete(key).catch(() => undefined);
    throw e;
  }
  const row = await env.DB.prepare(
    "SELECT id,r2_key,owner_kind,user_id,guest_id,asset_kind,content_type FROM zcv_assets WHERE id=?"
  ).bind(id).first<ZcvAsset>();
  if (!row) throw new Error("asset registration failed");
  return row;
}

export async function storeZcvProviderResult(
  env: ZcvEnv,
  sourceUrl: string,
  owner: { ownerKind: "user" | "guest"; userId: number | null; guestId: string | null },
  kind: "full" | "video",
  stableId: string,
): Promise<ZcvAsset> {
  const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`provider_result_fetch_${response.status}`);
  const bytes = await response.arrayBuffer();
  const max = 40 * 1024 * 1024;
  if (bytes.byteLength < 32 || bytes.byteLength > max) throw new Error("provider_result_size_invalid");
  const ext = extForResultType(response.headers.get("content-type") || "", sourceUrl);
  const allowed = kind === "video" ? ext === "mp4" : ["jpg", "png", "webp"].includes(ext || "");
  if (!ext || !allowed) throw new Error("provider_result_type_invalid");
  return storeZcvAsset(env, owner, kind === "video" ? "video" : "video_input", bytes, mimeForExt(ext), ext, stableId);
}

export async function grantProviderFetch(env: ZcvEnv, key: string, origin: string): Promise<string> {
  const token = newProviderToken();
  await env.SESSIONS.put(`zcv:provider:${token}`, key, { expirationTtl: 30 * 60 });
  return `${origin}/api/zcv/provider-media?token=${encodeURIComponent(token)}`;
}

export function imageExtensionFromUpload(buffer: ArrayBuffer, contentType: string): string | null {
  const sniffed = sniffImageExt(buffer);
  if (!sniffed || !["jpg", "png", "webp"].includes(sniffed)) return null;
  const declared = contentType.split(";")[0].trim().toLowerCase();
  if (declared.startsWith("image/") && !["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(declared)) return null;
  return sniffed;
}
