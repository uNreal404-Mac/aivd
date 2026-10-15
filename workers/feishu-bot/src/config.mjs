/**
 * Copy-this-file configuration for a role bot.
 * New bots should duplicate `workers/feishu-bot/`, rename the Worker, and edit this object.
 */
export const DEFAULT_SIGNATURE = "Grok Bot · AI视频项目专属机器人 三儿";

export const botConfig = {
  name: "feishu-bot",
  signature: DEFAULT_SIGNATURE,
  siteUrl: "https://dreamutopia-clone.pages.dev",
  healthUrl: "https://dreamutopia-clone.pages.dev/api/health",
  // Fail-closed for 需求 and optional LLM chat: empty means no chat may use those.
  // Operator must set the partner Feishu group chat_id after merge (config or ALLOWED_CHAT_IDS).
  allowedChatIds: [],
  github: {
    apiBase: "https://api.github.com",
    owner: "CharlesHarry7",
    repo: "dreamutopia-clone",
    progressIssueNumber: 20,
    requestLabel: "feishu-request",
    userAgent: "dreamutopia-feishu-bot",
  },
  progress: {
    commentLimit: 5,
    cacheTtlSeconds: 300,
    timeZone: "Asia/Taipei",
  },
  request: {
    rateLimitSeconds: 60,
  },
  llm: {
    historyTurns: 6,
    historyTtlSeconds: 86400,
    dailyLimit: 200,
    timeoutMs: 9000,
  },
  commands: [
    {
      name: "request",
      match: "prefix",
      prefixes: ["需求：", "需求:"],
      source: "github-create-issue",
      formatter: "issueCreatedReply",
    },
    {
      name: "progress",
      match: "pattern",
      pattern: "进度",
      source: "github-website-progress",
      formatter: "websiteProgress",
    },
    {
      name: "url",
      match: "pattern",
      pattern: "网址",
      source: "static",
      formatter: "static",
    },
    {
      name: "health",
      match: "pattern",
      pattern: "健康",
      source: "health-http",
      formatter: "healthSummary",
    },
  ],
};

export function resolveSignature(config = botConfig) {
  const value = typeof config?.signature === "string" ? config.signature.trim() : "";
  return value || DEFAULT_SIGNATURE;
}

export function signOutboundText(text, config = botConfig) {
  const signature = resolveSignature(config);
  const body = String(text ?? "").replace(/\s+$/u, "");
  if (!body) return signature;
  if (body.includes(signature)) return body;
  return `${body}\n\n${signature}`;
}

export function resolveAllowedChatIds({ config = botConfig, env = {} } = {}) {
  const fromEnv = String(env?.ALLOWED_CHAT_IDS ?? "")
    .split(/[,;\s]+/u)
    .map((id) => id.trim())
    .filter(Boolean);
  const fromConfig = Array.isArray(config?.allowedChatIds)
    ? config.allowedChatIds.map((id) => String(id).trim()).filter(Boolean)
    : [];
  return [...new Set([...fromConfig, ...fromEnv])];
}

export function isAllowedRequestChat({ chatId, config = botConfig, env = {} } = {}) {
  const allowed = resolveAllowedChatIds({ config, env });
  if (allowed.length === 0) return false;
  return typeof chatId === "string" && chatId.length > 0 && allowed.includes(chatId);
}
