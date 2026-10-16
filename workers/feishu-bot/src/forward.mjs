export const GROK_FORWARD_CHAT_ID = "oc_ff147ab4f0cf2288fe99fda95e9e54ad";
export const FORWARD_EMAIL_FROM = "onboarding@resend.dev";
export const FORWARD_EMAIL_TO = ["tuapi@mail.grokbot.com"];

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const FORWARD_TIMEOUT_MS = 8000;
const FORWARD_TTL_SECONDS = 604800;

export function forwardKey(eventId) {
  return `feishu:forwarded:event:${eventId}`;
}

export async function forwardToGrok({ env, kv, payload, selected, context, fetchImpl }) {
  try {
    if (selected?.chatType !== "group") return false;
    if (context?.chatId !== GROK_FORWARD_CHAT_ID) return false;

    const apiKey = typeof env?.RESEND_API_KEY === "string" ? env.RESEND_API_KEY : "";
    if (!apiKey || !kv) return false;

    const dedupeKey = forwardKey(selected.eventId);
    if (await kv.get(dedupeKey)) return true;

    const text = [
      `sender_open_id: ${context.senderOpenId}`,
      `sender_name: ${context.senderName}`,
      `text: ${typeof selected.text === "string" ? selected.text.trim() : selected.text}`,
      `chat_id: ${context.chatId}`,
      `message_id: ${selected.messageId}`,
      `create_time: ${payload?.event?.message?.create_time ?? ""}`,
    ].join("\n");

    const response = await fetchImpl(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: FORWARD_EMAIL_FROM,
        to: FORWARD_EMAIL_TO,
        subject: `[feishu] ${context.senderName || "unknown"}`,
        text,
      }),
      signal: AbortSignal.timeout(FORWARD_TIMEOUT_MS),
    });

    if (!response?.ok) {
      console.error(`Resend email forward failed with status ${response?.status ?? "unknown"}`);
      return false;
    }
    await kv.put(dedupeKey, "1", { expirationTtl: FORWARD_TTL_SECONDS });
    return true;
  } catch (error) {
    console.error(`Resend email forward failed with status ${error?.status ?? "unknown"}`);
    return false;
  }
}
