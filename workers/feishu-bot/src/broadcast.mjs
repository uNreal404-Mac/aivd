import { resolveAllowedChatIds, signOutboundText } from "./config.mjs";
import { getTenantAccessToken, replyUuid, sendTextToChat } from "./feishu-api.mjs";

export const BROADCAST_PREFIX = "github:broadcast:";
export const BROADCAST_TTL_SECONDS = 2592000;
const MAX_COMMITS = 3;
const MAX_TITLE_LENGTH = 80;
const ZERO_SHA_PATTERN = /^0+$/;
const HEX_SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

function firstLine(value) {
  const text = typeof value === "string" ? value : "";
  return text.split("\n")[0].trim().slice(0, MAX_TITLE_LENGTH);
}

function shortSha(value) {
  return typeof value === "string" && value ? value.slice(0, 7) : "";
}

// Public broadcast text must never mention anyone: drop at-tags and the "@" character.
function stripMentions(text) {
  return String(text ?? "").replace(/<\/?at[^>]*>/gi, "").replace(/@/g, "");
}

function broadcastMessage(fullName, dedupeKey, lines) {
  return {
    dedupeKey: `${BROADCAST_PREFIX}${fullName.toLowerCase()}:${dedupeKey}`,
    text: stripMentions(lines.join("\n")),
  };
}

export function buildPushBroadcast(payload) {
  if (!payload || payload.ref !== "refs/heads/main") return null;
  const fullName = payload.repository?.full_name;
  if (typeof fullName !== "string" || !fullName) return null;

  const sha = payload.after || payload.head_commit?.id;
  if (typeof sha !== "string" || !sha || ZERO_SHA_PATTERN.test(sha)) return null;

  const allCommits = Array.isArray(payload.commits) ? payload.commits : [];
  const commits = allCommits.slice(0, MAX_COMMITS);
  const lines = [`仓库 ${fullName} 的 main 分支有新提交（${shortSha(sha)}）：`];
  commits.forEach((commit, index) => {
    const url = typeof commit?.url === "string" ? commit.url : "";
    lines.push(`${index + 1}. ${firstLine(commit?.message)} ${url}`.trimEnd());
  });
  if (allCommits.length > MAX_COMMITS) {
    lines.push(`……另有 ${allCommits.length - MAX_COMMITS} 条提交`);
  }
  if (typeof payload.compare === "string" && payload.compare) lines.push(payload.compare);

  return broadcastMessage(fullName, sha, lines);
}

export function buildReleaseBroadcast(payload) {
  if (!payload || payload.action !== "published") return null;
  const release = payload.release;
  if (!release || typeof release !== "object") return null;
  const fullName = payload.repository?.full_name;
  if (typeof fullName !== "string" || !fullName) return null;

  const tag = typeof release.tag_name === "string" ? release.tag_name : "";
  const name = (typeof release.name === "string" && release.name) || tag;
  const commitish = typeof release.target_commitish === "string" ? release.target_commitish : "";
  const sha = HEX_SHA_PATTERN.test(commitish) ? shortSha(commitish) : "";
  const htmlUrl = typeof release.html_url === "string" ? release.html_url : "";

  const lines = [
    `仓库 ${fullName} 发布了新版本 ${name}（${tag}${sha ? `，提交 ${sha}` : ""}）：`,
    htmlUrl,
  ];
  const id = release.id ?? release.tag_name ?? tag;
  return broadcastMessage(fullName, `release:${id}`, lines);
}

export async function broadcastToChats({ kv, env, fetchImpl = fetch, now = Date.now, message } = {}) {
  if (!message || typeof message.dedupeKey !== "string" || !message.dedupeKey) {
    return { sent: 0, skipped: "invalid" };
  }
  if (await kv.get(message.dedupeKey)) return { sent: 0, skipped: "duplicate" };

  const chatIds = resolveAllowedChatIds({ env });
  if (chatIds.length === 0) return { sent: 0, skipped: "no-chats" };

  const token = await getTenantAccessToken({
    kv,
    appId: env?.FEISHU_APP_ID,
    appSecret: env?.FEISHU_APP_SECRET,
    fetchImpl,
    now,
  });
  const text = signOutboundText(message.text);

  let sent = 0;
  for (const chatId of chatIds) {
    const uuid = await replyUuid(`${message.dedupeKey}:${chatId}`);
    await sendTextToChat({ token, chatId, text, fetchImpl, uuid });
    sent += 1;
  }
  if (sent > 0) {
    await kv.put(message.dedupeKey, "1", { expirationTtl: BROADCAST_TTL_SECONDS });
  }
  return { sent };
}
