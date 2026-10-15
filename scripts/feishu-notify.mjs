#!/usr/bin/env node
/**
 * Outbound Feishu / Lark custom-bot (群自定义机器人) webhook helper.
 * Sends deploy or acceptance cards. Credentials come only from env.
 *
 *   FEISHU_WEBHOOK_URL      required to send; if unset the process exits 0
 *   FEISHU_WEBHOOK_SECRET   optional custom-bot 签名校验 secret
 *
 *   node scripts/feishu-notify.mjs deploy --pr 27 --title "feat: foo" --sha 7edc5db --link https://github.com/org/repo/pull/27
 *   node scripts/feishu-notify.mjs acceptance --title "主路径回归" --status pass --summary "健康检查通过" --link https://dreamutopia-clone.pages.dev/api/health
 */
import { createHmac } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const SITE_URL = "https://dreamutopia-clone.pages.dev";
export const WEBHOOK_URL_ENV = "FEISHU_WEBHOOK_URL";
export const WEBHOOK_SECRET_ENV = "FEISHU_WEBHOOK_SECRET";

const SECRET_ENV_KEYS = [WEBHOOK_URL_ENV, WEBHOOK_SECRET_ENV];

export function buildFeishuSign(timestamp, secret) {
  const stringToSign = `${timestamp}\n${secret}`;
  return createHmac("sha256", stringToSign).update("").digest("base64");
}

export function shortSha(sha) {
  const value = String(sha || "").trim();
  return value ? value.slice(0, 7) : "";
}

export function firstLine(text) {
  return String(text || "").split(/\r?\n/, 1)[0].trim();
}

export function parsePrNumberFromTitle(title) {
  const match = String(title || "").match(/\(#(\d+)\)\s*$/);
  return match ? Number(match[1]) : null;
}

export function stripPrSuffix(title) {
  return String(title || "").replace(/\s*\(#\d+\)\s*$/, "").trim();
}

export function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (["pass", "passed", "ok", "success", "true", "1", "通过", "成功"].includes(raw)) return "pass";
  if (["fail", "failed", "failure", "error", "false", "0", "未通过", "失败"].includes(raw)) return "fail";
  return "";
}

export function redactSecrets(text, env = process.env) {
  let out = String(text ?? "");
  for (const key of SECRET_ENV_KEYS) {
    const value = env?.[key];
    if (typeof value === "string" && value.length > 0) {
      out = out.split(value).join("[redacted]");
    }
  }
  return out;
}

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--") {
      args._.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith("--")) {
      const eq = token.indexOf("=");
      if (eq >= 0) {
        args[token.slice(2, eq)] = token.slice(eq + 1);
        continue;
      }
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        args[key] = true;
      } else {
        args[key] = next;
        i += 1;
      }
      continue;
    }
    args._.push(token);
  }
  return args;
}

function readGithubEvent(env, event) {
  if (event && typeof event === "object") return event;
  const eventPath = env?.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  try {
    return JSON.parse(fs.readFileSync(eventPath, "utf8"));
  } catch {
    return null;
  }
}

