import { createImageTask, createImageToVideoTask, getTaskInfo, type KieTaskInfo } from "./kie";
import { makeWatermarkedPreview } from "./zcvPreviewImage";
import { storeZcvProviderResult, grantProviderFetch, type ZcvEnv } from "./zcvService";
import { claimPaidGeneration, loadZcvOrder, loadZcvPreview, loadZcvAsset, ZCV_IMAGE_COST_USD, ZCV_VIDEO_COST_USD, ZCV_MODERATION_COST_USD, ZCV_MAX_VIDEO_ATTEMPTS, ZCV_USD_PER_KIE_CREDIT_ESTIMATE, type ZcvOrder, type ZcvPreview } from "./zcv";
import { refundZcvPayment } from "./stripe";
import { inspectZcvMp4 } from "./zcvVideo";
import { moderateZcvVideo } from "./zcvModeration";

export const ZCV_PREVIEW_PROMPT =
  "Transform the supplied couple photo into a cute, playful, non-gory cartoon zombie couple portrait. Preserve both people and their recognizable clothing and pose. Use friendly pastel Halloween styling, soft studio lighting, clean composition. No blood, wounds, exposed bones, gore, weapons, text, or extra people.";

export const ZCV_VIDEO_PROMPT =
  "Animate this cute, playful, non-gory cartoon zombie couple for a gentle 10-second Halloween moment: they smile, lean together, and make a small affectionate turn toward camera. Keep both people consistent with the start frame. No blood, wounds, exposed bones, gore, weapons, camera cuts, or extra people. Silent video.";

function providerCredits(info: KieTaskInfo): number | null {
  return typeof info.creditsConsumed === "number" && Number.isFinite(info.creditsConsumed) && info.creditsConsumed >= 0
    ? info.creditsConsumed
    : null;
}

function estimatedUsdFromCredits(credits: number): number {
  return credits * ZCV_USD_PER_KIE_CREDIT_ESTIMATE;
}

export async function startZcvPreviewTask(env: ZcvEnv, preview: ZcvPreview, origin: string): Promise<"started" | "needs_check" | "failed"> {
  if (!env.KIE_API_KEY) return "failed";
  const input = await loadZcvAsset(env.DB, preview.input_asset_id);
  if (!input) return "failed";
  const imageUrl = await grantProviderFetch(env, input.r2_key, origin);
  const callback = `${origin}/api/zcv/kie-callback?type=preview&id=${encodeURIComponent(preview.id)}&token=${encodeURIComponent(preview.callback_token)}`;
  const created = await createImageTask(env.KIE_API_KEY, {
    prompt: ZCV_PREVIEW_PROMPT,
    imageUrls: [imageUrl],
    resolution: "1K",
    callBackUrl: callback,
  });
  if (created.ok) {
    await env.DB.prepare("UPDATE zcv_previews SET task_id=?, status='processing', model_cost_usd=?, model_cost_cents=3, updated_at=datetime('now') WHERE id=? AND task_id IS NULL AND status='starting'")
      .bind(created.taskId, ZCV_IMAGE_COST_USD, preview.id).run();
    return "started";
  }
  const status = created.certainty === "unknown" ? "needs_check" : "failed";
  await env.DB.prepare("UPDATE zcv_previews SET status=?, last_error=?, model_cost_usd=?, model_cost_cents=?, updated_at=datetime('now') WHERE id=? AND task_id IS NULL AND status='starting'")
    .bind(status, created.message.slice(0, 300), created.certainty === "unknown" ? ZCV_IMAGE_COST_USD : 0, created.certainty === "unknown" ? 3 : 0, preview.id).run();
  return status;
}

