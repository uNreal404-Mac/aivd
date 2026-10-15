#!/usr/bin/env node
/**
 * Feishu custom-bot notify unit tests. Mocks fetch. No network, no credentials.
 */
import { createHmac } from "node:crypto";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SITE_URL,
  WEBHOOK_URL_ENV,
  WEBHOOK_SECRET_ENV,
  attachSignature,
  buildAcceptanceCard,
  buildDeployCard,
  buildFeishuSign,
  feishuCode,
  main,
  normalizeStatus,
  notify,
  parseArgs,
  parsePrNumberFromTitle,
  postFeishuWebhook,
  redactSecrets,
  resolveAcceptanceContext,
  resolveDeployContext,
  shortSha,
  stripPrSuffix,
} from "./feishu-notify.mjs";

const fail = [];
const ok = [];

function check(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

const DEMO_TS = "1599360473";
const DEMO_SECRET = "demo";
const DEMO_SIGN = createHmac("sha256", `${DEMO_TS}\n${DEMO_SECRET}`).update("").digest("base64");

function mockFetch(handler) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return handler(url, init, calls);
  };
  return { calls, fetchImpl };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

{
  check(buildFeishuSign(DEMO_TS, DEMO_SECRET) === DEMO_SIGN, "HMAC-SHA256 sign matches timestamp+newline+secret over empty message");
  check(buildFeishuSign(DEMO_TS, DEMO_SECRET) === "l1N0gAcBjdwBvGm1xMjOF0XSyaLRpR7tuO5dHfhAYc8=", "official demo secret/timestamp vector");
  check(shortSha("7edc5db0123abcd") === "7edc5db", "short sha is 7 chars");
  check(parsePrNumberFromTitle("feat: foo (#27)") === 27, "parses squash-merge PR number");
  check(stripPrSuffix("feat: foo (#27)") === "feat: foo", "strips (#N) suffix");
  check(normalizeStatus("通过") === "pass" && normalizeStatus("未通过") === "fail", "Chinese status aliases");
}

{
  const env = { FEISHU_WEBHOOK_URL: "https://open.feishu.cn/open-apis/bot/v2/hook/unit-test-id", FEISHU_WEBHOOK_SECRET: "super-secret" };
  const leaked = `posted ${env.FEISHU_WEBHOOK_URL} secret=${env.FEISHU_WEBHOOK_SECRET}`;
  const redacted = redactSecrets(leaked, env);
  check(!redacted.includes(env.FEISHU_WEBHOOK_URL), "redact removes webhook URL");
  check(!redacted.includes(env.FEISHU_WEBHOOK_SECRET), "redact removes signing secret");
  check(redacted.includes("[redacted]"), "redact uses placeholder");
}

{
  const args = parseArgs(["deploy", "--pr", "27", "--title", "feat: foo", "--sha", "abc1234def", "--link", "https://example.test/p/27"]);
  check(args._[0] === "deploy" && args.pr === "27" && args.title === "feat: foo", "parseArgs reads deploy flags");
  const eq = parseArgs(["acceptance", "--status=pass", "--title=回归"]);
  check(eq.status === "pass" && eq.title === "回归", "parseArgs supports --key=value");
}

{
  const ctx = resolveDeployContext({
    env: { GITHUB_SHA: "7edc5db0123abcd", GITHUB_REPOSITORY: "CharlesHarry7/dreamutopia-clone", GITHUB_SERVER_URL: "https://github.com" },
    event: {
      head_commit: {
        id: "7edc5db0123abcd",
        message: "feat: /business 企业定制询价页（人工交付，先报价） (#27)\n\nmore",
        url: "https://github.com/CharlesHarry7/dreamutopia-clone/commit/7edc5db0123abcd",
      },
    },
  });
  check(ctx.pr === 27, "push event extracts PR number");
  check(ctx.title.includes("企业定制询价页"), "push event keeps PR title");
  check(ctx.sha === "7edc5db", "push event short sha");
  check(ctx.link === "https://github.com/CharlesHarry7/dreamutopia-clone/pull/27", "push event PR link");
  check(ctx.site === SITE_URL, "default production site");
}

{
  const ctx = resolveDeployContext({
    event: {
      action: "closed",
      pull_request: {
        number: 28,
        title: "Add Feishu project bot Worker",
        html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/pull/28",
        merge_commit_sha: "9b83be9aaaaaaaa",
        merged: true,
      },
    },
  });
  check(ctx.pr === 28 && ctx.sha === "9b83be9" && ctx.link.includes("/pull/28"), "merged PR event fills number/title/sha/link");
}

{
  const ctx = resolveDeployContext({ event: { action: "closed", pull_request: { number: 1, merged: false, title: "nope" } } });
  check(ctx.skipped === true, "closed unmerged PR skips");
}

