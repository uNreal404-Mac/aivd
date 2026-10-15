import { HELP_MESSAGE } from "./commands.mjs";
import { botConfig, isAllowedRequestChat, signOutboundText } from "./config.mjs";
import { getTenantAccessToken, replyToMessage, replyUuid, sendTextToChat } from "./feishu-api.mjs";
import { createIssue, verifyGitHubSignature } from "./github.mjs";

export const ISSUE_MAP_PREFIX = "github:issue-map:";
export const REQUEST_ISSUE_PREFIX = "feishu:request-issue:";
const DELIVERY_PREFIX = "github:delivery:";
const CLOSED_PREFIX = "github:closed-notified:";
const decoder = new TextDecoder("utf-8", { fatal: true });

function headerValue(headers, name) {
  if (headers && typeof headers.get === "function") return headers.get(name);
  const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry?.[1] ?? null;
}

function issueUrl(number) {
  return `https://github.com/${botConfig.github.owner}/${botConfig.github.repo}/issues/${number}`;
}

function statusError(message, status) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function parseRequestBody(text) {
  const normalized = typeof text === "string" ? text.normalize("NFKC").trim() : "";
  const match = normalized.match(/^需求[：:]\s*([\s\S]*)$/u);
  if (!match) return null;
  return match[1].trim();
}

export function sanitizeRequestText(text) {
  let value = String(text ?? "");
  value = value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[已脱敏-邮箱]");
  value = value.replace(/(?:\+?86[-\s]*)?1[3-9]\d(?:[-\s]?\d){8}\b/g, "[已脱敏-电话]");
  value = value.replace(/(?:[¥￥$€£]|RMB|CNY|USD)\s*[\d,]+(?:\.\d{1,2})?/gi, "[已脱敏-金额]");
  value = value.replace(/[\d,]+(?:\.\d{1,2})?\s*(?:万元|块钱|人民币|元|块)/g, "[已脱敏-金额]");
  return value;
}

export function buildIssueContent({ body } = {}) {
  const sanitized = sanitizeRequestText(body).trim();
  const titleSource = sanitized.split(/\n/, 1)[0].trim() || "未填写具体内容";
  const title = `飞书需求：${titleSource}`.slice(0, 70);
  const markdown = [
    "## 需求",
    sanitized || "（未填写具体内容）",
    "",
    "---",
    "此 issue 由飞书机器人自动创建。关闭后会通知原飞书会话。提出人与会话映射只保存在 Workers KV，不写入公开 issue。",
  ].join("\n");
  return {
    title,
    body: markdown,
    labels: [botConfig.github.requestLabel],
  };
}

function signedReply(text, config = botConfig) {
  return signOutboundText(text, config);
}

export async function handleFeishuRequest({
  kv,
  env,
  selected,
  context,
  fetchImpl = fetch,
  config = botConfig,
} = {}) {
  const body = parseRequestBody(selected?.text ?? "");
  if (body === null) return signedReply(HELP_MESSAGE, config);
  if (!body) return signedReply("请在「需求：」后面写具体内容，例如「需求：落地页要加中文」。", config);
  if (!isAllowedRequestChat({ chatId: context?.chatId, config, env })) {
    return signedReply("当前会话未授权提交需求，请联系项目负责人。", config);
  }

  const messageId = selected.messageId;
  const existingNumber = await kv.get(`${REQUEST_ISSUE_PREFIX}${messageId}`);
  if (existingNumber) {
    const mapping = await kv.get(`${ISSUE_MAP_PREFIX}${existingNumber}`);
    let htmlUrl = issueUrl(existingNumber);
    if (typeof mapping === "string" && mapping) {
      try {
        const parsed = JSON.parse(mapping);
        if (typeof parsed?.htmlUrl === "string" && parsed.htmlUrl) htmlUrl = parsed.htmlUrl;
      } catch {
        // Keep the constructed URL when a mapping blob is malformed.
      }
    }
    return signedReply(`已登记过该需求：${htmlUrl}`, config);
  }

  const senderKey = context?.senderOpenId || context?.chatId || "unknown";
  const rateKey = `rl:request:${senderKey}`;
  if (await kv.get(rateKey)) return signedReply("提交太频繁，请稍后再试。", config);

  if (typeof env?.GITHUB_TOKEN !== "string" || !env.GITHUB_TOKEN) {
    return signedReply("GitHub 尚未配置，无法创建需求工单。请联系项目负责人。", config);
  }

  const content = buildIssueContent({ body });
  const created = await createIssue({
    token: env.GITHUB_TOKEN,
    title: content.title,
    body: content.body,
    labels: content.labels,
    fetchImpl,
  });

  const mapping = {
    chatId: context?.chatId || "",
    messageId,
    requester: context?.senderName || context?.senderOpenId || "",
    htmlUrl: created.html_url,
  };
  await kv.put(`${ISSUE_MAP_PREFIX}${created.number}`, JSON.stringify(mapping));
  await kv.put(`${REQUEST_ISSUE_PREFIX}${messageId}`, String(created.number), { expirationTtl: 604800 });
  await kv.put(rateKey, "1", { expirationTtl: Math.max(60, config.request.rateLimitSeconds) });
  return signedReply(`已帮你登记需求：${created.html_url}`, config);
}