export async function settleZcvPreview(env: ZcvEnv, preview: ZcvPreview, info: KieTaskInfo, origin: string): Promise<ZcvPreview | null> {
  if (preview.status === "ready" || preview.status === "failed") return preview;
  const credits = providerCredits(info);
  const providerCostUsd = credits === null ? null : estimatedUsdFromCredits(credits);
  const providerCostCents = providerCostUsd === null ? null : Math.round(providerCostUsd * 100);
  if (info.state === "fail") {
    await env.DB.prepare("UPDATE zcv_previews SET status='failed', last_error=?, model_provider_credits=COALESCE(?,model_provider_credits), model_cost_usd=COALESCE(?,model_cost_usd), model_cost_cents=COALESCE(?,model_cost_cents), updated_at=datetime('now') WHERE id=? AND status IN ('processing','starting','needs_check')")
      .bind((info.failMsg || info.failCode || "KIE image task failed").slice(0, 300), credits, providerCostUsd, providerCostCents, preview.id).run();
    return loadZcvPreview(env.DB, preview.id);
  }
  if (info.state !== "success" || !info.resultUrl) return preview;
  const owner = { ownerKind: preview.owner_kind, userId: preview.user_id, guestId: preview.guest_id };
  try {
    const fullId = `${preview.id}_full`;
    const previewId = `${preview.id}_watermark`;
    const fullAsset = await storeZcvProviderResult(env, info.resultUrl, owner, "full", fullId);
    const fullObject = await env.MEDIA.get(fullAsset.r2_key);
    if (!fullObject) throw new Error("full_preview_missing_from_r2");
    const transformed = makeWatermarkedPreview(new Uint8Array(await fullObject.arrayBuffer()));
    const watermarked = await env.MEDIA.put(`zcv/${previewId}.jpg`, transformed.bytes, {
      httpMetadata: { contentType: transformed.contentType, cacheControl: "private, no-store, max-age=0" },
      customMetadata: { visibility: "private", ownerKind: owner.ownerKind, userId: owner.userId === null ? "" : String(owner.userId), guestId: owner.guestId || "", assetKind: "preview" },
    });
    void watermarked;
    await env.DB.prepare("INSERT OR IGNORE INTO zcv_assets (id,r2_key,owner_kind,user_id,guest_id,asset_kind,content_type) VALUES (?,?,?,?,?,?,?)")
      .bind(previewId, `zcv/${previewId}.jpg`, owner.ownerKind, owner.userId, owner.guestId, "preview", transformed.contentType).run();
    await env.DB.prepare("UPDATE zcv_previews SET full_asset_id=?, preview_asset_id=?, status='ready', model_provider_credits=COALESCE(?,model_provider_credits), model_cost_usd=COALESCE(?,?), model_cost_cents=COALESCE(?,CAST(ROUND(?*100) AS INTEGER)), last_error=NULL, updated_at=datetime('now') WHERE id=? AND status IN ('processing','starting','needs_check')")
      .bind(fullAsset.id, previewId, credits, providerCostUsd, ZCV_IMAGE_COST_USD, providerCostCents, ZCV_IMAGE_COST_USD, preview.id).run();
  } catch (error) {
    await env.DB.prepare("UPDATE zcv_previews SET last_error=?, updated_at=datetime('now') WHERE id=? AND status IN ('processing','starting','needs_check')")
      .bind(error instanceof Error ? error.message.slice(0, 300) : "preview_delivery_failed", preview.id).run();
  }
  return loadZcvPreview(env.DB, preview.id);
}

