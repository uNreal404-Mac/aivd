/**
 * Shared outbound / GitHub redaction. Kept in its own module so site-progress
 * can sanitize #20 fallback copy without importing requests.mjs (cycle:
 * requests → commands → site-progress).
 *
 * Known #41 gap (later PR): Taiwan-style landlines like 02-2345-6789 (two dashes)
 * are not covered by the mainland 0xx-xxxxxxx pattern below.
 */
const ARABIC_AMOUNT = String.raw`[\d,]+(?:\.\d{1,2})?`;
const CN_AMOUNT_DIGITS = String.raw`[零〇一二三四五六七八九十百两]+`;
const CURRENCY_UNITS = String.raw`万美元|万元|块钱|人民币|美元|刀|USD|RMB|CNY|元|块`;
const SCALE_UNITS = String.raw`万|千|[kKw]`;
const NON_MONEY_COUNTERS = String.raw`次|播放|人|条|个|浏览`;
const SCALE_THEN_OPTIONAL_CURRENCY = String.raw`(?:${SCALE_UNITS})(?!\s*(?:${NON_MONEY_COUNTERS}))(?:\s*(?:${CURRENCY_UNITS}))?`;
const NAME_HONORIFIC = /(?!汇总)[\u4e00-\u9fff](?:总(?![结共体量数之和览])|经理|老师|老板|总监|董事长)/g;

export function sanitizeRequestText(text) {
  let value = String(text ?? "");
  value = value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[已脱敏-邮箱]");
  value = value.replace(/(?:\+?86[-\s]*)?1[3-9]\d(?:[-\s]?\d){8}\b/g, "[已脱敏-电话]");
  value = value.replace(/0\d{2,3}-?\d{7,8}\b/g, "[已脱敏-电话]");
  value = value.replace(NAME_HONORIFIC, "[已脱敏-姓名]");
  value = value.replace(/(?:[¥￥$€£]|RMB|CNY|USD)\s*[\d,]+(?:\.\d{1,2})?/gi, "[已脱敏-金额]");
  value = value.replace(
    new RegExp(`${ARABIC_AMOUNT}\\s*(?:${CURRENCY_UNITS}|${SCALE_THEN_OPTIONAL_CURRENCY})`, "gi"),
    "[已脱敏-金额]",
  );
  value = value.replace(
    new RegExp(`${CN_AMOUNT_DIGITS}(?:万|千)(?!\\s*(?:${NON_MONEY_COUNTERS}))(?:\\s*(?:${CURRENCY_UNITS}))?`, "g"),
    "[已脱敏-金额]",
  );
  value = value.replace(new RegExp(`${CN_AMOUNT_DIGITS}\\s*(?:${CURRENCY_UNITS})`, "g"), "[已脱敏-金额]");
  return value;
}
