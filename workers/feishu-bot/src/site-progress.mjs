/**
 * Deterministic, LLM-free website-progress copy for Feishu.
 * Partner-facing text must never include PR numbers, issue refs, commit SHAs, or branch names.
 */

import { sanitizeRequestText } from "./privacy.mjs";

export const PROGRESS_TITLE = "网站进度";
export const PENDING_HEADING = "还没做";
export const PUBLIC_SITE_URL = "https://dreamutopia-video.pages.dev";

export const ISSUE_REF_PATTERN = /#\d+/;
export const SHA_PATTERN = /\b(?=[0-9a-f]{7,40}\b)[0-9a-f]*[a-f][0-9a-f]*\b/i;
export const BRANCH_PATTERN = /\b(?:cursor|codex|origin)\/[A-Za-z0-9._/-]+/;

export const DEFAULT_PENDING_ITEMS = [
  "定价方案还没定",
  "正式域名还没定",
  "支付还没开通",
];

export const PAGE_PATH_RULES = [
  { match: /^(?:out\/examples(?:\/|\.html$)|functions\/examples|libs\/examples)/, page: "案例页" },
  { match: /^out\/pricing\.html$/, page: "定价页" },
  { match: /^(?:out\/workspace\.html|out\/demo\.html|out\/assets\/js\/demo\.js)$/, page: "生成页" },
  { match: /^(?:out\/auth\.html|out\/reset\.html)$/, page: "登录页" },
  { match: /^(?:out\/partners\.html|libs\/partners)/, page: "合作页" },
  { match: /^out\/(?:privacy|terms)\.html$/, page: "政策页" },
  {
    match: /^(?:out\/index\.html|out\/image-to-video\.html|out\/photo-to-video\.html|out\/free-ai-video\.html|out\/assets\/js\/(?:du|i18n|seo)\.js)$/,
    page: "首页",
  },
];

const PAGE_PRIORITY = ["案例页", "生成页", "定价页", "首页", "合作页", "登录页", "政策页"];

const PAGE_DEFAULT_DONE = {
  案例页: "换成我们自己的样片",
  生成页: "操作和预览更好用了",
  定价页: "更新了价格和套餐说明",
  首页: "展示内容有更新",
  合作页: "加了给客户看的说明",
  登录页: "登录入口更清楚了",
  政策页: "条款说明有更新",
};

const DONE_RULES = [
  { re: /examples|案例|样片|sample pages/i, page: "案例页", text: "换成我们自己的样片" },
  { re: /demo mode|演示模式|demo sample|titled demo/i, page: "生成页", text: "可以用现成片子试看效果" },
  { re: /\bdemo\b|演示/i, page: "生成页", text: "可以用现成片子试看效果" },
  { re: /partners|合作页|影视/i, page: "合作页", text: "加了给影视客户看的进度说明" },
  { re: /pricing|定价|checkout|积分包|credit pack/i, page: "定价页", text: "更新了价格和套餐说明" },
  { re: /history|gallery|图库|历史记录/i, page: "生成页", text: "可以查看做过的片子" },
  { re: /workspace|生成页|generator/i, page: "生成页", text: "操作台更好用了" },
  { re: /auth|登录|注册/i, page: "登录页", text: "登录入口更清楚了" },
  { re: /business|企业定制|询价/i, page: "首页", text: "去掉了企业询价入口" },
];

const PENDING_RULES = [
  { re: /飞书|入群|合伙人/i, skip: true },
  { re: /ZCV|zombie-couple|僵尸/i, skip: true },
  { re: /feishu|webhook|wrangler|kv namespace|kv binding/i, skip: true },
  { re: /定价|订阅|积分|credit/i, text: "定价方案还没定" },
  { re: /域名/i, text: "正式域名还没定" },
  { re: /支付|Stripe/i, text: "支付还没开通" },
  { re: /Next\.js|shadcn|迁移/i, text: "整站改版方案还没定" },
  { re: /P0 UX|auth dialog|credits skeleton|gallery empty|登录和积分/i, text: "登录和积分显示还要再改" },
  { re: /1101|history JSON|worker_exception|generateReady|生成接口/i, text: "生成失败时页面提示还不稳" },
  { re: /Higgsfield|差距清单/i, text: "和对标产品的差距清单还没做" },
  { re: /中转|上游|evolink|\bkie\b/i, text: "视频生成通道还没接完" },
];

const INTERNAL_TITLE = /feishu|飞书|bot worker|webhook notify|wrangler|kv binding|kv namespace/i;

function labelBlob(labels) {
  return (Array.isArray(labels) ? labels : [])
    .map((label) => (typeof label === "string" ? label : label?.name))
    .filter(Boolean)
    .join(" ");
}

