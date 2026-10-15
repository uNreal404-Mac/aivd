import { HELP_MESSAGE, PROGRESS_MESSAGE } from "./commands.mjs";
import { botConfig, isAllowedRequestChat } from "./config.mjs";
import { listIssueComments } from "./github.mjs";
import { fetchHealthSummary } from "./health.mjs";
import { fetchProgressSummary } from "./progress.mjs";
import { sanitizeRequestText } from "./requests.mjs";
import { formatPlainNotes, stripTrackerTokens } from "./site-progress.mjs";

export const LLM_CAP_MESSAGE = "今天的对话次数已经用完，请明天再试。也可以回复「进度」「网址」或「健康」。";
export const DEFAULT_LLM_DAILY_LIMIT = 200;
export const DEFAULT_LLM_HISTORY_TURNS = 6;
export const DEFAULT_LLM_TIMEOUT_MS = 1200;
export const DEFAULT_LLM_HISTORY_TTL_SECONDS = 86400;

const encoder = new TextEncoder();

export function resolveLlmConfig(env = {}, config = botConfig) {
  const baseUrl = String(env?.LLM_BASE_URL ?? "").trim();
  const model = String(env?.LLM_MODEL ?? "").trim();
  const apiKey = String(env?.LLM_API_KEY ?? "").trim();
  if (!baseUrl || !model || !apiKey) return null;

  const dailyLimit = Number.parseInt(String(env?.LLM_DAILY_LIMIT ?? ""), 10);
  const historyTurns = Number.parseInt(String(env?.LLM_HISTORY_TURNS ?? ""), 10);
  const timeoutMs = Number.parseInt(String(env?.LLM_TIMEOUT_MS ?? ""), 10);
  const defaults = config?.llm ?? {};
  return {
    baseUrl,
    model,
    apiKey,
    dailyLimit: Number.isFinite(dailyLimit) && dailyLimit > 0 ? dailyLimit : (defaults.dailyLimit || DEFAULT_LLM_DAILY_LIMIT),
    historyTurns: Number.isFinite(historyTurns) && historyTurns > 0 ? historyTurns : (defaults.historyTurns || DEFAULT_LLM_HISTORY_TURNS),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : (defaults.timeoutMs || DEFAULT_LLM_TIMEOUT_MS),
    historyTtlSeconds: defaults.historyTtlSeconds || DEFAULT_LLM_HISTORY_TTL_SECONDS,
  };
}

export function chatCompletionsUrl(baseUrl) {
  const base = String(baseUrl || "").trim().replace(/\/+$/u, "");
  if (!base) return "";
  if (/\/chat\/completions$/i.test(base)) return base;
  return `${base}/chat/completions`;
}

export function filterLlmOutput(text) {
  let value = sanitizeRequestText(String(text ?? ""));
  value = stripTrackerTokens(value);
  value = value.replace(/\u8001\u4e09/g, "");
  value = value.replace(/[ \t]{2,}/g, " ").trim();
  return value;
}

export function buildSystemPrompt({ progress = "", notes = "", health = "" } = {}) {
  const progressText = stripTrackerTokens(progress) || "暂无进度摘要";
  const healthText = String(health || "").trim() || "暂无健康检查结果";
  return [
    "你是 DreamUtopia 演示站的飞书助手。只用简体中文回答。",
    "规则：",
    "- 只根据下面提供的网站进度和服务状态说明事实，不要编造数据",
    "- 不要提及 PR 号、issue 号、提交哈希或分支名",
    "- 不要透露密钥、token、邮箱、电话、金额或个人身份",
    "- 不确定就直说不知道，并建议对方回复「进度」「网址」或「健康」",
    "",
    "网站进度",
    progressText,
    "",
    "最近留言",
    notes || "暂无留言",
    "",
    "服务状态",
    healthText,
  ].join("\n");
}

