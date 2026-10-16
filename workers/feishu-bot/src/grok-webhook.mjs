const WEBHOOK_TIMEOUT_MS = 5000;
export const WEBHOOK_RETRY_DELAYS_MS = [500, 1500];

function defaultSleep(ms) {
  return new Promise((resolve) => { setTimeout(resolve, ms); });
}

// The payload is intentionally positional and stable: it is the contract the Grok
// side validates against, so every field is normalized to a string/boolean.
export function buildWebhookPayload({ selected, context, mentionedBot = false } = {}) {
  return {
    text: typeof selected?.text === "string" ? selected.text : "",
    sender_open_id: typeof context?.senderOpenId === "string" ? context.senderOpenId : "",
    sender_name: typeof context?.senderName === "string" ? context.senderName : "",
    message_id: typeof selected?.messageId === "string" ? selected.messageId : "",
    chat_id: typeof context?.chatId === "string" ? context.chatId : "",
    mentioned_bot: Boolean(mentionedBot),
  };
}

// The webhook is a mirror of the email forward: it must never affect the forward or
// the acknowledgement, so every failure is logged (status only, never the URL/key)
// and swallowed. A missing URL or key is a cheap skip without a fetch.
export async function postGrokWebhook({ env, payload, fetchImpl = fetch, sleep } = {}) {
  const url = typeof env?.GROK_WEBHOOK_URL === "string" ? env.GROK_WEBHOOK_URL.trim() : "";
  const key = typeof env?.GROK_WEBHOOK_KEY === "string" ? env.GROK_WEBHOOK_KEY.trim() : "";
  if (!url || !key) return { skipped: true };

  const messageId = typeof payload?.message_id === "string" ? payload.message_id : "";
  const wait = typeof sleep === "function" ? sleep : defaultSleep;
  const totalAttempts = WEBHOOK_RETRY_DELAYS_MS.length + 1;
  let status = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(payload ?? {}),
        signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
        redirect: "error",
      });
      status = response?.status ?? null;
      if (response?.ok) {
        console.log(`[grok-webhook] message_id=${messageId} attempt=${attempt} status=${status ?? "ok"}`);
        return { ok: true, attempts: attempt, status };
      }
      console.log(`[grok-webhook] message_id=${messageId} attempt=${attempt} status=${status ?? "unknown"}`);
    } catch {
      status = null;
      console.log(`[grok-webhook] message_id=${messageId} attempt=${attempt} status=error`);
    }
    if (attempt <= WEBHOOK_RETRY_DELAYS_MS.length) await wait(WEBHOOK_RETRY_DELAYS_MS[attempt - 1]);
  }

  return { ok: false, attempts: totalAttempts, status };
}
