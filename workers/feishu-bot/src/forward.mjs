export const GROK_FORWARD_CHAT_ID = "oc_ff147ab4f0cf2288fe99fda95e9e54ad";
export const FORWARD_EMAIL_FROM = "onboarding@resend.dev";
export const FORWARD_EMAIL_TO = ["tuapi@mail.grokbot.com"];

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FORWARD_TIMEOUT_MS = 8000;
export const FORWARD_TTL_SECONDS = 604800;

const RETRY_DELAYS_MS = [1000, 3000];

export const FORWARD_SENDING_PLACEHOLDER = "sending";
export const FORWARD_SENDING_TTL_SECONDS = 120;

export const PENDING_PREFIX = "feishu:resend:pending:";
export const FORWARD_PENDING_MARK = "pending";
export const PENDING_TTL_SECONDS = 604800;
export const CRON_BATCH_LIMIT = 20;

export function forwardKey(messageId) {
  return `feishu:forwarded:message:${messageId}`;
}

export function pendingKey(messageId) {
  return `${PENDING_PREFIX}${messageId}`;
}

// Resend dedupes on this key, so a cron resend cannot produce a second email even if
// the original request actually reached Resend before the response was lost.
function resendHeaders(apiKey, messageId) {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${apiKey}`,
    "Idempotency-Key": `feishu-forward-${messageId}`,
  };
}

// Built once per forward so the cron retry can resend the exact same JSON body.
export function buildForwardEmailBody({ payload, selected, context }) {
  const createTime = payload?.event?.message?.create_time ?? "";
  return {
    createTime,
    body: JSON.stringify({
      from: FORWARD_EMAIL_FROM,
      to: FORWARD_EMAIL_TO,
      subject: `[feishu] ${context.senderName || context.senderOpenId || "unknown"} ${selected.messageId}`,
      text: [
        `sender_name: ${context.senderName ?? ""}`,
        `sender_open_id: ${context.senderOpenId ?? ""}`,
        `message_type: ${selected.messageType ?? ""}`,
        `text: ${typeof selected.text === "string" ? selected.text.trim() : selected.text}`,
        `chat_id: ${context.chatId}`,
        `message_id: ${selected.messageId}`,
        `create_time: ${createTime}`,
      ].join("\n"),
    }),
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function forwardToGrok({
  env,
  kv,
  payload,
  selected,
  context,
  fetchImpl,
  receivedAt,
  sleep = defaultSleep,
}) {
  if (selected?.chatType !== "group") return { ok: false, attempts: 0, status: null };
  if (context?.chatId !== GROK_FORWARD_CHAT_ID) return { ok: false, attempts: 0, status: null };

  const apiKey = typeof env?.RESEND_API_KEY === "string" ? env.RESEND_API_KEY : "";
  if (!apiKey || !kv) return { ok: false, attempts: 0, status: null };

  const dedupeKey = forwardKey(selected.messageId);
  try {
    // Any stored value ("sending" placeholder or "1") means the message is already
    // claimed, so a redelivery inside the window must not send a second email.
    if (await kv.get(dedupeKey)) return { ok: true, attempts: 0, status: null, skipped: true };
    // Claim the message before calling Resend so concurrent deliveries cannot both send.
    await kv.put(dedupeKey, FORWARD_SENDING_PLACEHOLDER, { expirationTtl: FORWARD_SENDING_TTL_SECONDS });
  } catch {
    return { ok: false, attempts: 0, status: null };
  }

  const receivedAtMs = Number.isFinite(receivedAt) ? receivedAt : Date.now();
  const { createTime, body } = buildForwardEmailBody({ payload, selected, context });

  let attempts = 0;
  let status = null;
  for (let index = 0; index <= RETRY_DELAYS_MS.length; index += 1) {
    attempts += 1;
    let resendAt = Date.now();
    let ok = false;
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: resendHeaders(apiKey, selected.messageId),
        body,
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      });
      resendAt = Date.now();
      status = response?.status ?? null;
      ok = Boolean(response?.ok);
    } catch (error) {
      resendAt = Date.now();
      status = error?.status ?? null;
    }

    console.log(
      `[feishu-forward] message_id=${selected.messageId} create_time=${createTime} received_at=${receivedAtMs}`
      + ` resend_at=${resendAt} status=${status ?? "unknown"} attempt=${attempts} latency_ms=${resendAt - receivedAtMs}`,
    );

    if (ok) {
      try {
        await kv.put(dedupeKey, "1", { expirationTtl: FORWARD_TTL_SECONDS });
      } catch {
        // Marking is best effort; a 2xx already sent the email.
      }
      return { ok: true, attempts, status };
    }

    if (index < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[index]);
  }

  // All attempts failed: queue a pending record for the cron retry instead of dropping
  // the message. The dedupe key keeps a pending mark so a redelivery sends nothing.
  try {
    await kv.put(pendingKey(selected.messageId), JSON.stringify({
      messageId: selected.messageId,
      body,
      attempts,
      firstFailedAt: Date.now(),
      lastStatus: status,
    }), { expirationTtl: PENDING_TTL_SECONDS });
    await kv.put(dedupeKey, FORWARD_PENDING_MARK, { expirationTtl: PENDING_TTL_SECONDS });
    return { ok: false, attempts, status, queued: true };
  } catch {
    // Could not queue; fall back to clearing the claim so a redelivery can try again.
    try {
      await kv.delete(dedupeKey);
    } catch {
      // Clearing is best effort; dropping the placeholder clears the in-flight claim.
    }
    return { ok: false, attempts, status, queued: false };
  }
}

async function deletePendingKey(kv, key) {
  try {
    await kv.delete(key);
  } catch {
    // Deletion is best effort; a leftover pending key is retried on the next run.
  }
}

function logCronResult({ messageId, status, attempts, result }) {
  console.log(
    `[feishu-forward-cron] message_id=${messageId} status=${status ?? "unknown"}`
    + ` attempts=${attempts} result=${result}`,
  );
}

export async function retryPendingForwards({ env, kv, fetchImpl, now = Date.now }) {
  const summary = { scanned: 0, sent: 0, failed: 0, skipped: 0 };
  const apiKey = typeof env?.RESEND_API_KEY === "string" ? env.RESEND_API_KEY : "";
  if (!apiKey || !kv) return summary;

  let listed = null;
  try {
    listed = await kv.list({ prefix: PENDING_PREFIX, limit: CRON_BATCH_LIMIT });
  } catch {
    return summary;
  }

  const entries = Array.isArray(listed?.keys) ? listed.keys.slice(0, CRON_BATCH_LIMIT) : [];
  for (const entry of entries) {
    const key = typeof entry === "string" ? entry : entry?.name;
    if (typeof key !== "string" || !key) continue;
    summary.scanned += 1;

    let record = null;
    try {
      record = JSON.parse((await kv.get(key)) ?? "");
    } catch {
      record = null;
    }

    const messageId = typeof record?.messageId === "string" ? record.messageId : "";
    const body = typeof record?.body === "string" ? record.body : "";
    const attempts = Number.isFinite(record?.attempts) ? record.attempts : 0;
    const firstFailedAt = Number.isFinite(record?.firstFailedAt) ? record.firstFailedAt : now();
    const lastStatus = record?.lastStatus ?? null;
    if (!messageId || !body) {
      await deletePendingKey(kv, key);
      summary.skipped += 1;
      logCronResult({ messageId: key, status: lastStatus, attempts, result: "skipped" });
      continue;
    }

    const dedupeKey = forwardKey(messageId);
    let marker = null;
    try {
      marker = await kv.get(dedupeKey);
    } catch {
      marker = null;
    }

    if (marker === "1") {
      // Already delivered by an earlier run; just drop the stale pending record.
      await deletePendingKey(kv, key);
      summary.skipped += 1;
      logCronResult({ messageId, status: lastStatus, attempts, result: "skipped" });
      continue;
    }
    if (marker === FORWARD_SENDING_PLACEHOLDER) {
      // Another request is in flight; leave the pending record for a later run.
      summary.skipped += 1;
      logCronResult({ messageId, status: lastStatus, attempts, result: "skipped" });
      continue;
    }

    try {
      await kv.put(dedupeKey, FORWARD_SENDING_PLACEHOLDER, { expirationTtl: FORWARD_SENDING_TTL_SECONDS });
    } catch {
      summary.skipped += 1;
      logCronResult({ messageId, status: lastStatus, attempts, result: "skipped" });
      continue;
    }

    let status = null;
    let ok = false;
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: resendHeaders(apiKey, messageId),
        body,
        signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
      });
      status = response?.status ?? null;
      ok = Boolean(response?.ok);
    } catch (error) {
      status = error?.status ?? null;
    }

    if (ok) {
      try {
        await kv.put(dedupeKey, "1", { expirationTtl: FORWARD_TTL_SECONDS });
      } catch {
        // Marking is best effort; a 2xx already sent the email.
      }
      await deletePendingKey(kv, key);
      summary.sent += 1;
      logCronResult({ messageId, status, attempts, result: "sent" });
      continue;
    }

    const nextAttempts = attempts + 1;
    try {
      await kv.put(key, JSON.stringify({
        messageId,
        body,
        attempts: nextAttempts,
        firstFailedAt,
        lastStatus: status,
      }), { expirationTtl: PENDING_TTL_SECONDS });
      await kv.put(dedupeKey, FORWARD_PENDING_MARK, { expirationTtl: PENDING_TTL_SECONDS });
    } catch {
      // Keeping the previous pending record is best effort; the next run retries it.
    }
    summary.failed += 1;
    logCronResult({ messageId, status, attempts: nextAttempts, result: "failed" });
  }

  return summary;
}
