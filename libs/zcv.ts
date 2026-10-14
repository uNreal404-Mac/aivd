import { randomId } from "./utils";
import {
  canStartPaidGeneration,
  isValidPaidCheckout,
  ownershipMatches,
  type StripeCheckoutLike,
  type ZcvOwner,
  type ZcvViewer,
} from "./zcvCore";

// Estimated from the task-card sample 3 KIE logs; actual provider billing must be reconciled after a live test.
export const ZCV_IMAGE_COST_USD = 0.025;
export const ZCV_VIDEO_COST_USD = 0.275;
// The task-card Kling sample reports 55 KIE credits at approximately $0.275.
export const ZCV_USD_PER_KIE_CREDIT_ESTIMATE = ZCV_VIDEO_COST_USD / 55;
// Per-call estimate based on the KIE multimodal chat example; the live usage field is stored separately.
export const ZCV_MODERATION_COST_USD = 0.01;
export const ZCV_MAX_VIDEO_ATTEMPTS = 3;
export const ZCV_PREVIEW_DAILY_LIMIT = 2;
export const ZCV_UPLOAD_DAILY_LIMIT = 8;
export const ZCV_MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export type ZcvAsset = {
  id: string;
  r2_key: string;
  owner_kind: "user" | "guest";
  user_id: number | null;
  guest_id: string | null;
  asset_kind: "input" | "preview" | "video_input" | "video";
  content_type: string;
};

