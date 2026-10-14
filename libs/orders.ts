/**
 * One-off paid orders (not credit packs).
 * Payment is granted only from the Stripe webhook. Success pages never grant.
 */

import { createImageToVideoTask, getTaskInfo, isPublicHttpsUrl, type KieTaskInfo, type KieTaskError } from "./kie";
import { kieCallbackUrl } from "./kieWebhook";
import { isSafeMediaKey, mediaKeyFromUrl, persistRemoteMedia, publicMediaUrl } from "./media";
import {
  PRODUCTS,
  ZOMBIE_COUPLE_PROMPT,
  type OneOffProduct,
  type ProductId,
} from "./products";
import { rememberKieTask } from "./settle";
import { hasKieKey, hasMedia, randomId, type Env } from "./utils";

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "generating",
  "delivered",
  "failed",
  "needs_check",
  "refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const MAX_ORDER_ATTEMPTS = 2;
export const PENDING_PURCHASE_TTL = 60 * 60 * 24;
const KIE_CREATE_TIMEOUT_MS = 20_000;

export type OrderRow = {
  id: string;
  user_id: number;
  stripe_session_id: string | null;
  payment_intent_id: string | null;
  input_media_key: string | null;
  preview_job_id: string | null;
  kie_task_id: string | null;
  model: string | null;
  cost_cents: number | null;
  output_key: string | null;
  status: OrderStatus;
  refund_id: string | null;
  refunded_at: string | null;
  attempts: number;
  created_at: string;
  updated_at: string;
};

export type PendingPurchase = {
  productId: ProductId;
  inputMediaKey: string | null;
  previewJobId: string | null;
  orderId: string | null;
  savedAt: string;
};

const ORDER_COLS = `id, user_id, stripe_session_id, payment_intent_id, input_media_key,
  preview_job_id, kie_task_id, model, cost_cents, output_key, status, refund_id,
  refunded_at, attempts, created_at, updated_at`;

export function pendingPurchaseKey(userId: number): string {
  return `pending_purchase:${userId}`;
}

export async function savePendingPurchase(
  env: { SESSIONS: KVNamespace },
  userId: number,
  rec: PendingPurchase
): Promise<void> {
  await env.SESSIONS.put(pendingPurchaseKey(userId), JSON.stringify(rec), {
    expirationTtl: PENDING_PURCHASE_TTL,
  });
}

