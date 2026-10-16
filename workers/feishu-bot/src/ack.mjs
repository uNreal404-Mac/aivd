export const ACK_SIGNATURE = "——老三";
export const ACK_TTL_SECONDS = 604800;
export const MAX_ACK_SUMMARY_CHARS = 30;

const ACK_PREFIX = "收到，我理解是：";
const ACK_SUFFIX = "。马上安排，结果稍后回复。";
export const ACK_FALLBACK_TEXT = `收到，马上处理，结果稍后回复。${ACK_SIGNATURE}`;

const UNSAFE_ACK_PATTERNS = [
  /https?:\/\//i,
  /www\./i,
  /\.(dev|com|ai|net|org|cn|io|app|co)\b/i,
];

// Acknowledgements are a receipt, not a promise: time words, amounts and
// commitments must never be echoed back as if the bot had agreed to them.
const UNSAFE_ACK_TIME_WORDS = ["今天", "明天", "今晚", "马上上线", "几点", "小时", "分钟", "号", "日"];
const UNSAFE_ACK_AMOUNT_PATTERNS = [
  /[$¥￥€]/,
  /\d+(\.\d+)?\s*(元|块|美元|刀|usd|rmb)/i,
];
const UNSAFE_ACK_AMOUNT_WORDS = ["价格", "费用", "免费"];
const UNSAFE_ACK_COMMITMENT_WORDS = ["保证", "一定", "已上线", "已完成"];

export function ackKey(messageId) {
  return `feishu:acked:message:${messageId}`;
}

export function normalizeAckSummary(summary) {
  const value = String(summary ?? "").replace(/[。.!！?？、,，\s]+$/u, "").trim();
  if (!value) return "";
  return Array.from(value).slice(0, MAX_ACK_SUMMARY_CHARS).join("");
}

export function isSafeAckSummary(summary) {
  const value = typeof summary === "string" ? summary : String(summary ?? "");
  if (!value) return false;
  if (UNSAFE_ACK_PATTERNS.some((pattern) => pattern.test(value))) return false;
  if (UNSAFE_ACK_TIME_WORDS.some((word) => value.includes(word))) return false;
  if (UNSAFE_ACK_AMOUNT_PATTERNS.some((pattern) => pattern.test(value))) return false;
  if (UNSAFE_ACK_AMOUNT_WORDS.some((word) => value.includes(word))) return false;
  if (UNSAFE_ACK_COMMITMENT_WORDS.some((word) => value.includes(word))) return false;
  return true;
}

export function buildAckText(summary) {
  const normalized = normalizeAckSummary(summary);
  if (!normalized || !isSafeAckSummary(normalized)) return ACK_FALLBACK_TEXT;
  return `${ACK_PREFIX}${normalized}${ACK_SUFFIX}${ACK_SIGNATURE}`;
}
