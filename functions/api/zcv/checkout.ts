import { getSession, tokenFromRequest } from "../../../libs/auth";
import { guestIdFromRequest } from "../../../libs/guest";
import { getStripeCustomerId } from "../../../libs/account";
import { createZcvCheckoutSession } from "../../../libs/stripe";
import { loadZcvOrder, loadZcvPreview, newZcvId, claimGuestPreview, viewerOwns } from "../../../libs/zcv";
import { ZCV_PRODUCT } from "../../../libs/zcvCore";
import { json } from "../../../libs/utils";
import type { ZcvEnv } from "../../../libs/zcvService";

const isTestSecret = (value: string | undefined): value is string => !!value && (value.startsWith("sk_test_") || value.startsWith("rk_test_"));

export const onRequestPost: PagesFunction<ZcvEnv> = async ({ request, env }) => {
  if (!env.DB || !env.SESSIONS || !env.MEDIA || !env.STRIPE_WEBHOOK_SECRET || !isTestSecret(env.STRIPE_SECRET_KEY)) {
    return json({ error: "test_checkout_not_configured" }, 503);
  }
  const session = await getSession(env, tokenFromRequest(request));
  if (!session) return json({ error: "unauthorized" }, 401);
  let body: { previewId?: string };
  try { body = await request.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const previewId = typeof body.previewId === "string" ? body.previewId : "";
  let preview = await loadZcvPreview(env.DB, previewId);
  if (!preview) return json({ error: "preview_not_found" }, 404);
  if (preview.owner_kind === "guest") {
    const guestId = guestIdFromRequest(request);
    if (!guestId || preview.guest_id !== guestId || !(await claimGuestPreview(env.DB, preview.id, guestId, session.userId))) {
      return json({ error: "preview_forbidden" }, 403);
    }
    preview = await loadZcvPreview(env.DB, previewId);
  }
  if (!preview || !viewerOwns(preview, { userId: session.userId, guestId: null })) return json({ error: "preview_forbidden" }, 403);
  if (preview.status !== "ready" || !preview.full_asset_id) return json({ error: "preview_not_ready", status: preview.status }, 409);

  let order = await env.DB.prepare("SELECT * FROM zcv_orders WHERE preview_id=?").bind(previewId).first<Awaited<ReturnType<typeof loadZcvOrder>>>();
  if (!order) {
    const orderId = newZcvId("zco");
    const callbackToken = newZcvId("cb");
    await env.DB.prepare(
      "INSERT INTO zcv_orders (id,user_id,preview_id,product_id,amount_total,currency,video_input_asset_id,callback_token,status,payment_status) VALUES (?,?,?,?,?,?,?,?, 'checkout_pending','unpaid')"
    ).bind(orderId, session.userId, preview.id, ZCV_PRODUCT.id, ZCV_PRODUCT.usdCents, ZCV_PRODUCT.currency, preview.full_asset_id, callbackToken).run();
    order = await loadZcvOrder(env.DB, orderId);
  }
  if (!order || order.user_id !== session.userId) return json({ error: "order_forbidden" }, 403);
  if (order.checkout_url && order.checkout_session_id) return json({ ok: true, orderId: order.id, url: order.checkout_url });

  const customerId = await getStripeCustomerId(env.DB, session.userId).catch(() => null);
  const result = await createZcvCheckoutSession({
    secretKey: env.STRIPE_SECRET_KEY,
    origin: new URL(request.url).origin,
    userId: session.userId,
    email: session.email,
    orderId: order.id,
    customerId,
    amountCents: ZCV_PRODUCT.usdCents,
    productId: ZCV_PRODUCT.id,
    productName: ZCV_PRODUCT.name,
  });
  if (!result.ok) {
    if (result.certainty === "unknown") await env.DB.prepare("UPDATE zcv_orders SET status='checkout_needs_check', last_error=?, updated_at=datetime('now') WHERE id=? AND checkout_session_id IS NULL")
      .bind(result.message.slice(0, 300), order.id).run();
    return json({ error: "stripe_session_failed", message: result.message, certainty: result.certainty }, result.status >= 400 && result.status < 600 ? result.status : 502);
  }
  await env.DB.prepare("UPDATE zcv_orders SET checkout_session_id=?, checkout_url=?, status='checkout_pending', last_error=NULL, updated_at=datetime('now') WHERE id=? AND checkout_session_id IS NULL")
    .bind(result.id, result.url, order.id).run();
  const fresh = await loadZcvOrder(env.DB, order.id);
  return json({ ok: true, orderId: order.id, url: fresh?.checkout_url || result.url });
};