{
  const acc = resolveAcceptanceContext({ title: "主路径回归", status: "fail", summary: "登录失败", link: "https://dreamutopia-clone.pages.dev/api/health" });
  check(acc.status === "fail" && acc.title === "主路径回归", "acceptance context");
  check(resolveAcceptanceContext({ title: "x", pass: true }).status === "pass", "--pass alias");
}

{
  const card = buildDeployCard({
    pr: 27,
    title: "feat: 企业定制询价页",
    sha: "7edc5db",
    link: "https://github.com/CharlesHarry7/dreamutopia-clone/pull/27",
    site: SITE_URL,
  });
  const md = card.card.elements[0].text.content;
  check(card.msg_type === "interactive", "deploy uses interactive card");
  check(card.card.header.title.content === "生产环境已更新", "deploy header is Simplified Chinese");
  check(md.includes("PR #27") && md.includes("feat: 企业定制询价页"), "deploy card has PR number and title");
  check(md.includes("7edc5db"), "deploy card has short sha");
  check(md.includes(SITE_URL) && md.includes("/pull/27"), "deploy card has site and PR links");
  check(JSON.stringify(card).includes("Grok Bot · AI视频项目专属机器人 三儿"), "deploy card footer signs as 三儿");
  check(!JSON.stringify(card).includes("老三"), "deploy card omits 老三");
}

{
  const pass = buildAcceptanceCard({ title: "主路径回归", status: "pass", summary: "健康检查通过", link: `${SITE_URL}/api/health` });
  const failCard = buildAcceptanceCard({ title: "支付回归", status: "fail", summary: "checkout 未开放", link: "" });
  check(pass.card.header.title.content === "验收结果：通过" && pass.card.header.template === "green", "acceptance pass header");
  check(failCard.card.header.title.content === "验收结果：未通过" && failCard.card.header.template === "red", "acceptance fail header");
  check(pass.card.elements[0].text.content.includes("健康检查通过"), "acceptance includes summary");
  check(JSON.stringify(pass).includes("Grok Bot · AI视频项目专属机器人 三儿"), "acceptance card footer signs as 三儿");
  check(!JSON.stringify(failCard).includes("老三"), "acceptance card omits 老三");
}

{
  const signed = attachSignature({ msg_type: "text", content: { text: "x" } }, { secret: DEMO_SECRET, now: () => DEMO_TS });
  check(signed.timestamp === DEMO_TS && signed.sign === DEMO_SIGN, "attachSignature writes timestamp and sign");
  check(signed.msg_type === "text", "signature fields sit alongside payload");
  const unsigned = attachSignature({ msg_type: "text" }, { secret: "" });
  check(unsigned.timestamp === undefined && unsigned.sign === undefined, "no sign when secret unset");
}

{
  const { calls, fetchImpl } = mockFetch(() => jsonResponse({ code: 0, msg: "success", StatusCode: 0 }));
  const env = { [WEBHOOK_URL_ENV]: "https://open.feishu.cn/open-apis/bot/v2/hook/unit-test-id", [WEBHOOK_SECRET_ENV]: DEMO_SECRET };
  const result = await postFeishuWebhook(buildDeployCard({ pr: 1, title: "t", sha: "abcdef1", link: "https://example.test/1" }), {
    env,
    fetchImpl,
    now: () => Number(DEMO_TS),
  });
  check(result.skipped === false && result.body.code === 0, "successful webhook post");
  check(calls.length === 1 && calls[0].init.method === "POST", "POST once");
  check(calls[0].init.headers["content-type"] === "application/json", "JSON content-type");
  const body = JSON.parse(calls[0].init.body);
  check(body.timestamp === DEMO_TS && body.sign === DEMO_SIGN, "signed body uses Feishu custom-bot algorithm");
  check(!JSON.stringify(body).includes(DEMO_SECRET), "request body does not contain signing secret");
}

{
  const { calls, fetchImpl } = mockFetch(() => jsonResponse({ code: 0, msg: "success" }));
  const env = { [WEBHOOK_URL_ENV]: "https://open.feishu.cn/open-apis/bot/v2/hook/unit-test-id" };
  await postFeishuWebhook({ msg_type: "text", content: { text: "hi" } }, { env, fetchImpl });
  const body = JSON.parse(calls[0].init.body);
  check(body.sign === undefined && body.timestamp === undefined, "unsigned when FEISHU_WEBHOOK_SECRET absent");
}