async function notifyIssueClosed({ kv, env, fetchImpl, now, issue }) {
  const mappingValue = await kv.get(`${ISSUE_MAP_PREFIX}${issue.number}`);
  if (typeof mappingValue !== "string" || !mappingValue) return false;

  let mapping;
  try {
    mapping = JSON.parse(mappingValue);
  } catch {
    return false;
  }

  const closedAt = typeof issue.closed_at === "string" && issue.closed_at ? issue.closed_at : "closed";
  const notifiedKey = `${CLOSED_PREFIX}${issue.number}:${closedAt}`;
  if (await kv.get(notifiedKey)) return false;

  const htmlUrl = typeof issue.html_url === "string" && issue.html_url
    ? issue.html_url
    : (mapping.htmlUrl || issueUrl(issue.number));
  const title = typeof issue.title === "string" && issue.title ? issue.title : `GitHub #${issue.number}`;
  const text = signOutboundText(`你提交的需求已完成：GitHub #${issue.number}「${title}」已关闭。\n${htmlUrl}`);
  const uuid = await replyUuid(`closed:${issue.number}:${closedAt}`);
  const token = await getTenantAccessToken({
    kv,
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
    fetchImpl,
    now,
  });

  try {
    if (mapping.messageId) {
      await replyToMessage({ token, messageId: mapping.messageId, text, fetchImpl, uuid });
    } else if (mapping.chatId) {
      await sendTextToChat({ token, chatId: mapping.chatId, text, fetchImpl, uuid });
    } else {
      return false;
    }
  } catch (error) {
    if (mapping.chatId && mapping.messageId) {
      await sendTextToChat({ token, chatId: mapping.chatId, text, fetchImpl, uuid });
    } else {
      throw error;
    }
  }

  await kv.put(notifiedKey, "1");
  return true;
}

export async function handleGithubWebhook({
  rawBody,
  headers,
  kv,
  env,
  fetchImpl = fetch,
  now = Date.now,
} = {}) {
  const secret = env?.GITHUB_WEBHOOK_SECRET;
  if (typeof secret !== "string" || !secret) statusError("GitHub webhook is not configured", 503);

  const signature = headerValue(headers, "X-Hub-Signature-256");
  const valid = await verifyGitHubSignature(rawBody, signature, secret);
  if (!valid) statusError("Invalid GitHub webhook signature", 401);

  const eventName = headerValue(headers, "X-GitHub-Event") || "";
  const deliveryId = headerValue(headers, "X-GitHub-Delivery") || "";
  if (eventName === "ping") return { status: 200, body: "pong" };
  if (eventName !== "issues") return { status: 200, body: "ok" };

  if (deliveryId && await kv.get(`${DELIVERY_PREFIX}${deliveryId}`)) {
    return { status: 200, body: "ok" };
  }

  let payload;
  try {
    payload = JSON.parse(decoder.decode(rawBody instanceof Uint8Array ? rawBody : new Uint8Array(rawBody)));
  } catch {
    statusError("Invalid GitHub webhook payload", 400);
  }

  if (payload?.action === "closed" && Number.isFinite(payload?.issue?.number)) {
    await notifyIssueClosed({ kv, env, fetchImpl, now, issue: payload.issue });
  }

  if (deliveryId) {
    await kv.put(`${DELIVERY_PREFIX}${deliveryId}`, "1", { expirationTtl: 604800 });
  }
  return { status: 200, body: "ok" };
}