export type ZcvPreview = {
  id: string;
  owner_kind: "user" | "guest";
  user_id: number | null;
  guest_id: string | null;
  input_asset_id: string;
  full_asset_id: string | null;
  preview_asset_id: string | null;
  task_id: string | null;
  callback_token: string;
  model: string;
  model_version: string;
  model_cost_usd: number;
  model_cost_cents: number;
  model_provider_credits: number | null;
  status: string;
  failure_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ZcvOrder = {
  id: string;
  user_id: number;
  preview_id: string;
  product_id: string;
  amount_total: number;
  currency: string;
  checkout_session_id: string | null;
  checkout_url: string | null;
  payment_intent_id: string | null;
  payment_status: string;
  status: string;
  video_input_asset_id: string | null;
  video_task_id: string | null;
  video_model: string;
  video_model_version: string;
  video_cost_usd: number;
  video_cost_cents: number;
  video_provider_credits: number;
  total_cost_cents: number;
  output_asset_id: string | null;
  generation_attempts: number;
  refund_id: string | null;
  refund_status: string | null;
  last_error: string | null;
  callback_token: string;
  created_at: string;
  updated_at: string;
};

export function makeZcvAssetKey(id: string, ext: string): string {
  return `zcv/${id}.${ext}`;
}

export function newZcvId(prefix: "zcv" | "zcp" | "zco" | "cb"): string {
  return randomId(prefix);
}

export function ownerOf(row: { owner_kind: "user" | "guest"; user_id: number | null; guest_id: string | null }): ZcvOwner {
  return { ownerKind: row.owner_kind, userId: row.user_id, guestId: row.guest_id };
}

export function viewerOwns(row: { owner_kind: "user" | "guest"; user_id: number | null; guest_id: string | null }, viewer: ZcvViewer): boolean {
  return ownershipMatches(ownerOf(row), viewer);
}

export async function loadZcvAsset(db: D1Database, id: string): Promise<ZcvAsset | null> {
  return db.prepare("SELECT id, r2_key, owner_kind, user_id, guest_id, asset_kind, content_type FROM zcv_assets WHERE id = ?")
    .bind(id).first<ZcvAsset>();
}

export async function loadOwnedZcvAsset(db: D1Database, id: string, viewer: ZcvViewer): Promise<ZcvAsset | null> {
  const row = await loadZcvAsset(db, id);
  return row && viewerOwns(row, viewer) ? row : null;
}

export async function loadZcvPreview(db: D1Database, id: string): Promise<ZcvPreview | null> {
  return db.prepare("SELECT * FROM zcv_previews WHERE id = ?").bind(id).first<ZcvPreview>();
}

export async function loadZcvOrder(db: D1Database, id: string): Promise<ZcvOrder | null> {
  return db.prepare("SELECT * FROM zcv_orders WHERE id = ?").bind(id).first<ZcvOrder>();
}

/** Atomic daily quota, keyed by an account or hashed Cloudflare IP. */
export async function reserveZcvQuotaSlot(db: D1Database, quotaKey: string, limit: number): Promise<boolean> {
  const result = await db.prepare(
    `INSERT INTO zcv_rate_limits (quota_key,usage_count,window_started_at,updated_at)
     VALUES (?,1,datetime('now'),datetime('now'))
     ON CONFLICT(quota_key) DO UPDATE SET
       usage_count=CASE WHEN zcv_rate_limits.window_started_at <= datetime('now','-1 day') THEN 1 ELSE zcv_rate_limits.usage_count+1 END,
       window_started_at=CASE WHEN zcv_rate_limits.window_started_at <= datetime('now','-1 day') THEN datetime('now') ELSE zcv_rate_limits.window_started_at END,
       updated_at=datetime('now')
     WHERE zcv_rate_limits.window_started_at <= datetime('now','-1 day') OR zcv_rate_limits.usage_count < ?`
  ).bind(quotaKey, Math.max(1, Math.floor(limit))).run();
  return (result.meta.changes ?? 0) === 1;
}

export async function reserveZcvPreviewSlot(db: D1Database, quotaKey: string): Promise<boolean> {
  return reserveZcvQuotaSlot(db, quotaKey, ZCV_PREVIEW_DAILY_LIMIT);
}

export async function reserveZcvUploadSlot(db: D1Database, quotaKey: string): Promise<boolean> {
  return reserveZcvQuotaSlot(db, quotaKey, ZCV_UPLOAD_DAILY_LIMIT);
}

export async function releaseZcvQuotaSlot(db: D1Database, quotaKey: string): Promise<void> {
  await db.prepare("UPDATE zcv_rate_limits SET usage_count=MAX(0,usage_count-1), updated_at=datetime('now') WHERE quota_key=? AND usage_count>0")
    .bind(quotaKey).run();
}

export async function loadOwnedZcvOrder(db: D1Database, id: string, userId: number): Promise<ZcvOrder | null> {
  return db.prepare("SELECT * FROM zcv_orders WHERE id = ? AND user_id = ?").bind(id, userId).first<ZcvOrder>();
}

export async function loadZcvAssetByKey(db: D1Database, key: string): Promise<ZcvAsset | null> {
  return db.prepare("SELECT id, r2_key, owner_kind, user_id, guest_id, asset_kind, content_type FROM zcv_assets WHERE r2_key = ?")
    .bind(key).first<ZcvAsset>();
}

/** Move a guest preview and its input/preview assets into the buyer's account after login. */
export async function claimGuestPreview(db: D1Database, previewId: string, guestId: string, userId: number): Promise<boolean> {
  const preview = await loadZcvPreview(db, previewId);
  if (!preview) return false;
  if (preview.owner_kind === "user") return preview.user_id === userId;
  if (preview.guest_id !== guestId) return false;
  const result = await db.batch([
    db.prepare("UPDATE zcv_previews SET owner_kind='user', user_id=?, guest_id=NULL, updated_at=datetime('now') WHERE id=? AND owner_kind='guest' AND guest_id=?")
      .bind(userId, previewId, guestId),
    db.prepare("UPDATE zcv_assets SET owner_kind='user', user_id=?, guest_id=NULL WHERE owner_kind='guest' AND guest_id=? AND id IN (SELECT input_asset_id FROM zcv_previews WHERE id=? UNION SELECT full_asset_id FROM zcv_previews WHERE id=? UNION SELECT preview_asset_id FROM zcv_previews WHERE id=?)")
      .bind(userId, guestId, previewId, previewId, previewId),
  ]);
  if ((result[0]?.meta?.changes ?? 0) === 1) return true;
  // Another request may have completed the same claim after our initial read.
  const fresh = await loadZcvPreview(db, previewId);
  return fresh?.owner_kind === "user" && fresh.user_id === userId;
}

export function isPrivateZcvKey(key: string): boolean {
  return /^zcv\/[a-z0-9_-]{8,80}\.(jpg|png|webp|mp4)$/.test(key);
}

export function newProviderToken(): string {
  return randomId("kiefetch");
}

export async function acceptZcvPaidCheckout(
  db: D1Database,
  eventId: string,
  session: StripeCheckoutLike & { payment_intent?: unknown }
): Promise<{ ok: false; reason: "order_not_found" | "payment_mismatch" } | { ok: true; order: ZcvOrder; newlyPaid: boolean }> {
  const orderId = typeof session.metadata?.orderId === "string" ? session.metadata.orderId : "";
  if (!orderId) return { ok: false, reason: "order_not_found" };
  const order = await loadZcvOrder(db, orderId);
  if (!order) return { ok: false, reason: "order_not_found" };
  if (!isValidPaidCheckout(session, {
    id: order.id,
    userId: order.user_id,
    checkoutSessionId: order.checkout_session_id,
    productId: order.product_id,
    amountTotal: order.amount_total,
    currency: order.currency,
  })) return { ok: false, reason: "payment_mismatch" };
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : null;
  const update = await db.prepare(
    `UPDATE zcv_orders SET payment_status='paid', status='paid_pending', payment_intent_id=COALESCE(payment_intent_id, ?), updated_at=datetime('now')
      WHERE id=? AND checkout_session_id=? AND payment_status!='paid'`
  ).bind(paymentIntentId, order.id, session.id).run();
  await db.prepare("INSERT OR IGNORE INTO zcv_stripe_events (event_id, checkout_session_id, order_id) VALUES (?, ?, ?)")
    .bind(eventId, String(session.id), order.id).run();
  const fresh = await loadZcvOrder(db, order.id);
  if (!fresh) return { ok: false, reason: "order_not_found" };
  return { ok: true, order: fresh, newlyPaid: (update.meta.changes ?? 0) === 1 };
}

/** Conditional claim makes generation start idempotent across event IDs and webhook retries. */
export async function claimPaidGeneration(db: D1Database, orderId: string): Promise<boolean> {
  const callbackToken = newZcvId("cb");
  const result = await db.batch([
    db.prepare(
    `UPDATE zcv_orders SET status='video_starting', video_task_id=NULL, callback_token=?, generation_attempts=generation_attempts+1,
      video_cost_usd=video_cost_usd+?, video_cost_cents=video_cost_cents+28,
      total_cost_cents=CASE WHEN generation_attempts=0
        THEN CAST(ROUND((COALESCE((SELECT model_cost_usd FROM zcv_previews WHERE zcv_previews.id=zcv_orders.preview_id), 0) + ?) * 100) AS INTEGER)
        ELSE total_cost_cents+29 END,
      updated_at=datetime('now')
      WHERE id=? AND payment_status='paid' AND status IN ('paid_pending','video_retry')`
    ).bind(callbackToken, ZCV_VIDEO_COST_USD, ZCV_VIDEO_COST_USD + ZCV_MODERATION_COST_USD, orderId),
    db.prepare(
      `INSERT OR IGNORE INTO zcv_task_attempts
        (order_id,attempt,task_id,model,model_version,estimated_cost_usd,estimated_cost_cents,status,moderation_estimated_cost_usd,moderation_estimated_cost_cents)
       SELECT id,generation_attempts,NULL,video_model,video_model_version,?,28,'starting',?,1
       FROM zcv_orders WHERE id=? AND status='video_starting'`
    ).bind(ZCV_VIDEO_COST_USD, ZCV_MODERATION_COST_USD, orderId),
  ]);
  return (result[0]?.meta?.changes ?? 0) === 1;
}

export function canResumePaidOrder(status: string): boolean {
  return canStartPaidGeneration(status);
}
