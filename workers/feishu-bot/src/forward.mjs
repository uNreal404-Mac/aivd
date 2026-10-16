export const GROK_FORWARD_CHAT_ID = "oc_ff147ab4f0cf2288fe99fda95e9e54ad";
export const FORWARD_EMAIL_FROM = "onboarding@resend.dev";
export const FORWARD_EMAIL_TO = ["tuapi@mail.grokbot.com"];

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FORWARD_TIMEOUT_MS = 8000;
const FORWARD_TTL_SECONDS = 604800;

const RETRY_DELAYS_MS = [1000, 3000];

export const FORWARD_SENDING_PLACEHOLDER = "sending";
export const FORWARD_SENDING_TTL_SECONDS = 120;

export function forwardKey(messageId) {
  return `feishu:forwarded:message:${messageId}`;
}

export function senderLabel(context) {
  // senderName is filled by the worker's getUserName contact lookup; when that lookup
  // fails it is empty, so the label falls back to the first 8 characters of the open_id.
  const name = typeof context?.senderName === "string" ? context.senderName.trim() : "";
  if (name) return name;
  const openId = typeof context?.senderOpenId === "string" ? context.senderOpenId : "";
  if (openId) return openId.slice(0, 8);
  return "unknown";
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
  const createTime = payload?.event?.message?.create_time ?? "";
  const body = JSON.stringify({
    from: FORWARD_EMAIL_FROM,
    to: FORWARD_EMAIL_TO,
    subject: `[feishu] ${senderLabel(context)} (${context.senderOpenId || "unknown"}) ${selected.messageId}`,
    text: [
      `sender_name: ${context.senderName ?? ""}`,
      `sender_open_id: ${context.senderOpenId ?? ""}`,
      `message_type: ${selected.messageType ?? ""}`,
      `text: ${typeof selected.text === "string" ? selected.text.trim() : selected.text}`,
      `chat_id: ${context.chatId}`,
      `message_id: ${selected.messageId}`,
      `create_time: ${createTime}`,
    ].join("\n"),
  });

  let attempts = 0;
  let status = null;
  for (let index = 0; index <= RETRY_DELAYS_MS.length; index += 1) {
    attempts += 1;
    let resendAt = Date.now();
    let ok = false;
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
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

  try {
    await kv.delete(dedupeKey);
  } catch {
    // Clearing is best effort; dropping the placeholder clears the in-flight claim.
  }

  return { ok: false, attempts, status };
}
