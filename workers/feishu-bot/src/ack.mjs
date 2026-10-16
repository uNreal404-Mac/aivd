export const ACK_SIGNATURE = "——老三";
export const ACK_TTL_SECONDS = 604800;
export const MAX_ACK_SUMMARY_CHARS = 30;

const ACK_PREFIX = "收到，我理解是：";
const ACK_SUFFIX = "。马上安排，结果稍后回复。";
export const ACK_FALLBACK_TEXT = `收到，马上处理，结果稍后回复。${ACK_SIGNATURE}`;

export function ackKey(messageId) {
  return `feishu:acked:message:${messageId}`;
}

export function normalizeAckSummary(summary) {
  const value = String(summary ?? "").replace(/[。.!！?？、,，\s]+$/u, "").trim();
  if (!value) return "";
  return Array.from(value).slice(0, MAX_ACK_SUMMARY_CHARS).join("");
}

export function buildAckText(summary) {
  const normalized = normalizeAckSummary(summary);
  if (!normalized) return ACK_FALLBACK_TEXT;
  return `${ACK_PREFIX}${normalized}${ACK_SUFFIX}${ACK_SIGNATURE}`;
}
