import { getSession, tokenFromRequest } from "../../../libs/auth";
import { loadOwnedZcvOrder } from "../../../libs/zcv";
import { syncZcvOrder } from "../../../libs/zcvWorkflow";
import { json } from "../../../libs/utils";
import type { ZcvEnv } from "../../../libs/zcvService";

function publicOrder(order: NonNullable<Awaited<ReturnType<typeof loadOwnedZcvOrder>>>) {
  return {
    id: order.id,
    productId: order.product_id,
    amountTotal: order.amount_total,
    currency: order.currency,
    paymentStatus: order.payment_status,
    status: order.status,
    outputAssetId: order.output_asset_id,
    error: order.status === "needs_check" ? "We are checking the provider task and will not start a duplicate." : order.last_error,
    canResume: order.payment_status === "paid" && ["paid_pending", "video_retry", "generating"].includes(order.status),
  };
}

export const onRequestGet: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.SESSIONS) return json({ error: "storage_unavailable" }, 503);
  const session = await getSession(env, tokenFromRequest(request));
  if (!session) return json({ error: "unauthorized" }, 401);
  const id = new URL(request.url).searchParams.get("id") || "";
  const owned = await loadOwnedZcvOrder(env.DB, id, session.userId);
  if (!owned) {
    const exists = await env.DB.prepare("SELECT id FROM zcv_orders WHERE id=?").bind(id).first<{ id: string }>();
    return exists ? json({ error: "forbidden" }, 403) : json({ error: "order_not_found" }, 404);
  }
  const current = ["generating", "needs_check", "video_starting"].includes(owned.status)
    ? await syncZcvOrder(env as ZcvEnv, id, new URL(request.url).origin)
    : owned;
  return json({ ok: true, order: publicOrder(current || owned) });
};