export async function hashChatId(chatId) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`feishu-chat:${chatId}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function historyKvKey(hash) {
  return `llm:history:${hash}`;
}

export function dailyKvKey(hash, day) {
  return `llm:daily:${hash}:${day}`;
}

export function llmDayKey(now = Date.now(), timeZone = "Asia/Taipei") {
  const date = new Date(typeof now === "function" ? now() : now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

async function loadHistory(kv, hash) {
  const raw = await kv.get(historyKvKey(hash));
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
      .map((item) => ({ role: item.role, content: filterLlmOutput(item.content) }))
      .filter((item) => item.content);
  } catch {
    return [];
  }
}

async function saveHistory(kv, hash, messages, { limit, ttlSeconds }) {
  const trimmed = messages
    .filter((item) => item && typeof item.content === "string" && item.content)
    .slice(-Math.max(2, limit));
  await kv.put(historyKvKey(hash), JSON.stringify(trimmed), {
    expirationTtl: Math.max(60, ttlSeconds),
  });
}

async function completeChat({ llm, messages, fetchImpl, timeoutMs }) {
  const url = chatCompletionsUrl(llm.baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: llm.model,
        messages,
        temperature: 0.2,
        max_tokens: 400,
      }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error("LLM HTTP error");
    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("LLM empty");
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function loadSiteContext({ kv, env, fetchImpl, now, config, timeoutMs }) {
  const [progress, comments, health] = await Promise.all([
    fetchProgressSummary({ kv, token: env?.GITHUB_TOKEN, fetchImpl, now, config }).catch(() => PROGRESS_MESSAGE),
    listIssueComments({
      fetchImpl,
      token: env?.GITHUB_TOKEN,
      owner: config.github.owner,
      repo: config.github.repo,
      issueNumber: config.github.progressIssueNumber,
    }).catch(() => []),
    fetchHealthSummary({ fetchImpl, timeoutMs }).catch(() => "健康检查请求失败。"),
  ]);
  return {
    progress: typeof progress === "string" ? progress : "",
    notes: formatPlainNotes(comments, { limit: config.progress?.commentLimit || 5 }),
    health: typeof health === "string" ? health : "",
  };
}

export async function replyWithOptionalLlm({
  kv,
  env = {},
  chatId,
  userText,
  fetchImpl = fetch,
  now = Date.now,
  config = botConfig,
} = {}) {
  const llm = resolveLlmConfig(env, config);
  if (!llm) return HELP_MESSAGE;
  if (!isAllowedRequestChat({ chatId, config, env })) return HELP_MESSAGE;

  try {
    const hash = await hashChatId(chatId);
    const day = llmDayKey(now, config.progress?.timeZone);
    const used = Number.parseInt(await kv.get(dailyKvKey(hash, day)) || "0", 10) || 0;
    if (used >= llm.dailyLimit) return LLM_CAP_MESSAGE;

    const context = await loadSiteContext({
      kv,
      env,
      fetchImpl,
      now,
      config,
      timeoutMs: Math.min(700, llm.timeoutMs),
    });
    const system = buildSystemPrompt(context);
    const history = await loadHistory(kv, hash);
    const user = filterLlmOutput(userText);
    if (!user) return HELP_MESSAGE;

    const messages = [
      { role: "system", content: system },
      ...history,
      { role: "user", content: user },
    ];
    const raw = await completeChat({
      llm,
      messages,
      fetchImpl,
      timeoutMs: llm.timeoutMs,
    });
    const reply = filterLlmOutput(raw);
    if (!reply) return HELP_MESSAGE;

    await kv.put(dailyKvKey(hash, day), String(used + 1), { expirationTtl: 172800 });
    await saveHistory(kv, hash, [...history, { role: "user", content: user }, { role: "assistant", content: reply }], {
      limit: llm.historyTurns,
      ttlSeconds: llm.historyTtlSeconds,
    });
    return reply;
  } catch {
    return HELP_MESSAGE;
  }
}