{
  const { calls, fetchImpl } = mockFetch(() => jsonResponse({ code: 0 }));
  const skipped = await notify("deploy", { env: {}, fetchImpl, args: { pr: 1 } });
  check(skipped.skipped === true && calls.length === 0, "missing webhook URL skips without fetch");
  const blank = await notify("deploy", { env: { [WEBHOOK_URL_ENV]: "   " }, fetchImpl });
  check(blank.skipped === true && calls.length === 0, "whitespace webhook URL skips");
}

{
  const { fetchImpl } = mockFetch(() => jsonResponse({ code: 19021, msg: "sign match fail or timestamp is not within one hour from current time" }));
  let threw = "";
  try {
    await postFeishuWebhook({ msg_type: "text", content: { text: "x" } }, {
      env: { [WEBHOOK_URL_ENV]: "https://open.feishu.cn/open-apis/bot/v2/hook/unit-test-id" },
      fetchImpl,
    });
  } catch (error) {
    threw = String(error.message);
  }
  check(threw.includes("19021"), "Feishu sign failure surfaces code");
  check(!threw.includes("unit-test-id"), "error text does not echo webhook path");
}

{
  const { fetchImpl } = mockFetch(() => {
    throw new Error("getaddrinfo https://open.feishu.cn/open-apis/bot/v2/hook/unit-test-id");
  });
  let threw = "";
  try {
    await postFeishuWebhook({ msg_type: "text", content: { text: "x" } }, {
      env: { [WEBHOOK_URL_ENV]: "https://open.feishu.cn/open-apis/bot/v2/hook/unit-test-id" },
      fetchImpl,
    });
  } catch (error) {
    threw = String(error.message);
  }
  check(threw.includes("[redacted]"), "fetch throw redacts webhook URL");
  check(!threw.includes("unit-test-id"), "fetch throw does not leak hook id");
}

{
  const logs = [];
  const { calls, fetchImpl } = mockFetch(() => jsonResponse({ code: 0, msg: "success" }));
  const env = {};
  const result = await main(["deploy", "--pr", "9", "--title", "x"], { env, fetchImpl, log: (msg) => logs.push(String(msg)) });
  check(result.skipped === true && calls.length === 0, "CLI deploy skips without env");
  check(logs.some((line) => line.includes(WEBHOOK_URL_ENV)), "CLI skip names the env var");
  check(logs.every((line) => !/bot\/v2\/hook\//.test(line)), "CLI skip does not print a webhook URL");
}

{
  const logs = [];
  const { calls, fetchImpl } = mockFetch(() => jsonResponse({ StatusCode: 0, StatusMessage: "success" }));
  const env = { [WEBHOOK_URL_ENV]: "https://open.feishu.cn/open-apis/bot/v2/hook/unit-test-id" };
  const result = await main(
    ["acceptance", "--title", "主路径回归", "--status", "pass", "--summary", "健康检查通过", "--link", `${SITE_URL}/api/health`],
    { env, fetchImpl, log: (msg) => logs.push(String(msg)) }
  );
  check(result.skipped === false && feishuCode({ StatusCode: 0 }) === 0, "legacy StatusCode 0 is success");
  const body = JSON.parse(calls[0].init.body);
  check(body.card.header.title.content === "验收结果：通过", "CLI acceptance posts pass card");
  check(logs.join("\n").includes("已发送"), "CLI reports send without secrets");
  check(!logs.join("\n").includes("unit-test-id"), "CLI success log omits webhook URL");
}

{
  let threw = false;
  try {
    await notify("acceptance", { env: { [WEBHOOK_URL_ENV]: "https://open.feishu.cn/open-apis/bot/v2/hook/unit-test-id" }, fetchImpl: async () => jsonResponse({ code: 0 }), args: { title: "x" } });
  } catch {
    threw = true;
  }
  check(threw, "acceptance without status fails the caller (not a silent skip)");
}

{
  const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "feishu-notify.mjs");
  const env = { ...process.env, PATH: process.env.PATH, [WEBHOOK_URL_ENV]: "", [WEBHOOK_SECRET_ENV]: "" };
  const skip = spawnSync(process.execPath, [script, "deploy"], { encoding: "utf8", env, timeout: 10_000 });
  check(skip.status === 0, "real CLI exits 0 when webhook URL is unset");
  check(String(skip.stdout).includes("未配置 FEISHU_WEBHOOK_URL"), "real CLI prints skip reason");
  check(!String(skip.stdout + skip.stderr).includes("bot/v2/hook"), "real CLI skip does not print webhook URLs");
  const help = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8", env, timeout: 10_000 });
  check(help.status === 0 && String(help.stdout).includes("FEISHU_WEBHOOK_URL"), "real CLI --help exits 0");
}

if (fail.length) {
  for (const item of fail) console.log("FAIL", item);
  process.exit(1);
}
for (const item of ok) console.log("ok ", item);
console.log(`\nfeishu-notify checks passed (${ok.length})`);
