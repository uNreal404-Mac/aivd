import { getSession, tokenFromRequest } from "../../../libs/auth";
import { guestIdFromRequest, hashIp } from "../../../libs/guest";
import { json } from "../../../libs/utils";
import { loadOwnedZcvAsset, loadZcvPreview, newZcvId, releaseZcvQuotaSlot, reserveZcvPreviewSlot, viewerOwns, type ZcvPreview } from "../../../libs/zcv";
import { identifyZcvRequest, zcvQuotaKey, type ZcvEnv } from "../../../libs/zcvService";
import { startZcvPreviewTask, syncZcvPreview } from "../../../libs/zcvWorkflow";

function publicState(row: ZcvPreview) {
  return {
    id: row.id,
    status: row.status,
    previewAssetId: row.preview_asset_id,
    previewUrl: row.preview_asset_id ? `/api/zcv/media?assetId=${encodeURIComponent(row.preview_asset_id)}` : null,
    error: row.status === "needs_check" ? "We are checking the generation status. It will not be started twice." : row.last_error,
  };
}

export const onRequestGet: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.SESSIONS) return json({ error: "storage_unavailable" }, 503);
  const id = new URL(request.url).searchParams.get("id") || "";
  const row = await loadZcvPreview(env.DB, id);
  if (!row) return json({ error: "preview_not_found" }, 404);
  const viewer = await identifyZcvRequest(request, env);
  if (!viewerOwns(row, viewer)) return json({ error: "forbidden" }, 403);
  const fresh = row.task_id && ["processing", "needs_check"].includes(row.status)
    ? await syncZcvPreview(env as ZcvEnv, id, new URL(request.url).origin)
    : row;
  return json({ ok: true, preview: publicState(fresh || row) });
};

export const onRequestPost: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.SESSIONS || !env.MEDIA) return json({ error: "storage_unavailable" }, 503);
  if (!env.KIE_API_KEY) return json({ error: "preview_provider_unavailable" }, 503);
  const identity = await identifyZcvRequest(request, env);
  if (!identity.userId && !identity.guestId) return json({ error: "guest_cookie_missing" }, 400);
  let body: { assetId?: string };
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const assetId = typeof body.assetId === "string" ? body.assetId : "";
  const asset = await loadOwnedZcvAsset(env.DB, assetId, { userId: identity.userId, guestId: identity.guestId });
  if (!asset) return json({ error: "asset_forbidden_or_missing" }, 403);
  if (asset.asset_kind !== "input") return json({ error: "input_asset_required" }, 400);
  const owner = identity.userId
    ? { ownerKind: "user", userId: identity.userId, guestId: null }
    : { ownerKind: "guest", userId: null, guestId: identity.guestId };
  const existing = await env.DB.prepare(
    "SELECT * FROM zcv_previews WHERE input_asset_id=? AND status!='failed' ORDER BY created_at DESC LIMIT 1"
  ).bind(assetId).first<ZcvPreview>();
  if (existing) return json({ ok: true, preview: publicState(existing) }, existing.status === "ready" ? 200 : 202);

  const id = newZcvId("zcp");
  const callbackToken = newZcvId("cb");
  const quotaKey = await zcvQuotaKey(request, identity.userId, identity.guestId, "preview");
  if (!(await reserveZcvPreviewSlot(env.DB, quotaKey))) return json({ error: "free_preview_limit_reached", limit: 2, window: "24 hours" }, 429);
  try {
    await env.DB.prepare(
      "INSERT INTO zcv_previews (id,owner_kind,user_id,guest_id,input_asset_id,callback_token,model,model_version,status) VALUES (?,?,?,?,?,?,?,'nano-banana-2','starting')"
    ).bind(id, owner.ownerKind, owner.userId, owner.guestId, assetId, callbackToken, "nano-banana-2").run();
  } catch {
    await releaseZcvQuotaSlot(env.DB, quotaKey);
    const concurrent = await env.DB.prepare(
      "SELECT * FROM zcv_previews WHERE input_asset_id=? AND status IN ('starting','processing','needs_check','ready') ORDER BY created_at DESC LIMIT 1"
    ).bind(assetId).first<ZcvPreview>();
    if (concurrent) return json({ ok: true, preview: publicState(concurrent) }, concurrent.status === "ready" ? 200 : 202);
    return json({ error: "preview_create_failed" }, 500);
  }
  const preview = (await loadZcvPreview(env.DB, id))!;
  const started = await startZcvPreviewTask(env, preview, new URL(request.url).origin);
  const fresh = await loadZcvPreview(env.DB, id);
  if (!fresh) return json({ error: "preview_state_missing" }, 500);
  return json({ ok: started !== "failed", preview: publicState(fresh) }, started === "failed" ? 502 : 202);
};
