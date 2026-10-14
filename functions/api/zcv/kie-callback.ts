import { extractKieTaskId, hasKieWebhookHmac, verifyKieWebhookSignature } from "../../../libs/kieWebhook";
import { getTaskInfo } from "../../../libs/kie";
import { safeEqual } from "../../../libs/password";
import { loadZcvOrder, loadZcvPreview } from "../../../libs/zcv";
import { json } from "../../../libs/utils";
import { settleZcvPreview, settleZcvVideo } from "../../../libs/zcvWorkflow";
import type { ZcvEnv } from "../../../libs/zcvService";

export const onRequestPost: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.SESSIONS || !env.MEDIA || !env.KIE_API_KEY) return json({ error: "callback_unavailable" }, 503);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const taskId = extractKieTaskId(body);
  if (!taskId) return json({ error: "missing_task_id" }, 400);
  if (hasKieWebhookHmac(env)) {
    const verified = await verifyKieWebhookSignature({
      secret: env.KIE_WEBHOOK_HMAC_KEY,
      taskId,
      timestamp: request.headers.get("x-webhook-timestamp"),
      signature: request.headers.get("x-webhook-signature"),
    });
    if (!verified.ok) return json({ error: verified.reason }, 401);
  }
  const query = new URL(request.url).searchParams;
  const kind = query.get("type");
  const id = query.get("id") || "";
  const token = query.get("token") || "";
  const origin = new URL(request.url).origin;
  if (kind === "preview") {
    const preview = await loadZcvPreview(env.DB, id);
    if (!preview || !safeEqual(preview.callback_token, token)) return json({ error: "callback_forbidden" }, 403);
    if (preview.task_id && preview.task_id !== taskId) return json({ error: "task_mismatch" }, 409);
    if (!preview.task_id) {
      await env.DB.prepare("UPDATE zcv_previews SET task_id=?, status='processing', updated_at=datetime('now') WHERE id=? AND callback_token=? AND task_id IS NULL AND status IN ('starting','needs_check')")
        .bind(taskId, id, token).run();
    }
  } else if (kind === "order") {
    const order = await loadZcvOrder(env.DB, id);
    if (!order || !safeEqual(order.callback_token, token)) return json({ error: "callback_forbidden" }, 403);
    if (order.video_task_id && order.video_task_id !== taskId) return json({ error: "task_mismatch" }, 409);
    if (!order.video_task_id) {
      await env.DB.batch([
        env.DB.prepare("UPDATE zcv_task_attempts SET task_id=?, status='generating', updated_at=datetime('now') WHERE order_id=? AND attempt=? AND task_id IS NULL AND status IN ('starting','needs_check')")
          .bind(taskId, id, order.generation_attempts),
        env.DB.prepare("UPDATE zcv_orders SET video_task_id=?, status='generating', updated_at=datetime('now') WHERE id=? AND callback_token=? AND generation_attempts=? AND video_task_id IS NULL AND status IN ('video_starting','needs_check')")
          .bind(taskId, id, token, order.generation_attempts),
      ]);
    }
  } else {
    return json({ error: "callback_type_invalid" }, 400);
  }
  const info = await getTaskInfo(env.KIE_API_KEY, taskId);
  if (!info.ok) return json({ error: "provider_lookup_failed", message: info.message }, 502);
  if (info.state !== "success" && info.state !== "fail") return json({ ok: true, taskId, state: info.state });
  if (kind === "preview") {
    const preview = await loadZcvPreview(env.DB, id);
    if (!preview) return json({ error: "preview_not_found" }, 404);
    const settled = await settleZcvPreview(env, preview, info, origin);
    return json({ ok: true, kind, id, status: settled?.status || "unknown" });
  }
  const order = await loadZcvOrder(env.DB, id);
  if (!order) return json({ error: "order_not_found" }, 404);
  const settled = await settleZcvVideo(env, order, info, origin);
  return json({ ok: true, kind, id, status: settled?.status || "unknown" });
};
