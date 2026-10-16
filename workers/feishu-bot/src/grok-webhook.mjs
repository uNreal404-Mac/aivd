const DEFAULT_WEBHOOK_HEADER = "Authorization";
const WEBHOOK_TIMEOUT_MS = 5000;
const BEARER_PREFIX = "Bearer";

export function buildWebhookPayload({
  text = "",
  senderOpenId = "",
  senderName = "",
  messageId = "",
  chatId = "",
  mentionedBot = false,
} = {}) {
  return {
    text: typeof text === "string" ? text : "",
    sender_open_id: typeof senderOpenId === "string" ? senderOpenId : "",
    sender_name: typeof senderName === "string" ? senderName : "",
    message_id: typeof messageId === "string" ? messageId : "",
    chat_id: typeof chatId === "string" ? chatId : "",
    mentioned_bot: Boolean(mentionedBot),
  };
}

function webhookHeaderName(env) {
  const configured = typeof env?.GROK_WEBHOOK_HEADER === "string" ? env.GROK_WEBHOOK_HEADER.trim() : "";
  return configured || DEFAULT_WEBHOOK_HEADER;
}

// The webhook is a mirror: it must never affect the email or the acknowledgement, so
// every failure is logged (status or message only, never the key) and swallowed.
export async function postGrokWebhook({ env, payload, fetchImpl = fetch } = {}) {
  const url = typeof env?.GROK_WEBHOOK_URL === "string" ? env.GROK_WEBHOOK_URL.trim() : "";
  const key = typeof env?.GROK_WEBHOOK_KEY === "string" ? env.GROK_WEBHOOK_KEY.trim() : "";
  if (!url || !key) return { skipped: true };

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [webhookHeaderName(env)]: `${BEARER_PREFIX} ${key}`,
      },
      body: JSON.stringify(payload ?? {}),
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
      redirect: "error",
    });
    if (!response?.ok) {
      console.log(`[feishu-webhook] status=${response?.status ?? "unknown"}`);
      return { skipped: false, ok: false, status: response?.status ?? null };
    }
    return { skipped: false, ok: true, status: response.status };
  } catch (error) {
    console.log(`[feishu-webhook] failed error=${error?.message ?? error}`);
    return { skipped: false, ok: false, status: null };
  }
}