export async function startZcvPaidVideo(env: ZcvEnv, orderId: string, origin: string): Promise<string> {
  if (!env.KIE_API_KEY) return "provider_unavailable";
  const claimed = await claimPaidGeneration(env.DB, orderId);
  if (!claimed) {
    const current = await loadZcvOrder(env.DB, orderId);
    return current?.status || "order_not_found";
  }
  const order = await loadZcvOrder(env.DB, orderId);
  const input = order?.video_input_asset_id ? await loadZcvAsset(env.DB, order.video_input_asset_id) : null;
  if (!order || !input) {
    await env.DB.prepare("UPDATE zcv_orders SET status='failed', last_error='paid_input_missing', updated_at=datetime('now') WHERE id=? AND status='video_starting'").bind(orderId).run();
    return "failed";
  }
  const imageUrl = await grantProviderFetch(env, input.r2_key, origin);
  const callback = `${origin}/api/zcv/kie-callback?type=order&id=${encodeURIComponent(order.id)}&token=${encodeURIComponent(order.callback_token)}`;
  const created = await createImageToVideoTask(env.KIE_API_KEY, {
    prompt: ZCV_VIDEO_PROMPT,
    imageUrl,
    durationSec: 10,
    sound: false,
    callBackUrl: callback,
  });
  if (created.ok) {
    await env.DB.batch([
      env.DB.prepare("UPDATE zcv_task_attempts SET task_id=?, status='generating', updated_at=datetime('now') WHERE order_id=? AND attempt=? AND task_id IS NULL AND status IN ('starting','needs_check')")
        .bind(created.taskId, order.id, order.generation_attempts),
      env.DB.prepare("UPDATE zcv_orders SET video_task_id=?, status='generating', last_error=NULL, updated_at=datetime('now') WHERE id=? AND generation_attempts=? AND callback_token=? AND status IN ('video_starting','needs_check','generating') AND (video_task_id IS NULL OR video_task_id=?)")
        .bind(created.taskId, order.id, order.generation_attempts, order.callback_token, created.taskId),
    ]);
    return (await loadZcvOrder(env.DB, order.id))?.status || "needs_check";
  }
  if (created.certainty === "unknown") {
    await env.DB.batch([
      env.DB.prepare("UPDATE zcv_task_attempts SET status='needs_check', last_error=?, updated_at=datetime('now') WHERE order_id=? AND attempt=? AND task_id IS NULL AND status='starting'")
        .bind(created.message.slice(0, 300), order.id, order.generation_attempts),
      env.DB.prepare("UPDATE zcv_orders SET status='needs_check', video_cost_usd=?, last_error=?, updated_at=datetime('now') WHERE id=? AND generation_attempts=? AND callback_token=? AND status='video_starting' AND video_task_id IS NULL")
        .bind(ZCV_VIDEO_COST_USD, created.message.slice(0, 300), order.id, order.generation_attempts, order.callback_token),
    ]);
    return (await loadZcvOrder(env.DB, order.id))?.status || "needs_check";
  }
  await env.DB.batch([
    env.DB.prepare("UPDATE zcv_task_attempts SET status='rejected', estimated_cost_usd=0, estimated_cost_cents=0, moderation_estimated_cost_usd=0, moderation_estimated_cost_cents=0, moderation_status='not_run', last_error=?, updated_at=datetime('now') WHERE order_id=? AND attempt=? AND task_id IS NULL AND status='starting'")
      .bind(created.message.slice(0, 300), order.id, order.generation_attempts),
    env.DB.prepare("UPDATE zcv_orders SET status='failed', video_cost_usd=MAX(0, video_cost_usd-?), video_cost_cents=MAX(0,video_cost_cents-28), total_cost_cents=MAX(0,total_cost_cents-29), last_error=?, updated_at=datetime('now') WHERE id=? AND generation_attempts=? AND callback_token=? AND status='video_starting' AND video_task_id IS NULL")
      .bind(ZCV_VIDEO_COST_USD, created.message.slice(0, 300), order.id, order.generation_attempts, order.callback_token),
  ]);
  const failedOrder = await loadZcvOrder(env.DB, order.id);
  if (failedOrder && failedOrder.generation_attempts >= ZCV_MAX_VIDEO_ATTEMPTS) await refundFailedOrder(env, failedOrder, failedOrder.last_error || "video_task_rejected");
  else if (failedOrder) {
    await env.DB.prepare("UPDATE zcv_orders SET status='video_retry', updated_at=datetime('now') WHERE id=? AND status='failed'").bind(order.id).run();
    return startZcvPaidVideo(env, order.id, origin);
  }
  return "failed";
}

async function refundFailedOrder(env: ZcvEnv, order: ZcvOrder, message: string): Promise<void> {
  const secretKey = env.STRIPE_SECRET_KEY;
  const testKey = secretKey?.startsWith("sk_test_") || secretKey?.startsWith("rk_test_");
  if (!secretKey || !testKey || !order.payment_intent_id) {
    await env.DB.prepare("UPDATE zcv_orders SET status='refund_required', last_error=?, updated_at=datetime('now') WHERE id=?")
      .bind(message.slice(0, 300), order.id).run();
    return;
  }
  const result = await refundZcvPayment({ secretKey, paymentIntentId: order.payment_intent_id, orderId: order.id });
  if (result.ok) {
    await env.DB.prepare("UPDATE zcv_orders SET status='refunded', refund_id=?, refund_status='succeeded', last_error=?, updated_at=datetime('now') WHERE id=?")
      .bind(result.id, message.slice(0, 300), order.id).run();
  } else {
    await env.DB.prepare("UPDATE zcv_orders SET status='refund_required', refund_status='failed', last_error=?, updated_at=datetime('now') WHERE id=?")
      .bind(`${message}; ${result.message}`.slice(0, 300), order.id).run();
  }
}