function uniqueKeepOrder(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const value = String(item || "").trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

function collapseEmptyFragments(value) {
  let text = String(value ?? "");
  // Leftover shells after stripping "见 PR #34（sha）。" → "见 。"
  // Also covers "案例页已更新。见 PR #34。" / "详见 PR #34。" after the link is gone.
  text = text.replace(/(?:^|[\s（(【，,、:：。．.])(?:详见|参见|见)\s*[。．.]+/g, (match) => (
    /^[\s（(【，,、:：。．.]/.test(match) ? match[0] : ""
  ));
  // Leftover shells after stripping "合并 PR #21 与 #16" → "合并 与"
  text = text.replace(/合并\s+(?:与|和|及)\s*(?=[。．.，,、:：]|$)/g, "");
  text = text.replace(/\s+(?:与|和|及)\s*(?=[。．.，,、:：]|$)/g, "");
  text = text.replace(/\s+([。．.，,、:：])/g, "$1");
  text = text.replace(/^[。．.，,、:：]+/, "");
  text = text.replace(/[。．]{2,}/g, "。");
  return text;
}

export function stripTrackerTokens(text) {
  let value = String(text ?? "");
  value = value.replace(/\bPR\s*#?\s*\d+\b/gi, "");
  value = value.replace(/[（(]\s*#\d+\s*[）)]/g, "");
  value = value.replace(/#\d+/g, "");
  value = value.replace(/\b(?=[0-9a-f]{7,40}\b)[0-9a-f]*[a-f][0-9a-f]*\b/gi, "");
  value = value.replace(/\b(?:cursor|codex|origin)\/[A-Za-z0-9._/-]+/g, "");
  value = value.replace(/[（(]\s*[）)]/g, "");
  value = collapseEmptyFragments(value);
  value = value.replace(/[，、]{2,}/g, "、");
  value = value.replace(/[ \t]{2,}/g, " ");
  return value.replace(/[ \t]+\n/g, "\n").trim();
}

export function hasTrackerTokens(text) {
  const value = String(text ?? "");
  return ISSUE_REF_PATTERN.test(value) || SHA_PATTERN.test(value) || BRANCH_PATTERN.test(value);
}

function sanitizeLine(text) {
  const stripped = stripTrackerTokens(sanitizeRequestText(text));
  return hasTrackerTokens(stripped) ? "" : stripped;
}

function isInternalPath(file) {
  const value = String(file || "").replace(/^\.\//, "");
  if (!value) return true;
  if (/^out\//.test(value) || /^functions\//.test(value) || /^libs\//.test(value)) return false;
  return /^(?:workers\/|scripts\/|docs\/|\.github\/)/.test(value) || /\.md$/i.test(value);
}

export function pageFromPath(file) {
  const value = String(file || "").replace(/^\.\//, "");
  for (const rule of PAGE_PATH_RULES) {
    if (rule.match.test(value)) return rule.page;
  }
  return "";
}

export function pagesFromFiles(files) {
  const pages = [];
  for (const file of Array.isArray(files) ? files : []) {
    const page = pageFromPath(file);
    if (page && !pages.includes(page)) pages.push(page);
  }
  return PAGE_PRIORITY.filter((page) => pages.includes(page)).concat(
    pages.filter((page) => !PAGE_PRIORITY.includes(page)),
  );
}

function isInternalChange({ title, files }) {
  const list = Array.isArray(files) ? files.filter(Boolean) : [];
  if (pagesFromFiles(list).length) return false;
  if (INTERNAL_TITLE.test(String(title || ""))) return true;
  return list.length > 0 && list.every(isInternalPath);
}

function matchDoneRule(title, labels) {
  const blob = `${title || ""} ${labelBlob(labels)}`;
  return DONE_RULES.find((rule) => rule.re.test(blob)) || null;
}

export function describeUserVisibleChange({ title = "", labels = [], files = [] } = {}) {
  if (isInternalChange({ title, files })) return "";
  const pages = pagesFromFiles(files);
  const rule = matchDoneRule(title, labels);
  const page = pages[0] || rule?.page || "";
  const change = rule?.text || (page ? PAGE_DEFAULT_DONE[page] : "");
  if (!page || !change) return "";
  const line = change.startsWith(page) ? change : `${page}${change}`;
  return sanitizeLine(line);
}

export function describeUserVisibleChanges({ title = "", labels = [], files = [] } = {}) {
  if (isInternalChange({ title, files })) return [];
  const pages = pagesFromFiles(files);
  const rule = matchDoneRule(title, labels);
  if (pages.length > 1) {
    return uniqueKeepOrder(pages.map((page) => {
      const change = (rule?.page === page ? rule.text : "") || PAGE_DEFAULT_DONE[page] || "";
      if (!change) return "";
      return sanitizeLine(change.startsWith(page) ? change : `${page}${change}`);
    }));
  }
  const one = describeUserVisibleChange({ title, labels, files });
  return one ? [one] : [];
}

export function extractPendingRaw(markdown) {
  const items = [];
  let inBlockers = false;
  for (const rawLine of String(markdown ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^#{1,6}\s*卡点/.test(line)) {
      inBlockers = true;
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      inBlockers = false;
      continue;
    }
    const unchecked = line.match(/^[-*]\s*\[\s*\]\s*(.+)$/);
    if (unchecked) {
      items.push(unchecked[1].trim());
      continue;
    }
    if (inBlockers) {
      const bullet = line.match(/^[-*]\s+(?!\[[ xX]\])(.+)$/);
      if (bullet) items.push(bullet[1].trim());
    }
  }
  return items;
}

export function describePendingItem(raw) {
  const source = String(raw ?? "").trim();
  if (!source) return "";
  for (const rule of PENDING_RULES) {
    if (!rule.re.test(source)) continue;
    if (rule.skip) return "";
    return sanitizeLine(rule.text);
  }
  const fallback = sanitizeLine(source);
  if (!fallback || hasTrackerTokens(fallback)) return "";
  if (!/[\u4e00-\u9fff]/.test(fallback) || fallback.length < 4) return "";
  if (INTERNAL_TITLE.test(fallback)) return "";
  return fallback.length > 40 ? `${fallback.slice(0, 37)}…` : fallback;
}

export function pendingItemsFromGithub({ issueBody = "", openPulls = [] } = {}) {
  const raw = [
    ...extractPendingRaw(issueBody),
    ...(Array.isArray(openPulls) ? openPulls.map((pull) => pull?.title).filter(Boolean) : []),
  ];
  const items = uniqueKeepOrder(raw.map(describePendingItem));
  return items.length ? items.slice(0, 8) : [...DEFAULT_PENDING_ITEMS];
}

export function formatWebsiteProgress({
  doneItems = [],
  pendingItems = [],
  detailUrl = "",
  title = PROGRESS_TITLE,
} = {}) {
  const done = uniqueKeepOrder((Array.isArray(doneItems) ? doneItems : []).map(sanitizeLine)).slice(0, 6);
  const pending = uniqueKeepOrder((Array.isArray(pendingItems) ? pendingItems : []).map(sanitizeLine)).slice(0, 8);
  const lines = [title, ""];
  if (done.length) {
    for (const item of done) lines.push(`• ${item}`);
  } else {
    lines.push("• 网站还在持续更新，打开页面即可看到现有功能");
  }
  lines.push("", PENDING_HEADING);
  const pendingLines = pending.length ? pending : DEFAULT_PENDING_ITEMS;
  for (const item of pendingLines) lines.push(`• ${item}`);
  const detail = String(detailUrl || "").trim();
  if (detail) {
    lines.push("", `详情 ${detail}`);
  }
  const rendered = lines.join("\n");
  return rendered
    .split("\n")
    .map((line) => (line.trim() ? stripTrackerTokens(line) : line))
    .join("\n")
    .replace(/#\d+/g, "")
    .replace(/\b(?=[0-9a-f]{7,40}\b)[0-9a-f]*[a-f][0-9a-f]*\b/gi, "");
}

export function buildProgressFromGithub({
  issueBody = "",
  mergedPulls = [],
  openPulls = [],
  deploy = null,
  detailUrl = "",
} = {}) {
  const doneItems = [];
  if (deploy) doneItems.push(...describeUserVisibleChanges(deploy));
  for (const pull of Array.isArray(mergedPulls) ? mergedPulls : []) {
    doneItems.push(...describeUserVisibleChanges({
      title: pull?.title,
      labels: pull?.labels,
      files: pull?.files,
    }));
  }
  return formatWebsiteProgress({
    doneItems,
    pendingItems: pendingItemsFromGithub({ issueBody, openPulls }),
    detailUrl,
  });
}

export function formatPlainNotes(entries, { limit = 5 } = {}) {
  const items = (Array.isArray(entries) ? entries : [])
    .map((entry) => (typeof entry === "string" ? entry : entry?.body))
    .map((text) => sanitizeLine(text))
    .filter(Boolean)
    .slice(-Math.max(1, limit))
    .map((line) => (line.length > 80 ? `${line.slice(0, 77)}…` : line));
  return items.map((line) => `• ${line}`).join("\n");
}

export const STATIC_PROGRESS_MESSAGE = formatWebsiteProgress({
  doneItems: [],
  pendingItems: DEFAULT_PENDING_ITEMS,
  detailUrl: PUBLIC_SITE_URL,
});
