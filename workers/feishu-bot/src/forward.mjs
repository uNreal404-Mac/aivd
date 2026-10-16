export const GROK_FORWARD_CHAT_ID = "oc_ff147ab4f0cf2288fe99fda95e9e54ad";

const FORWARD_TIMEOUT_MS = 8000;
const FORWARD_TTL_SECONDS = 604800;

export function forwardKey(eventId) {
  return `feishu:forwarded:event:${eventId}`;
}

export async function forwardToGrok({ env, kv, payload, selected, context, fetchImpl }) {
  try {
    if (selected?.chatType !== "group") return false;
    if (context?.chatId !== GROK_FORWARD_CHAT_ID) return false;

    const url = typeof env?.GROK_FORWARD_URL === "string" ? env.GROK_FORWARD_URL : "";
    const forwardingKey = typeof env?.GROK_FORWARD_KEY === "string" ? env.GROK_FORWARD_KEY : "";
    if (!url || !forwardingKey || !kv) return false;

    const dedupeKey = forwardKey(selected.eventId);
    if (await kv.get(dedupeKey)) return true;

    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${forwardingKey}`,
      },
      body: JSON.stringify({
        sender_open_id: context.senderOpenId,
        sender_name: context.senderName,
        text: typeof selected.text === "string" ? selected.text.trim() : selected.text,
        chat_id: context.chatId,
        message_id: selected.messageId,
        create_time: payload?.event?.message?.create_time ?? "",
      }),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });

    if (!response?.ok) return false;
    await kv.put(dedupeKey, "1", { expirationTtl: FORWARD_TTL_SECONDS });
    return true;
  } catch {
    return false;
  }
}
