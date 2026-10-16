import { HEALTH_URL } from "./health.mjs";
import { chatCompletionsUrl } from "./llm.mjs";

export const AUTO_PROGRESS_KEY = "status:current";
export const AUTO_DEPLOY_KEY = "deploy:latest";
export const AUTO_PING_TEXT = "在的，收到，正在处理。";

export const AUTO_EVENT_KEY_PREFIX = "feishu:auto:event:";
export const AUTO_EVENT_TTL_SECONDS = 604800;

export const AUTO_LLM_SWITCH_VALUE = "true";
export const AUTO_LLM_COUNT_PREFIX = "feishu:auto:llm:count:";
export const AUTO_LLM_COUNT_TTL_SECONDS = 172800;
export const AUTO_LLM_DEFAULT_DAILY_LIMIT = 50;
export const AUTO_LLM_DEFAULT_TIMEOUT_MS = 9000;
export const AUTO_LLM_MAX_TIMEOUT_MS = 20000;
export const AUTO_LLM_MAX_TOKENS = 200;
export const AUTO_LLM_NEEDS_DECISION = "NEEDS_DECISION";
export const AUTO_LLM_UNSURE = "UNSURE";
export const AUTO_LLM_UNSURE_REPLY = "这个问题老三稍后回复你。";

// The site runs on Taipei time, so one "day" for the LLM counter should too.
const AUTO_LLM_TIME_ZONE = "Asia/Taipei";

export function autoEventKey(eventId) {
  return `${AUTO_EVENT_KEY_PREFIX}${eventId}`;
}

export function isLlmAutoAnswerEnabled(env = {}) {
  return env?.LLM_AUTO_ANSWER_ENABLED === AUTO_LLM_SWITCH_VALUE;
}