export function resolveDeployContext({ env = process.env, args = {}, event = undefined } = {}) {
  const githubEvent = readGithubEvent(env, event);
  if (githubEvent?.pull_request && githubEvent.action === "closed" && githubEvent.pull_request.merged !== true) {
    return { skipped: true, reason: "PR 已关闭但未合并，跳过通知" };
  }

  const repo = env.GITHUB_REPOSITORY || "";
  const server = env.GITHUB_SERVER_URL || "https://github.com";
  let sha = args.sha || env.GITHUB_SHA || githubEvent?.pull_request?.merge_commit_sha || githubEvent?.after || "";
  let pr = args.pr != null && args.pr !== true ? args.pr : null;
  let title = args.title && args.title !== true ? String(args.title) : "";
  let link = args.link && args.link !== true ? String(args.link) : "";

  if (githubEvent?.pull_request) {
    pr = pr ?? githubEvent.pull_request.number ?? null;
    title = title || githubEvent.pull_request.title || "";
    link = link || githubEvent.pull_request.html_url || "";
    sha = sha || githubEvent.pull_request.merge_commit_sha || "";
  } else if (githubEvent?.head_commit) {
    const headline = firstLine(githubEvent.head_commit.message);
    pr = pr ?? parsePrNumberFromTitle(headline);
    title = title || stripPrSuffix(headline);
    link = link || (pr && repo ? `${server}/${repo}/pull/${pr}` : githubEvent.head_commit.url || "");
    sha = sha || githubEvent.head_commit.id || "";
  }

  if (!title) title = firstLine(githubEvent?.head_commit?.message) || "";
  if (pr == null) pr = parsePrNumberFromTitle(title);
  title = stripPrSuffix(title);
  if (!link) {
    if (pr && repo) link = `${server}/${repo}/pull/${pr}`;
    else if (sha && repo) link = `${server}/${repo}/commit/${sha}`;
  }

  return {
    skipped: false,
    pr: pr == null || pr === "" ? null : Number(pr) || pr,
    title,
    sha: shortSha(sha),
    fullSha: String(sha || ""),
    link,
    site: (args.site && args.site !== true ? String(args.site) : SITE_URL),
  };
}

export function resolveAcceptanceContext(args = {}) {
  const title = args.title && args.title !== true ? String(args.title).trim() : "";
  const summary = args.summary && args.summary !== true ? String(args.summary).trim() : "";
  const link = args.link && args.link !== true ? String(args.link).trim() : "";
  const status = normalizeStatus(args.status === true ? "" : args.status) || (args.pass === true || args.ok === true ? "pass" : args.fail === true ? "fail" : "");
  return { title, summary, link, status };
}

function mdLink(label, url) {
  if (!url) return label;
  return `[${label}](${url})`;
}

export function buildDeployCard(ctx) {
  const lines = [];
  if (ctx.pr != null && ctx.title) lines.push(`**PR #${ctx.pr}** ${ctx.title}`);
  else if (ctx.pr != null) lines.push(`**PR #${ctx.pr}**`);
  else if (ctx.title) lines.push(`**提交** ${ctx.title}`);
  if (ctx.sha) lines.push(`合并提交 \`${ctx.sha}\``);
  lines.push(`生产站 ${mdLink("dreamutopia-clone.pages.dev", ctx.site || SITE_URL)}`);
  if (ctx.link) lines.push(`详情 ${mdLink(ctx.link, ctx.link)}`);

  const elements = [
    {
      tag: "div",
      text: { tag: "lark_md", content: lines.join("\n") },
    },
  ];
  if (ctx.link) {
    elements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          text: { tag: "plain_text", content: "查看变更" },
          type: "primary",
          url: ctx.link,
        },
      ],
    });
  }

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: "green",
        title: { tag: "plain_text", content: "生产环境已更新" },
      },
      elements,
    },
  };
}

export function buildAcceptanceCard(ctx) {
  const passed = ctx.status === "pass";
  const result = passed ? "通过" : "未通过";
  const lines = [];
  if (ctx.title) lines.push(`**${ctx.title}**`);
  lines.push(`结果：${result}`);
  if (ctx.summary) lines.push(ctx.summary);
  if (ctx.link) lines.push(`详情 ${mdLink(ctx.link, ctx.link)}`);

  const elements = [
    {
      tag: "div",
      text: { tag: "lark_md", content: lines.join("\n") || `验收结果：${result}` },
    },
  ];
  if (ctx.link) {
    elements.push({
      tag: "action",
      actions: [
        {
          tag: "button",
          text: { tag: "plain_text", content: "查看详情" },
          type: passed ? "primary" : "danger",
          url: ctx.link,
        },
      ],
    });
  }

  return {
    msg_type: "interactive",
    card: {
      config: { wide_screen_mode: true },
      header: {
        template: passed ? "green" : "red",
        title: { tag: "plain_text", content: `验收结果：${result}` },
      },
      elements,
    },
  };
}

export function attachSignature(payload, { secret, now } = {}) {
  if (!secret) return { ...payload };
  const timestamp = String(typeof now === "function" ? now() : now ?? Math.floor(Date.now() / 1000));
  return {
    timestamp,
    sign: buildFeishuSign(timestamp, secret),
    ...payload,
  };
}

