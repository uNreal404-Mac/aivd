import { identifyZcvRequest, type ZcvEnv } from "../../../libs/zcvService";
import { loadZcvAsset, viewerOwns } from "../../../libs/zcv";
import { json } from "../../../libs/utils";

export const onRequestGet: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.MEDIA || !env.SESSIONS) return json({ error: "storage_unavailable" }, 503);
  const assetId = new URL(request.url).searchParams.get("assetId") || "";
  if (!assetId) return json({ error: "asset_required" }, 400);
  const asset = await loadZcvAsset(env.DB, assetId);
  if (!asset) return json({ error: "asset_not_found" }, 404);
  const viewer = await identifyZcvRequest(request, env);
  if (!viewerOwns(asset, viewer)) return json({ error: "forbidden" }, 403);
  // The generated full-resolution still is only a private KIE input; guests and users
  // receive the reduced, watermarked preview or a paid video, never this source image.
  if (asset.asset_kind === "video_input") return json({ error: "forbidden" }, 403);
  if (asset.asset_kind === "video") {
    if (!viewer.userId) return json({ error: "forbidden" }, 403);
    const delivered = await env.DB.prepare(
      "SELECT id FROM zcv_orders WHERE output_asset_id=? AND user_id=? AND payment_status='paid' AND status='delivered' LIMIT 1"
    ).bind(asset.id, viewer.userId).first<{ id: string }>();
    if (!delivered) return json({ error: "forbidden" }, 403);
  }
  const object = await env.MEDIA.get(asset.r2_key);
  if (!object) return json({ error: "asset_not_found" }, 404);
  const headers = new Headers({
    "content-type": asset.content_type,
    "cache-control": "private, no-store, max-age=0",
    "x-content-type-options": "nosniff",
    "content-disposition": new URL(request.url).searchParams.get("download") === "1"
      ? `attachment; filename="zombie-couple-${asset.asset_kind}.${asset.content_type === "video/mp4" ? "mp4" : asset.content_type === "image/png" ? "png" : "jpg"}"`
      : "inline",
  });
  object.writeHttpMetadata(headers);
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("content-disposition", new URL(request.url).searchParams.get("download") === "1"
    ? `attachment; filename="zombie-couple-${asset.asset_kind}.${asset.content_type === "video/mp4" ? "mp4" : asset.content_type === "image/png" ? "png" : "jpg"}"`
    : "inline");
  return new Response(object.body, { headers });
};