async function deleteRejectedOutput(env: ZcvEnv, assetId: string | null): Promise<void> {
  if (!assetId) return;
  const asset = await loadZcvAsset(env.DB, assetId);
  if (asset) await env.MEDIA.delete(asset.r2_key).catch(() => undefined);
}

async function failPaidAttempt(
  env: ZcvEnv,
  order: ZcvOrder,
  opts: { reason: string; attemptStatus: string; moderationStatus: string; allowRetry: boolean; removeModerationEstimate: boolean; outputAssetId?: string | null; providerCreditsConsumed?: number | null },
  origin: string,
): Promise<ZcvOrder | null> {
  const status = opts.allowRetry && order.generation_attempts < ZCV_MAX_VIDEO_ATTEMPTS ? "video_retry" : "failed";
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE zcv_task_attempts SET status=?, moderation_status=?, moderation_reason=?, moderation_provider_credits=?,
        moderation_estimated_cost_usd=CASE WHEN ? THEN 0 ELSE moderation_estimated_cost_usd END,
        moderation_estimated_cost_cents=CASE WHEN ? THEN 0 ELSE moderation_estimated_cost_cents END,
        updated_at=datetime('now') WHERE order_id=? AND attempt=? AND task_id=?`
    ).bind(opts.attemptStatus, opts.moderationStatus, opts.reason.slice(0, 200), opts.providerCreditsConsumed ?? null, opts.removeModerationEstimate ? 1 : 0, opts.removeModerationEstimate ? 1 : 0, order.id, order.generation_attempts, order.video_task_id),
    env.DB.prepare(
      `UPDATE zcv_orders SET status=?,
        total_cost_cents=MAX(0,total_cost_cents-?), last_error=?, updated_at=datetime('now')
       WHERE id=? AND generation_attempts=? AND video_task_id=? AND payment_status='paid' AND status IN ('generating','needs_check')`
    ).bind(status, opts.removeModerationEstimate ? 1 : 0, opts.reason.slice(0, 300), order.id, order.generation_attempts, order.video_task_id),
  ]);
  await deleteRejectedOutput(env, opts.outputAssetId || null);
  const fresh = await loadZcvOrder(env.DB, order.id);
  if (fresh?.status === "video_retry") {
    await startZcvPaidVideo(env, order.id, origin);
    return loadZcvOrder(env.DB, order.id);
  }
  if (fresh?.status === "failed") {
    await refundFailedOrder(env, fresh, fresh.last_error || opts.reason);
    return loadZcvOrder(env.DB, order.id);
  }
  return fresh;
}

async function loadZcvAttempt(env: ZcvEnv, order: ZcvOrder) {
  return env.DB.prepare("SELECT * FROM zcv_task_attempts WHERE order_id=? AND attempt=? AND task_id=?")
    .bind(order.id, order.generation_attempts, order.video_task_id).first<{
      status: string;
      output_asset_id: string | null;
      moderation_status: string;
      moderation_call_count: number;
      moderation_reason: string | null;
      moderation_provider_credits: number | null;
      updated_at: string;
    }>();
}

async function recordVideoProviderCredits(env: ZcvEnv, order: ZcvOrder, credits: number | null): Promise<void> {
  if (credits === null || !order.video_task_id) return;
  const costUsd = estimatedUsdFromCredits(credits);
  const costCents = Math.round(costUsd * 100);
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE zcv_task_attempts SET provider_credits_consumed=?, estimated_cost_usd=?, estimated_cost_cents=?, updated_at=datetime('now') WHERE order_id=? AND attempt=? AND task_id=?"
    ).bind(credits, costUsd, costCents, order.id, order.generation_attempts, order.video_task_id),
    env.DB.prepare(
      `UPDATE zcv_orders SET
        video_provider_credits=COALESCE((SELECT SUM(provider_credits_consumed) FROM zcv_task_attempts WHERE order_id=?),0),
        video_cost_usd=COALESCE((SELECT SUM(estimated_cost_usd) FROM zcv_task_attempts WHERE order_id=?),0),
        video_cost_cents=COALESCE((SELECT SUM(estimated_cost_cents) FROM zcv_task_attempts WHERE order_id=?),0),
        total_cost_cents=COALESCE((SELECT model_cost_cents FROM zcv_previews WHERE id=zcv_orders.preview_id),0)
          + COALESCE((SELECT SUM(estimated_cost_cents) FROM zcv_task_attempts WHERE order_id=?),0)
          + COALESCE((SELECT SUM(moderation_estimated_cost_cents) FROM zcv_task_attempts WHERE order_id=?),0),
        updated_at=datetime('now')
       WHERE id=? AND video_task_id=? AND generation_attempts=? AND payment_status='paid' AND status IN ('generating','needs_check')`
    ).bind(order.id, order.id, order.id, order.id, order.id, order.id, order.video_task_id, order.generation_attempts),
  ]);
}

async function approveOutput(env: ZcvEnv, order: ZcvOrder, assetId: string, reason: string, providerCredits: number | null): Promise<ZcvOrder | null> {
  await env.DB.batch([
    env.DB.prepare("UPDATE zcv_task_attempts SET status='delivered', moderation_status='passed', moderation_reason=?, moderation_provider_credits=?, updated_at=datetime('now') WHERE order_id=? AND attempt=? AND task_id=? AND moderation_status='checking'")
      .bind(reason.slice(0, 200), providerCredits, order.id, order.generation_attempts, order.video_task_id),
    env.DB.prepare("UPDATE zcv_orders SET output_asset_id=?, status='delivered', last_error=NULL, updated_at=datetime('now') WHERE id=? AND payment_status='paid' AND video_task_id=? AND status='needs_check'")
      .bind(assetId, order.id, order.video_task_id),
  ]);
  return loadZcvOrder(env.DB, order.id);
}

export async function settleZcvVideo(env: ZcvEnv, order: ZcvOrder, info: KieTaskInfo, origin: string): Promise<ZcvOrder | null> {
  if (["delivered", "refunded"].includes(order.status)) return order;
  const credits = providerCredits(info);
  if (info.state === "fail") {
    await recordVideoProviderCredits(env, order, credits);
    return failPaidAttempt(env, order, {
      reason: (info.failMsg || info.failCode || "KIE video task failed").slice(0, 300),
      attemptStatus: "failed",
      moderationStatus: "not_run",
      allowRetry: true,
      removeModerationEstimate: true,
    }, origin);
  }
  if (info.state !== "success" || !info.resultUrl) return order;
  if (!order.video_task_id) return order;
  await recordVideoProviderCredits(env, order, credits);
  const attempt = await loadZcvAttempt(env, order);
  if (!attempt || ["checking", "passed", "gore", "unknown", "not_run"].includes(attempt.moderation_status)) return order;
  const owner = { ownerKind: "user" as const, userId: order.user_id, guestId: null };
  const outputId = `${order.id}_video_${order.generation_attempts}`;
  try {
    const output = await storeZcvProviderResult(env, info.resultUrl, owner, "video", outputId);
    const stored = await env.MEDIA.get(output.r2_key);
    if (!stored) throw new Error("video_output_missing_from_r2");
    const inspection = inspectZcvMp4(new Uint8Array(await stored.arrayBuffer()));
    const metadata = inspection.ok
      ? { width: inspection.width, height: inspection.height, durationSec: inspection.durationSec, hasAudio: 0 }
      : { width: inspection.width ?? null, height: inspection.height ?? null, durationSec: inspection.durationSec ?? null, hasAudio: inspection.hasAudio === undefined ? null : Number(inspection.hasAudio) };
    await env.DB.prepare(
      `UPDATE zcv_task_attempts SET output_asset_id=?, video_width=?, video_height=?, video_duration_sec=?, video_has_audio=?, updated_at=datetime('now')
       WHERE order_id=? AND attempt=? AND task_id=? AND moderation_status='pending'`
    ).bind(output.id, metadata.width, metadata.height, metadata.durationSec, metadata.hasAudio, order.id, order.generation_attempts, order.video_task_id).run();
    if (!inspection.ok) {
      return failPaidAttempt(env, order, {
        reason: inspection.reason,
        attemptStatus: "rejected",
        moderationStatus: "not_run",
        allowRetry: true,
        removeModerationEstimate: true,
        outputAssetId: output.id,
      }, origin);
    }

    const orderClaim = await env.DB.prepare(
      "UPDATE zcv_orders SET status='needs_check', last_error=NULL, updated_at=datetime('now') WHERE id=? AND payment_status='paid' AND video_task_id=? AND status IN ('generating','needs_check')"
    ).bind(order.id, order.video_task_id).run();
    if ((orderClaim.meta.changes ?? 0) !== 1) return loadZcvOrder(env.DB, order.id);
    const moderationClaim = await env.DB.prepare(
      `UPDATE zcv_task_attempts SET status='moderating', moderation_status='checking', moderation_call_count=moderation_call_count+1, updated_at=datetime('now')
       WHERE order_id=? AND attempt=? AND task_id=? AND moderation_status='pending'`
    ).bind(order.id, order.generation_attempts, order.video_task_id).run();
    if ((moderationClaim.meta.changes ?? 0) !== 1) return loadZcvOrder(env.DB, order.id);

    const videoUrl = await grantProviderFetch(env, output.r2_key, origin);
    const review = await moderateZcvVideo(env.KIE_API_KEY || "", videoUrl);
    if (review.decision === "safe") {
      await approveOutput(env, order, output.id, review.reason || "safe", review.providerCreditsConsumed);
      return loadZcvOrder(env.DB, order.id);
    }
    return failPaidAttempt(env, order, {
      reason: review.reason || (review.decision === "gore" ? "moderation_rejected_video" : "moderation_result_unknown"),
      attemptStatus: review.decision === "gore" ? "rejected" : "needs_check",
      moderationStatus: review.decision,
      allowRetry: review.decision === "gore",
      removeModerationEstimate: false,
      outputAssetId: output.id,
      providerCreditsConsumed: review.providerCreditsConsumed,
    }, origin);
  } catch (error) {
    await env.DB.prepare("UPDATE zcv_orders SET last_error=?, updated_at=datetime('now') WHERE id=? AND status IN ('generating','needs_check')")
      .bind(error instanceof Error ? error.message.slice(0, 300) : "video_delivery_failed", order.id).run();
  }
  return loadZcvOrder(env.DB, order.id);
}

export async function syncZcvOrder(env: ZcvEnv, orderId: string, origin: string): Promise<ZcvOrder | null> {
  let order = await loadZcvOrder(env.DB, orderId);
  if (!order) return null;
  if (order.status === "video_starting" && !order.video_task_id) {
    await env.DB.prepare("UPDATE zcv_orders SET status='needs_check', last_error='KIE task callback pending; automatic retry is disabled', updated_at=datetime('now') WHERE id=? AND status='video_starting' AND video_task_id IS NULL AND updated_at < datetime('now','-2 minutes')")
      .bind(orderId).run();
    order = await loadZcvOrder(env.DB, orderId);
  }
  if (order?.video_task_id && order.status === "needs_check") {
    const attempt = await loadZcvAttempt(env, order);
    if (attempt?.moderation_status === "checking") {
      const timedOut = await env.DB.prepare(
        `UPDATE zcv_task_attempts SET moderation_status='unknown', status='needs_check', moderation_reason='moderation_result_unknown', updated_at=datetime('now')
         WHERE order_id=? AND attempt=? AND task_id=? AND moderation_status='checking' AND updated_at < datetime('now','-2 minutes')`
      ).bind(order.id, order.generation_attempts, order.video_task_id).run();
      if ((timedOut.meta.changes ?? 0) === 1) {
        await env.DB.prepare("UPDATE zcv_orders SET status='failed', last_error='moderation_result_unknown', updated_at=datetime('now') WHERE id=? AND video_task_id=? AND status='needs_check'")
          .bind(order.id, order.video_task_id).run();
        const failed = await loadZcvOrder(env.DB, order.id);
        if (failed) await refundFailedOrder(env, failed, "moderation_result_unknown");
        return loadZcvOrder(env.DB, order.id);
      }
      return order;
    }
  }
  if (!order || !env.KIE_API_KEY || !order.video_task_id || !["generating", "needs_check"].includes(order.status)) return order;
  const info = await getTaskInfo(env.KIE_API_KEY, order.video_task_id);
  if (!info.ok) return order;
  return settleZcvVideo(env, order, info, origin);
}

export async function syncZcvPreview(env: ZcvEnv, previewId: string, origin: string): Promise<ZcvPreview | null> {
  const preview = await loadZcvPreview(env.DB, previewId);
  if (!preview || !preview.task_id || !env.KIE_API_KEY || ["ready", "failed"].includes(preview.status)) return preview;
  const info = await getTaskInfo(env.KIE_API_KEY, preview.task_id);
  if (!info.ok) return preview;
  return settleZcvPreview(env, preview, info, origin);
}
