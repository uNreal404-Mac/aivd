export const GROK_FORWARD_CHAT_ID = "oc_ff147ab4f0cf2288fe99fda95e9e54ad";
export const FORWARD_EMAIL_FROM = "onboarding@resend.dev";
export const FORWARD_EMAIL_TO = ["tuapi@mail.grokbot.com"];

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FORWARD_TIMEOUT_MS = 8000;
export const FORWARD_TTL_SECONDS = 604800;

const RETRY_DELAYS_MS = [1000, 3000];

export const FORWARD_SENDING_PLACEHOLDER = "sending";
// The claim must outlive the 10-minute cron interval so a resend can never overlap it.
export const FORWARD_SENDING_TTL_SECONDS = 900;
export const CRON_SENDING_TTL_SECONDS = 900;

export const PENDING_PREFIX = "feishu:resend:pending:";
// Queue flag: set on enqueue, cleared when a cron run drains the queue, so an empty queue
// costs one kv.get instead of a kv.list.
export const PENDING_FLAG_KEY = "feishu:resend:__has_pending";
export const FORWARD_PENDING_MARK = "pending";
export const FORWARD_FAILED_MARK = "failed";
export const PENDING_TTL_SECONDS = 604800;
export const CRON_BATCH_LIMIT = 20;
// A queued message stops being retried once a failed resend pushes attempts this far.
export const MAX_PENDING_ATTEMPTS = 8;
// Queued-retry backoff: 10 minutes, 30 minutes, then 2 hours for every later attempt.
export const PENDING_BACKOFF_MS = [600000, 1800000, 7200000];

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