function resolvePositiveInt(raw, fallback) {
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveAutoLlmTimeoutMs(raw) {
  return Math.min(AUTO_LLM_MAX_TIMEOUT_MS, resolvePositiveInt(raw, AUTO_LLM_DEFAULT_TIMEOUT_MS));
}

export function resolveAutoLlmConfig(env = {}) {
  const baseUrl = String(env?.LLM_BASE_URL ?? "").trim();
  const model = String(env?.LLM_MODEL ?? "").trim();
  const apiKey = String(env?.LLM_API_KEY ?? "").trim();
  if (!baseUrl || !model || !apiKey) return null;
  return {
    baseUrl,
    model,
    apiKey,
    dailyLimit: resolvePositiveInt(env?.LLM_DAILY_LIMIT, AUTO_LLM_DEFAULT_DAILY_LIMIT),
    timeoutMs: resolveAutoLlmTimeoutMs(env?.LLM_TIMEOUT_MS),
  };
}

export function autoLlmCountKey(now = Date.now(), timeZone = AUTO_LLM_TIME_ZONE) {
  const date = new Date(typeof now === "function" ? now() : now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${AUTO_LLM_COUNT_PREFIX}${get("year")}-${get("month")}-${get("day")}`;
}

const MAX_QUESTION_LENGTH = 20;
const HEALTH_TIMEOUT_MS = 3000;

const MENTION_PLACEHOLDER_PATTERN = /@_user_\d+/gu;
const LEADING_MENTION_PATTERN = /^\s*@[^\s@]+/u;
const PUNCTUATION_PATTERN = /[\s\p{P}\p{S}]/gu;
// Any change/pricing/direction word means the message is a request for a human, not
// something the bot can answer from KV or a health check.
const BLOCKED_WORD_PATTERN = /(改|加|删|换|调整|功能|价格|定价|收费|方向|需求|为什么|怎么|要不要|能不能|bug)/u;

// Each intent is a single anchored pattern, so a question only classifies when its whole
// mention-free, punctuation-free text is that question. Anything else stays for a human.
const INTENT_PATTERNS = [
  ["progress", /^(?:进度|进展|做到哪了|做到哪一步了|到哪了|进度如何|现在进度|progress|status)(?:呢|吗)?$/u],
  ["url", /^(?:网址|链接|预览|预览地址|预览站|网站地址|地址是什么|url|link|preview)(?:是什么|呢|吗)?$/u],
  ["version", /^(?:版本|最新版本|部署了吗|上线了吗|version|deployed)(?:呢|吗)?$/u],
  ["ping", /^(?:在吗|在不在|收到吗|收到了吗|你在吗|你出哪去了|你去哪了|收到没|hello|hi|ping)(?:呢|吗)?$/u],
];

function stripQuestion(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(MENTION_PLACEHOLDER_PATTERN, " ")
    .replace(LEADING_MENTION_PATTERN, " ")
    .replace(PUNCTUATION_PATTERN, "")
    .toLowerCase();
}

export function classifyQuestion(text) {
  const stripped = stripQuestion(text);
  if (!stripped) return null;
  if ([...stripped].length > MAX_QUESTION_LENGTH) return null;
  if (BLOCKED_WORD_PATTERN.test(stripped)) return null;
  const matches = INTENT_PATTERNS.filter(([, pattern]) => pattern.test(stripped));
  return matches.length === 1 ? matches[0][0] : null;
}

async function readKv(kv, key) {
  if (typeof kv?.get !== "function") return null;
  try {
    const value = await kv.get(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

function healthOrigin(healthUrl) {
  try {
    return new URL(healthUrl).origin;
  } catch {
    return typeof healthUrl === "string" ? healthUrl : "";
  }
}

async function checkHealth({ fetchImpl, healthUrl, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(healthUrl, { method: "GET", signal: controller.signal });
    const status = Number.isFinite(response?.status) ? response.status : "unknown";
    return response?.ok ? `正常 (HTTP ${status})` : `异常 (HTTP ${status})`;
  } catch {
    return "无法访问";
  } finally {
    clearTimeout(timer);
  }
}

function parseDeployRecord(value) {
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === "string") return { version: parsed.trim(), time: "" };
    if (parsed && typeof parsed === "object") {
      return {
        version: typeof parsed.version === "string" ? parsed.version.trim() : "",
        time: typeof parsed.time === "string" ? parsed.time.trim() : "",
      };
    }
  } catch {
    // A bare string is a valid deploy marker.
  }
  return { version: value, time: "" };
}

export async function buildAutoAnswer({
  intent,
  kv,
  fetchImpl = fetch,
  healthUrl = HEALTH_URL,
  timeoutMs = HEALTH_TIMEOUT_MS,
} = {}) {
  if (intent === "progress") {
    const status = await readKv(kv, AUTO_PROGRESS_KEY);
    return status ? `当前进度：${status}` : "暂无进度记录，已转给老三。";
  }
  if (intent === "url") {
    const health = await checkHealth({ fetchImpl, healthUrl, timeoutMs });
    return `预览站：${healthOrigin(healthUrl)}\n健康检查：${health}`;
  }
  if (intent === "version") {
    const stored = await readKv(kv, AUTO_DEPLOY_KEY);
    if (!stored) return "暂无部署记录，已转给老三。";
    const { version, time } = parseDeployRecord(stored);
    if (!version) return "暂无部署记录，已转给老三。";
    return time ? `最新部署：${version}（${time}）` : `最新部署：${version}`;
  }
  if (intent === "ping") return AUTO_PING_TEXT;
  throw new TypeError(`Unknown auto-answer intent: ${intent}`);
}

function buildAutoLlmContext({ progress, deploy }) {
  const { version, time } = deploy ? parseDeployRecord(deploy) : { version: "", time: "" };
  const deployText = version ? (time ? `${version}（${time}）` : version) : "未知";
  return `进度: ${progress || "未知"}\n部署: ${deployText}`;
}

export function buildAutoLlmMessages({ context, question }) {
  return [
    {
      role: "system",
      content: [
        "只根据下面提供的上下文回答问题，不要编造数字、日期或价格。",
        `如果问题需要做决定（功能变更、定价、方向），只回复 ${AUTO_LLM_NEEDS_DECISION}。`,
        `如果不确定，只回复 ${AUTO_LLM_UNSURE}。`,
        "用简体中文回答，尽量简短。",
        "",
        "上下文",
        context,
      ].join("\n"),
    },
    { role: "user", content: `上下文：\n${context}\n\n问题：${question}` },
  ];
}

// Never invents an answer: every uncertain outcome is reported as a fallback so the
// caller can keep the original human-handling behaviour.
export async function llmAutoAnswer({ env = {}, kv, text, fetchImpl = fetch, now = Date.now } = {}) {
  const config = resolveAutoLlmConfig(env);
  const question = typeof text === "string" ? text.trim() : "";
  if (!config || !question) return { fallback: "error" };

  let countKey;
  try {
    countKey = autoLlmCountKey(now);
    const used = Number.parseInt((await readKv(kv, countKey)) || "0", 10) || 0;
    if (used >= config.dailyLimit) return { fallback: "limit" };
    // The attempt is counted before the model call so failures still consume quota;
    // KV read+write is not atomic, so concurrent questions may share a slot.
    await kv.put(countKey, String(used + 1), { expirationTtl: AUTO_LLM_COUNT_TTL_SECONDS });
  } catch {
    return { fallback: "error" };
  }

  const [progress, deploy] = await Promise.all([
    readKv(kv, AUTO_PROGRESS_KEY),
    readKv(kv, AUTO_DEPLOY_KEY),
  ]);
  const context = buildAutoLlmContext({ progress, deploy });

  try {
    const response = await fetchImpl(chatCompletionsUrl(config.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages: buildAutoLlmMessages({ context, question }),
        max_tokens: AUTO_LLM_MAX_TOKENS,
        temperature: 0,
        stream: false,
      }),
      signal: AbortSignal.timeout(config.timeoutMs),
      redirect: "error",
    });
    if (!response?.ok) return { fallback: "error" };

    let payload;
    try {
      payload = await response.json();
    } catch {
      return { fallback: "error" };
    }

    const answer = typeof payload?.choices?.[0]?.message?.content === "string"
      ? payload.choices[0].message.content.trim()
      : "";
    if (!answer) return { fallback: "error" };
    if (answer === AUTO_LLM_NEEDS_DECISION) return { fallback: "decision" };
    if (answer === AUTO_LLM_UNSURE) return { fallback: "unsure" };
    return { answer };
  } catch (error) {
    return { fallback: error?.name === "TimeoutError" ? "timeout" : "error" };
  }
}
