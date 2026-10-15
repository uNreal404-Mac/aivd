import { botConfig } from "./config.mjs";
import { chatCompletionsUrl, filterLlmOutput, resolveLlmConfig } from "./llm.mjs";
import { getTenantAccessToken, sendTextToChat } from "./feishu-api.mjs";
import { sanitizeRequestText } from "./privacy.mjs";
import { stripTrackerTokens } from "./site-progress.mjs";

export const HIGGSFIELD_REPOSITORY = "CharlesHarry7/higgsfield-1";
export const HIGGSFIELD_LAST_SHA_KEY = "cron:higgsfield-1:last-seen-sha";
export const PROGRESS_CHAT_NAME = "AI视频网站项目群";
export const CRON_SCHEDULE = "0 */3 * * *";

const GITHUB_API = "https://api.github.com";
const encoder = new TextEncoder();

function githubHeaders() {
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": botConfig.github.userAgent,
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function readGithubJson(response) {
  if (!response.ok) throw new Error("GitHub cron request failed");
  let payload;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new Error("GitHub cron response was invalid", { cause });
  }
  return payload;
}

export async function getLatestHiggsfieldCommit({ fetchImpl = fetch } = {}) {
  const response = await fetchImpl(
    `${GITHUB_API}/repos/${HIGGSFIELD_REPOSITORY}/commits?per_page=1`,
    { method: "GET", headers: githubHeaders(), redirect: "error" },
  );
  const payload = await readGithubJson(response);
  const commit = Array.isArray(payload) ? payload[0] : null;
  if (typeof commit?.sha !== "string" || !/^[0-9a-f]{7,40}$/iu.test(commit.sha)) {
    throw new Error("GitHub cron commit response was invalid");
  }
  return {
    sha: commit.sha,
    message: typeof commit.commit?.message === "string" ? commit.commit.message : "",
  };
}

function commitCategory(commitMessage) {
  const message = String(commitMessage ?? "").toLowerCase();
  if (/(?:video|model|camera|cinematic|image|generation|workflow|视频|模型|镜头|生成)/u.test(message)) {
    return "视频功能或模型相关内容有更新";
  }
  if (/(?:readme|docs?|guide|example|说明|文档|示例)/u.test(message)) {
    return "视频站文档和说明有更新";
  }
  if (/(?:test|ci|build|deploy|release|workflow|测试|部署|发布)/u.test(message)) {
    return "自动化测试或部署相关内容有更新";
  }
  return "视频站有新改动，正在整理具体变化";
}

export function buildCronProgressMessage({ commitMessage = "" } = {}) {
  const category = stripTrackerTokens(sanitizeRequestText(commitCategory(commitMessage)));
  return [
    "视频站有新改动：公开仓库刚更新。",
    `${category}。`,
    "以上是视频站仓库的新进展摘要。",
  ].join("\n");
}

function cronLlmEnabled(env) {
  return String(env?.CRON_LLM_REWRITE ?? "").trim().toLowerCase() === "true";
}

async function rewriteWithDeepSeek({ text, env, config, fetchImpl }) {
  if (!cronLlmEnabled(env)) return text;
  const llm = resolveLlmConfig(env, config);
  if (!llm || !/(?:deepseek|deepseek-chat)/iu.test(`${llm.baseUrl} ${llm.model}`)) return text;

  const controller = new AbortController();
  const timeoutMs = Math.min(2000, llm.timeoutMs);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(chatCompletionsUrl(llm.baseUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0.2,
        max_tokens: 180,
        messages: [
          {
            role: "system",
            content: "只把给定内容改写成一到两句简体中文项目进度。不要编造，不要提及 PR、issue、commit、SHA、分支、密钥或个人信息。",
          },
          { role: "user", content: text },
        ],
      }),
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) return text;
    const payload = await response.json();
    const rewritten = filterLlmOutput(payload?.choices?.[0]?.message?.content);
    return rewritten || text;
  } catch {
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function progressChatId(env) {
  const value = String(env?.FEISHU_PROGRESS_CHAT_ID ?? "").trim();
  if (!value) {
    throw new Error(`Feishu progress chat is not configured for ${PROGRESS_CHAT_NAME}`);
  }
  return value;
}

export async function runHiggsfieldCron({
  kv,
  env = {},
  fetchImpl = fetch,
  config = botConfig,
} = {}) {
  if (!kv || typeof kv.get !== "function" || typeof kv.put !== "function") {
    throw new TypeError("BOT_KV is required for the scheduled check");
  }

  const latest = await getLatestHiggsfieldCommit({ fetchImpl });
  const previousSha = await kv.get(HIGGSFIELD_LAST_SHA_KEY);
  if (!previousSha) {
    await kv.put(HIGGSFIELD_LAST_SHA_KEY, latest.sha);
    return { status: "baseline", repository: HIGGSFIELD_REPOSITORY, sha: latest.sha };
  }
  if (previousSha === latest.sha) {
    return { status: "unchanged", repository: HIGGSFIELD_REPOSITORY, sha: latest.sha };
  }

  const text = await rewriteWithDeepSeek({
    text: buildCronProgressMessage({ commitMessage: latest.message }),
    env,
    config,
    fetchImpl,
  });
  const chatId = progressChatId(env);
  const token = await getTenantAccessToken({
    kv,
    appId: env.FEISHU_APP_ID,
    appSecret: env.FEISHU_APP_SECRET,
    fetchImpl,
  });
  await sendTextToChat({
    token,
    chatId,
    text,
    fetchImpl,
    config,
    uuid: await stableCronUuid(latest.sha),
  });
  await kv.put(HIGGSFIELD_LAST_SHA_KEY, latest.sha);
  return { status: "notified", repository: HIGGSFIELD_REPOSITORY, sha: latest.sha };
}

async function stableCronUuid(sha) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(`higgsfield-cron:${sha}`)));
  digest[6] = (digest[6] & 0x0f) | 0x40;
  digest[8] = (digest[8] & 0x3f) | 0x80;
  const hex = Array.from(digest.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