// Optional override: env.FORWARD_EMAIL_TO is a comma-separated recipient list from the
// Worker vars; unset or blank falls back to the constant in this file.
export function forwardRecipients(env) {
  const configured = typeof env?.FORWARD_EMAIL_TO === "string" ? env.FORWARD_EMAIL_TO : "";
  const parsed = configured.split(",").map((value) => value.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : FORWARD_EMAIL_TO;
}

// Built once per forward so the cron retry can resend the exact same JSON body.
export function buildForwardEmailBody({ env, payload, selected, context }) {
  const createTime = payload?.event?.message?.create_time ?? "";
  return {
    createTime,
    body: JSON.stringify({
      from: FORWARD_EMAIL_FROM,
      to: forwardRecipients(env),
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
  const { createTime, body } = buildForwardEmailBody({ env, payload, selected, context });

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
  // KV writes on this path: 1) the queue flag, 2) the pending record, 3) the dedupe mark.
  const queuedAt = Date.now();
  try {
    await kv.put(PENDING_FLAG_KEY, "1", { expirationTtl: PENDING_TTL_SECONDS });
    await kv.put(pendingKey(selected.messageId), JSON.stringify({
      messageId: selected.messageId,
      body,
      attempts,
      firstFailedAt: queuedAt,
      lastStatus: status,
      nextAttemptAt: queuedAt + PENDING_BACKOFF_MS[0],
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

async function deletePendingFlag(kv) {
  try {
    await kv.delete(PENDING_FLAG_KEY);
  } catch {
    // Best effort; a stale flag on an empty queue only costs one extra list per run.
  }
}

// The inline forward makes 3 attempts before the record is queued, so the first cron
// retry (attempts 3 -> 4) uses PENDING_BACKOFF_MS[0]; later retries walk the ladder and
// clamp to the last entry.
const CRON_ATTEMPTS_BEFORE_QUEUE = 3;

export function pendingBackoffMs(nextAttempts) {
  const index = nextAttempts - CRON_ATTEMPTS_BEFORE_QUEUE - 1;
  return PENDING_BACKOFF_MS[Math.min(Math.max(index, 0), PENDING_BACKOFF_MS.length - 1)];
}

// Give up path: drop the queued record and mark the message "failed" so neither a later
// cron run nor a Feishu redelivery ever emails it again. KV ops: 1 delete + 1 put.
async function giveUpPending({ kv, key, dedupeKey, messageId, status, attempts }) {
  await deletePendingKey(kv, key);
  try {
    await kv.put(dedupeKey, FORWARD_FAILED_MARK, { expirationTtl: PENDING_TTL_SECONDS });
  } catch {
    // Marking is best effort; the queued record is already gone.
  }
  logCronResult({ messageId, status, attempts, result: "gave_up" });
}

function logCronResult({ messageId, status, attempts, result }) {
  console.log(
    `[feishu-forward-cron] message_id=${messageId} status=${status ?? "unknown"}`
    + ` attempts=${attempts} result=${result}`,
  );
}

export async function retryPendingForwards({ env, kv, fetchImpl, now = Date.now }) {
  const summary = { scanned: 0, sent: 0, failed: 0, skipped: 0, gaveUp: 0 };
  const apiKey = typeof env?.RESEND_API_KEY === "string" ? env.RESEND_API_KEY : "";
  if (!apiKey || !kv) return summary;

  // Cheap gate first: without the flag nothing is queued, so never spend a kv.list call.
  let flag = null;
  try {
    flag = await kv.get(PENDING_FLAG_KEY);
  } catch {
    return summary;
  }
  if (!flag) return summary;

  let listed = null;
  try {
    listed = await kv.list({ prefix: PENDING_PREFIX, limit: CRON_BATCH_LIMIT });
  } catch {
    return summary;
  }

  const entries = Array.isArray(listed?.keys) ? listed.keys.slice(0, CRON_BATCH_LIMIT) : [];
  let removed = 0;

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
      removed += 1;
      summary.skipped += 1;
      logCronResult({ messageId: key, status: lastStatus, attempts, result: "skipped" });
      continue;
    }

    const dedupeKey = forwardKey(messageId);

    if (attempts >= MAX_PENDING_ATTEMPTS) {
      // Found already at/over the retry budget: give up instead of resending.
      await giveUpPending({ kv, key, dedupeKey, messageId, status: lastStatus, attempts });
      removed += 1;
      summary.gaveUp += 1;
      continue;
    }

    const nextAttemptAt = Number.isFinite(record?.nextAttemptAt) ? record.nextAttemptAt : 0;
    if (nextAttemptAt > now()) {
      // Not due yet: leave the queued record untouched and write no KV at all.
      summary.skipped += 1;
      logCronResult({ messageId, status: lastStatus, attempts, result: "skipped" });
      continue;
    }

    let marker = null;
    try {
      marker = await kv.get(dedupeKey);
    } catch {
      marker = null;
    }

    if (marker === "1" || marker === FORWARD_FAILED_MARK) {
      // Already delivered or already given up; just drop the stale queued record.
      await deletePendingKey(kv, key);
      removed += 1;
      summary.skipped += 1;
      logCronResult({ messageId, status: lastStatus, attempts, result: "skipped" });
      continue;
    }
    if (marker === FORWARD_SENDING_PLACEHOLDER) {
      // Another request is in flight; leave the queued record for a later run.
      summary.skipped += 1;
      logCronResult({ messageId, status: lastStatus, attempts, result: "skipped" });
      continue;
    }

    // Claim only when the dedupe key is not already "pending": leaving an existing
    // pending mark alone is what keeps the failure path at a single KV put.
    const claimed = marker !== FORWARD_PENDING_MARK;
    if (claimed) {
      try {
        await kv.put(dedupeKey, FORWARD_SENDING_PLACEHOLDER, { expirationTtl: CRON_SENDING_TTL_SECONDS });
      } catch {
        summary.skipped += 1;
        logCronResult({ messageId, status: lastStatus, attempts, result: "skipped" });
        continue;
      }
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
      // Success path KV ops: 1 put (dedupe "1") + 1 delete (queued record).
      try {
        await kv.put(dedupeKey, "1", { expirationTtl: FORWARD_TTL_SECONDS });
      } catch {
        // Marking is best effort; a 2xx already sent the email.
      }
      await deletePendingKey(kv, key);
      removed += 1;
      summary.sent += 1;
      logCronResult({ messageId, status, attempts, result: "sent" });
      continue;
    }

    const nextAttempts = attempts + 1;
    if (nextAttempts >= MAX_PENDING_ATTEMPTS) {
      // This failure exhausts the retry budget: drop the record and mark it failed.
      await giveUpPending({ kv, key, dedupeKey, messageId, status, attempts: nextAttempts });
      removed += 1;
      summary.gaveUp += 1;
      continue;
    }

    // Failure path KV ops: exactly 1 put (the updated queued record, with the backoff
    // delay). The dedupe key is only rewritten to "pending" when the claim above really
    // replaced a different marker, so the common case stays at one write per run.
    try {
      await kv.put(key, JSON.stringify({
        messageId,
        body,
        attempts: nextAttempts,
        firstFailedAt,
        lastStatus: status,
        nextAttemptAt: now() + pendingBackoffMs(nextAttempts),
      }), { expirationTtl: PENDING_TTL_SECONDS });
      if (claimed) {
        await kv.put(dedupeKey, FORWARD_PENDING_MARK, { expirationTtl: PENDING_TTL_SECONDS });
      }
    } catch {
      // Keeping the previous queued record is best effort; the next run retries it.
    }
    summary.failed += 1;
    logCronResult({ messageId, status, attempts: nextAttempts, result: "failed" });
  }

  // Once a complete listing has been fully drained, drop the flag so later runs return
  // before ever calling kv.list. Records left behind (backoff or in flight) keep it.
  if (listed?.list_complete && removed >= entries.length) await deletePendingFlag(kv);

  return summary;
}
