import { getSession, tokenFromRequest } from "../../../libs/auth";
import { loadOwnedZcvOrder } from "../../../libs/zcv";
import { startZcvPaidVideo, syncZcvOrder } from "../../../libs/zcvWorkflow";
import { json } from "../../../libs/utils";
import type { ZcvEnv } from "../../../libs/zcvService";

export const onRequestPost: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.SESSIONS || !env.MEDIA) return json({ error: "storage_unavailable" }, 503);
  const session = await getSession(env, tokenFromRequest(request));
  if (!session) return json({ error: "unauthorized" }, 401);
  let body: { orderId?: string };
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orderId = typeof body.orderId === "string" ? body.orderId : "";
  const order = await loadOwnedZcvOrder(env.DB, orderId, session.userId);
  if (!order) return json({ error: "order_forbidden" }, 403);
  if (order.payment_status !== "paid") return json({ error: "payment_required" }, 409);
  let status = order.status;
  if (["paid_pending", "video_retry"].includes(order.status)) {
    status = await startZcvPaidVideo(env as ZcvEnv, orderId, new URL(request.url).origin);
  } else if (["generating", "needs_check", "video_starting"].includes(order.status)) {
    const synced = await syncZcvOrder(env as ZcvEnv, orderId, new URL(request.url).origin);
    status = synced?.status || order.status;
  }
  const fresh = await loadOwnedZcvOrder(env.DB, orderId, session.userId);
  return json({ ok: true, status: fresh?.status || status, needsCheck: fresh?.status === "needs_check" && !fresh.video_task_id });
};
