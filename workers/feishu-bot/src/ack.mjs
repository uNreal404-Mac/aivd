export const ACK_SIGNATURE = "——老三";
export const ACK_TTL_SECONDS = 604800;

// The acknowledgement is always this fixed receipt text. It never summarises the
// user's message, so it can neither echo a commitment back nor leak model output.
export const ACK_FALLBACK_TEXT = `收到，马上处理，结果稍后回复。${ACK_SIGNATURE}`;

export function ackKey(messageId) {
  return `feishu:acked:message:${messageId}`;
}