export async function loadPendingPurchase(
  env: { SESSIONS: KVNamespace },
  userId: number
): Promise<PendingPurchase | null> {
  const raw = await env.SESSIONS.get(pendingPurchaseKey(userId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPurchase;
    if (!parsed || parsed.productId !== "zombie-couple") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingPurchase(
  env: { SESSIONS: KVNamespace },
  userId: number
): Promise<void> {
  await env.SESSIONS.delete(pendingPurchaseKey(userId));
}

export async function insertPendingOrder(
  db: D1Database,
  opts: {
    userId: number;
    product: OneOffProduct;
    inputMediaKey: string | null;
    previewJobId: string | null;
  }
): Promise<OrderRow> {
  const id = randomId("ord");
  const now = new Date().toISOString();
  await db
    .prepare(
      `INSERT INTO orders (
         id, user_id, stripe_session_id, payment_intent_id, input_media_key, preview_job_id,
         kie_task_id, model, cost_cents, output_key, status, refund_id, refunded_at,
         attempts, created_at, updated_at
       ) VALUES (?, ?, NULL, NULL, ?, ?, NULL, ?, ?, NULL, 'pending', NULL, NULL, 0, ?, ?)`
    )
    .bind(
      id,
      opts.userId,
      opts.inputMediaKey,
      opts.previewJobId,
      opts.product.paidModel,
      opts.product.paidJobCostCents,
      now,
      now
    )
    .run();
  const row = await loadOrderById(db, id);
  if (!row) throw new Error("order insert failed");
  return row;
}

export async function attachStripeSession(
  db: D1Database,
  orderId: string,
  stripeSessionId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const upd = await db
    .prepare(
      `UPDATE orders SET stripe_session_id = ?, updated_at = ?
       WHERE id = ? AND status = 'pending' AND stripe_session_id IS NULL`
    )
    .bind(stripeSessionId, now, orderId)
    .run();
  return (upd.meta.changes ?? 0) > 0;
}

export async function loadOrderById(db: D1Database, id: string): Promise<OrderRow | null> {
  return db.prepare(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`).bind(id).first<OrderRow>();
}

export async function loadOrderByStripeSession(
  db: D1Database,
  sessionId: string
): Promise<OrderRow | null> {
  return db
    .prepare(`SELECT ${ORDER_COLS} FROM orders WHERE stripe_session_id = ?`)
    .bind(sessionId)
    .first<OrderRow>();
}

export async function loadOrderByKieTask(
  db: D1Database,
  taskId: string
): Promise<OrderRow | null> {
  return db
    .prepare(`SELECT ${ORDER_COLS} FROM orders WHERE kie_task_id = ? ORDER BY created_at DESC LIMIT 1`)
    .bind(taskId)
    .first<OrderRow>();
}

export async function loadOrderByOutputKey(
  db: D1Database,
  outputKey: string
): Promise<OrderRow | null> {
  return db
    .prepare(`SELECT ${ORDER_COLS} FROM orders WHERE output_key = ?`)
    .bind(outputKey)
    .first<OrderRow>();
}

export async function recordStripeEvent(db: D1Database, eventId: string): Promise<boolean> {
  try {
    await db.prepare("INSERT INTO stripe_events (event_id) VALUES (?)").bind(eventId).run();
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/UNIQUE constraint failed/i.test(msg)) return false;
    throw err;
  }
}

/**
 * Mark paid + claim the enqueue right in one conditional update.
 * Same session, any later event: changes=0, caller must not start a second job.
 */
export async function markOrderPaidIfPending(
  db: D1Database,
  opts: { orderId?: string | null; stripeSessionId: string; paymentIntentId: string | null }
): Promise<{ claimed: boolean; order: OrderRow | null }> {
  const now = new Date().toISOString();
  if (opts.orderId) {
    const upd = await db
      .prepare(
        `UPDATE orders
           SET status = 'paid',
               stripe_session_id = COALESCE(stripe_session_id, ?),
               payment_intent_id = COALESCE(payment_intent_id, ?),
               updated_at = ?
         WHERE id = ? AND status = 'pending'
           AND (stripe_session_id IS NULL OR stripe_session_id = ?)`
      )
      .bind(opts.stripeSessionId, opts.paymentIntentId, now, opts.orderId, opts.stripeSessionId)
      .run();
    if ((upd.meta.changes ?? 0) > 0) {
      return { claimed: true, order: await loadOrderById(db, opts.orderId) };
    }
  }

  const bySession = await loadOrderByStripeSession(db, opts.stripeSessionId);
  if (bySession) {
    if (bySession.status === "pending") {
      const upd = await db
        .prepare(
          `UPDATE orders
             SET status = 'paid',
                 payment_intent_id = COALESCE(payment_intent_id, ?),
                 updated_at = ?
           WHERE id = ? AND status = 'pending'`
        )
        .bind(opts.paymentIntentId, now, bySession.id)
        .run();
      if ((upd.meta.changes ?? 0) > 0) {
        return { claimed: true, order: await loadOrderById(db, bySession.id) };
      }
    }
    return { claimed: false, order: await loadOrderById(db, bySession.id) };
  }

  if (opts.orderId) {
    return { claimed: false, order: await loadOrderById(db, opts.orderId) };
  }
  return { claimed: false, order: null };
}

export function inputImageUrlForOrder(origin: string, order: OrderRow): string | null {
  if (!order.input_media_key || !isSafeMediaKey(order.input_media_key)) return null;
  return publicMediaUrl(origin, order.input_media_key);
}

async function createPaidTaskWithTimeout(
  apiKey: string,
  opts: { prompt: string; imageUrl: string; durationSec: number; callBackUrl: string }
): Promise<
  | { ok: true; taskId: string }
  | { ok: false; unknown: boolean; message: string; status: number }
> {
  const work = createImageToVideoTask(apiKey, {
    prompt: opts.prompt,
    imageUrl: opts.imageUrl,
    durationSec: opts.durationSec,
    sound: false,
    callBackUrl: opts.callBackUrl,
  });
  const raced = await Promise.race([
    work.then((r) => ({ timedOut: false as const, result: r })),
    new Promise<{ timedOut: true }>((resolve) =>
      setTimeout(() => resolve({ timedOut: true }), KIE_CREATE_TIMEOUT_MS)
    ),
  ]);
  if (raced.timedOut) {
    return { ok: false, unknown: true, message: "KIE createTask timed out", status: 504 };
  }
  if (!raced.result.ok) {
    const unknown = raced.result.status === 0 || raced.result.status >= 500;
    return {
      ok: false,
      unknown,
      message: raced.result.message,
      status: raced.result.status,
    };
  }
  return { ok: true, taskId: raced.result.taskId };
}

/**
 * Start or resume the paid 10s silent kling-2.6 job.
 * needs_check / unknown timeout: never blindly create another KIE task.
 */
export async function enqueuePaidGeneration(
  env: Env & { DB: D1Database; SESSIONS: KVNamespace; KIE_API_KEY: string },
  order: OrderRow,
  origin: string
): Promise<OrderRow> {
  if (order.status === "delivered" || order.status === "refunded") return order;
  if (order.status === "needs_check") return order;
  if (order.status === "failed" && order.attempts >= MAX_ORDER_ATTEMPTS) return order;
  if (order.status === "pending") return order;
  if (order.kie_task_id && (order.status === "generating" || order.status === "paid")) {
    return order;
  }

  const product = PRODUCTS["zombie-couple"];
  const imageUrl = inputImageUrlForOrder(origin, order);
  if (!imageUrl || !isPublicHttpsUrl(imageUrl)) {
    const now = new Date().toISOString();
    await env.DB.prepare(
      `UPDATE orders SET status = 'failed', updated_at = ? WHERE id = ? AND status IN ('paid','generating')`
    )
      .bind(now, order.id)
      .run();
    return (await loadOrderById(env.DB, order.id)) || { ...order, status: "failed" };
  }

  const claim = await env.DB.prepare(
    `UPDATE orders
       SET status = 'generating',
           attempts = attempts + 1,
           updated_at = ?
     WHERE id = ? AND kie_task_id IS NULL
       AND status IN ('paid','generating','failed')
       AND attempts < ?`
  )
    .bind(new Date().toISOString(), order.id, MAX_ORDER_ATTEMPTS)
    .run();
  if ((claim.meta.changes ?? 0) === 0) {
    return (await loadOrderById(env.DB, order.id)) || order;
  }

  const created = await createPaidTaskWithTimeout(env.KIE_API_KEY, {
    prompt: ZOMBIE_COUPLE_PROMPT,
    imageUrl,
    durationSec: product.paidDurationSec,
    callBackUrl: kieCallbackUrl(origin),
  });

  if (!created.ok) {
    const now = new Date().toISOString();
    if (created.unknown) {
      await env.DB.prepare(
        `UPDATE orders SET status = 'needs_check', updated_at = ? WHERE id = ? AND kie_task_id IS NULL`
      )
        .bind(now, order.id)
        .run();
      return (await loadOrderById(env.DB, order.id)) || { ...order, status: "needs_check" };
    }
    const fresh = await loadOrderById(env.DB, order.id);
    const attempts = fresh ? Number(fresh.attempts) : order.attempts + 1;
    const nextStatus = attempts >= MAX_ORDER_ATTEMPTS ? "failed" : "paid";
    await env.DB.prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND kie_task_id IS NULL`)
      .bind(nextStatus, now, order.id)
      .run();
    return (await loadOrderById(env.DB, order.id)) || { ...order, status: nextStatus };
  }

  const attached = await env.DB.prepare(
    `UPDATE orders SET kie_task_id = ?, model = ?, cost_cents = ?, updated_at = ?
     WHERE id = ? AND kie_task_id IS NULL`
  )
    .bind(
      created.taskId,
      product.paidModel,
      product.paidJobCostCents,
      new Date().toISOString(),
      order.id
    )
    .run();
  if ((attached.meta.changes ?? 0) === 0) {
    return (await loadOrderById(env.DB, order.id)) || order;
  }

  await rememberKieTask(env, created.taskId, {
    kind: "order",
    orderId: order.id,
    userId: order.user_id,
  });
  return (await loadOrderById(env.DB, order.id)) || order;
}

export async function settleOrderJob(
  env: Env & { DB: D1Database },
  order: OrderRow,
  origin: string,
  prefetched?: KieTaskInfo | KieTaskError | null
): Promise<{ order: OrderRow; providerState: string | null }> {
  if (order.status === "delivered" || order.status === "refunded") {
    return { order, providerState: order.status === "delivered" ? "success" : null };
  }
  if (!order.kie_task_id) {
    return { order, providerState: null };
  }
  if (!hasKieKey(env)) {
    return { order, providerState: null };
  }

  const info = prefetched || (await getTaskInfo(env.KIE_API_KEY, order.kie_task_id));
  if (!info.ok) {
    return { order, providerState: null };
  }

  if (info.state === "success" && info.resultUrl) {
    let outputKey: string | null = null;
    let storedUrl = info.resultUrl;
    if (hasMedia(env)) {
      try {
        const copied = await persistRemoteMedia(env.MEDIA, {
          userId: order.user_id,
          sourceUrl: info.resultUrl,
          origin,
        });
        if (copied) {
          storedUrl = copied;
          outputKey = mediaKeyFromUrl(copied);
        }
      } catch {
        /* keep provider URL key-less; media endpoint will 404 until copied */
      }
    }
    if (!outputKey) outputKey = mediaKeyFromUrl(storedUrl);

    const upd = await env.DB.prepare(
      `UPDATE orders
         SET status = 'delivered', output_key = COALESCE(?, output_key), updated_at = ?
       WHERE id = ? AND status IN ('generating','paid','needs_check')`
    )
      .bind(outputKey, new Date().toISOString(), order.id)
      .run();
    if ((upd.meta.changes ?? 0) === 0) {
      const fresh = await loadOrderById(env.DB, order.id);
      return { order: fresh || order, providerState: "success" };
    }
    const fresh = await loadOrderById(env.DB, order.id);
    return { order: fresh || { ...order, status: "delivered", output_key: outputKey }, providerState: "success" };
  }

  if (info.state === "fail") {
    const fresh = await loadOrderById(env.DB, order.id);
    const attempts = fresh ? Number(fresh.attempts) : order.attempts;
    const next = attempts >= MAX_ORDER_ATTEMPTS ? "failed" : "paid";
    await env.DB.prepare(
      `UPDATE orders
         SET status = ?, kie_task_id = CASE WHEN ? = 'paid' THEN NULL ELSE kie_task_id END, updated_at = ?
       WHERE id = ? AND status IN ('generating','paid','needs_check')`
    )
      .bind(next, next, new Date().toISOString(), order.id)
      .run();
    return {
      order: (await loadOrderById(env.DB, order.id)) || { ...order, status: next },
      providerState: "fail",
    };
  }

  return { order, providerState: info.state || "generating" };
}

/**
 * Resume an interrupted paid job: poll existing KIE task, or enqueue if none
 * and we are allowed to create. needs_check never creates a new task.
 */
export async function resumeOrder(
  env: Env & { DB: D1Database; SESSIONS: KVNamespace },
  order: OrderRow,
  origin: string
): Promise<{ order: OrderRow; providerState: string | null }> {
  if (order.status === "delivered" || order.status === "refunded" || order.status === "pending") {
    return { order, providerState: order.status === "delivered" ? "success" : null };
  }

  if (order.kie_task_id) {
    const settled = await settleOrderJob(env as Env & { DB: D1Database }, order, origin);
    if (settled.order.status === "paid" && !settled.order.kie_task_id && hasKieKey(env)) {
      const next = await enqueuePaidGeneration(
        env as Env & { DB: D1Database; SESSIONS: KVNamespace; KIE_API_KEY: string },
        settled.order,
        origin
      );
      return { order: next, providerState: next.status === "generating" ? "generating" : settled.providerState };
    }
    return settled;
  }

  if (order.status === "needs_check") {
    return { order, providerState: null };
  }

  if ((order.status === "paid" || order.status === "failed") && order.attempts < MAX_ORDER_ATTEMPTS) {
    if (!hasKieKey(env)) return { order, providerState: null };
    const next = await enqueuePaidGeneration(
      env as Env & { DB: D1Database; SESSIONS: KVNamespace; KIE_API_KEY: string },
      order,
      origin
    );
    return { order: next, providerState: next.status === "generating" ? "generating" : null };
  }

  return { order, providerState: null };
}

export function publicOrder(order: OrderRow, viewerId: number | null) {
  const owned = viewerId !== null && viewerId === order.user_id;
  return {
    id: order.id,
    status: order.status,
    productId: "zombie-couple" as const,
    productName: PRODUCTS["zombie-couple"].name,
    model: order.model,
    costCents: order.cost_cents,
    attempts: order.attempts,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    hasInput: !!(owned && order.input_media_key),
    hasOutput: !!(owned && order.status === "delivered" && order.output_key),
    inputMediaUrl: owned && order.input_media_key ? `/api/orders/${order.id}/media?kind=input` : null,
    outputMediaUrl:
      owned && order.status === "delivered" && order.output_key
        ? `/api/orders/${order.id}/media?kind=output`
        : null,
    downloadUrl:
      owned && order.status === "delivered" && order.output_key
        ? `/api/orders/${order.id}/media?kind=output&download=1`
        : null,
    paidCopy: "10-second 1080p video, new generation, may differ from preview",
  };
}