function webhookUrlFromEnv(env) {
  const value = env?.[WEBHOOK_URL_ENV];
  return typeof value === "string" ? value.trim() : "";
}

function webhookSecretFromEnv(env) {
  const value = env?.[WEBHOOK_SECRET_ENV];
  return typeof value === "string" ? value.trim() : "";
}

export function feishuCode(body) {
  if (!body || typeof body !== "object") return undefined;
  if (typeof body.code === "number") return body.code;
  if (typeof body.StatusCode === "number") return body.StatusCode;
  return undefined;
}

export async function postFeishuWebhook(payload, { env = process.env, fetchImpl = globalThis.fetch, now } = {}) {
  const url = webhookUrlFromEnv(env);
  if (!url) {
    return { skipped: true, reason: `未配置 ${WEBHOOK_URL_ENV}，跳过飞书通知` };
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available");
  }

  const secret = webhookSecretFromEnv(env);
  const body = attachSignature(payload, { secret, now });
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(redactSecrets(error?.message || error, env));
  }

  const text = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = null;
  }
  const code = feishuCode(parsed);
  if (!response.ok || (code !== undefined && code !== 0)) {
    const detail = parsed?.msg || parsed?.StatusMessage || text.slice(0, 200);
    throw new Error(redactSecrets(`飞书通知失败：HTTP ${response.status} code=${code ?? "n/a"} ${detail}`, env));
  }
  return { skipped: false, status: response.status, body: parsed };
}

export async function notify(kind, options = {}) {
  const env = options.env || process.env;
  const args = options.args || {};
  const event = options.event;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const now = options.now;

  if (!webhookUrlFromEnv(env)) {
    return { skipped: true, reason: `未配置 ${WEBHOOK_URL_ENV}，跳过飞书通知` };
  }

  if (kind === "deploy") {
    const ctx = resolveDeployContext({ env, args, event });
    if (ctx.skipped) return ctx;
    const payload = buildDeployCard(ctx);
    const result = await postFeishuWebhook(payload, { env, fetchImpl, now });
    return { ...result, kind, ctx };
  }

  if (kind === "acceptance") {
    const ctx = resolveAcceptanceContext(args);
    if (!ctx.title) throw new Error("acceptance 需要 --title");
    if (!ctx.status) throw new Error("acceptance 需要 --status pass|fail");
    const payload = buildAcceptanceCard(ctx);
    const result = await postFeishuWebhook(payload, { env, fetchImpl, now });
    return { ...result, kind, ctx };
  }

  throw new Error(`未知通知类型：${kind}（应为 deploy 或 acceptance）`);
}

export function usage() {
  return `用法:
  node scripts/feishu-notify.mjs deploy [--pr N] [--title 标题] [--sha sha] [--link URL]
  node scripts/feishu-notify.mjs acceptance --title 标题 --status pass|fail [--summary 摘要] [--link URL]

凭据只从环境变量读取：${WEBHOOK_URL_ENV}（必填才能发送）、${WEBHOOK_SECRET_ENV}（可选签名）。
未设置 ${WEBHOOK_URL_ENV} 时以成功状态跳过，不发送请求。`;
}

async function main(argv = process.argv.slice(2), runtime = {}) {
  const log = runtime.log || console.log;
  const args = parseArgs(argv);
  if (args.help === true || args.h === true) {
    log(usage());
    return { skipped: true, reason: "help" };
  }
  const kind = String(args._[0] || "").trim();
  if (!kind) {
    log(usage());
    return { skipped: true, reason: "help" };
  }
  const result = await notify(kind, {
    args,
    env: runtime.env || process.env,
    fetchImpl: runtime.fetchImpl,
    event: runtime.event,
    now: runtime.now,
  });
  if (result.skipped) {
    log(result.reason || "已跳过飞书通知");
    return result;
  }
  log(kind === "acceptance" ? "飞书验收通知已发送" : "飞书生产更新通知已发送");
  return result;
}

const executedDirectly =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (executedDirectly) {
  main().catch((error) => {
    console.error(redactSecrets(error?.message || error, process.env));
    process.exit(1);
  });
}

export { main };
