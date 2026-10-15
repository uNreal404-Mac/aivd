import assert from "node:assert/strict";
import test from "node:test";
import {
  HIGGSFIELD_LAST_SHA_KEY,
  HIGGSFIELD_REPOSITORY,
  buildCronProgressMessage,
  runHiggsfieldCron,
} from "../src/cron.mjs";
import { createWorker } from "../src/worker.mjs";

function fakeKv(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    async get(key) { return values.get(key) ?? null; },
    async put(key, value, options) {
      values.set(key, String(value));
      return options;
    },
  };
}

function makeEnv(kv, overrides = {}) {
  return {
    BOT_KV: kv,
    FEISHU_APP_ID: "test-app-id",
    FEISHU_APP_SECRET: "test-app-secret",
    FEISHU_PROGRESS_CHAT_ID: "oc_ai_video_group",
    ...overrides,
  };
}

function makeFetch({ sha, message = "docs: improve video workflow", sent = [], llmReplies = [] } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    calls.push({ url: href, init });
    if (href.includes(`/repos/${HIGGSFIELD_REPOSITORY}/commits`)) {
      return Response.json([{ sha, commit: { message } }]);
    }
    if (href.endsWith("/auth/v3/tenant_access_token/internal")) {
      return Response.json({ code: 0, tenant_access_token: "tenant-test-token", expire: 7200 });
    }
    if (href.includes("/im/v1/messages?receive_id_type=chat_id")) {
      if (init.failSend) return Response.json({ code: 999 }, { status: 200 });
      sent.push(JSON.parse(init.body));
      return Response.json({ code: 0, data: { message_id: "om_cron_reply" } });
    }
    if (href.includes("api.deepseek.com") && href.endsWith("/chat/completions")) {
      return Response.json({ choices: [{ message: { content: llmReplies.shift() } }] });
    }
    throw new Error(`unexpected mocked URL: ${href}`);
  };
  return { calls, fetchImpl };
}

test("first cron run records a baseline without posting an update", async () => {
  const kv = fakeKv();
  const { fetchImpl } = makeFetch({ sha: "a".repeat(40) });

  const result = await runHiggsfieldCron({ kv, env: makeEnv(kv), fetchImpl });

  assert.equal(result.status, "baseline");
  assert.equal(await kv.get(HIGGSFIELD_LAST_SHA_KEY), "a".repeat(40));
  assert.equal(result.repository, HIGGSFIELD_REPOSITORY);
});

test("unchanged latest SHA does not send a Feishu message", async () => {
  const sha = "b".repeat(40);
  const kv = fakeKv({ [HIGGSFIELD_LAST_SHA_KEY]: sha });
  const sent = [];
  const { fetchImpl } = makeFetch({ sha, sent });

  const result = await runHiggsfieldCron({ kv, env: makeEnv(kv), fetchImpl });

  assert.equal(result.status, "unchanged");
  assert.equal(sent.length, 0);
});

test("changed latest SHA posts a signed plain-language update and then stores the SHA", async () => {
  const oldSha = "c".repeat(40);
  const newSha = "d".repeat(40);
  const kv = fakeKv({ [HIGGSFIELD_LAST_SHA_KEY]: oldSha });
  const sent = [];
  const { fetchImpl } = makeFetch({
    sha: newSha,
    message: "feat: add cinematic camera controls (#12)",
    sent,
  });

  const result = await runHiggsfieldCron({ kv, env: makeEnv(kv), fetchImpl });

  assert.equal(result.status, "notified");
  assert.equal(await kv.get(HIGGSFIELD_LAST_SHA_KEY), newSha);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].receive_id, "oc_ai_video_group");
  const text = JSON.parse(sent[0].content).text;
  assert.match(text, /AI 视频项目进度/);
  assert.match(text, /三儿/);
  assert.match(text, /视频功能或模型相关内容有更新/);
  assert.doesNotMatch(text, /#12|[a-d]{40}/);
});

test("failed Feishu delivery leaves the new SHA retryable", async () => {
  const oldSha = "e".repeat(40);
  const newSha = "f".repeat(40);
  const kv = fakeKv({ [HIGGSFIELD_LAST_SHA_KEY]: oldSha });
  const { fetchImpl: baseFetch } = makeFetch({ sha: newSha });
  const fetchImpl = async (url, init = {}) => {
    if (String(url).includes("/im/v1/messages?receive_id_type=chat_id")) {
      return Response.json({ code: 999, msg: "send failed" });
    }
    return baseFetch(url, init);
  };

  await assert.rejects(
    runHiggsfieldCron({ kv, env: makeEnv(kv), fetchImpl }),
    /Feishu chat message was rejected/,
  );
  assert.equal(await kv.get(HIGGSFIELD_LAST_SHA_KEY), oldSha);
});

test("rules-only path does not call DeepSeek when LLM is not configured", async () => {
  const kv = fakeKv({ [HIGGSFIELD_LAST_SHA_KEY]: "1".repeat(40) });
  const sent = [];
  const { calls, fetchImpl } = makeFetch({ sha: "2".repeat(40), sent });

  await runHiggsfieldCron({ kv, env: makeEnv(kv), fetchImpl });

  assert.equal(calls.some(({ url }) => url.includes("deepseek")), false);
  assert.equal(sent.length, 1);
});

test("DeepSeek rewrite is opt-in and only runs with existing LLM configuration", async () => {
  const kv = fakeKv({ [HIGGSFIELD_LAST_SHA_KEY]: "3".repeat(40) });
  const sent = [];
  const { calls, fetchImpl } = makeFetch({
    sha: "4".repeat(40),
    sent,
    llmReplies: ["视频站有新改动：镜头控制说明更清楚了。"],
  });
  const env = makeEnv(kv, {
    CRON_LLM_REWRITE: "true",
    LLM_BASE_URL: "https://api.deepseek.com/v1",
    LLM_MODEL: "deepseek-chat",
    LLM_API_KEY: "test-llm-key",
  });

  await runHiggsfieldCron({ kv, env, fetchImpl });

  assert.equal(calls.filter(({ url }) => url.includes("api.deepseek.com")).length, 1);
  assert.match(JSON.parse(sent[0].content).text, /镜头控制说明更清楚了/);
});

test("Worker exposes the three-hour scheduled handler", async () => {
  const kv = fakeKv();
  const { fetchImpl } = makeFetch({ sha: "5".repeat(40) });
  const worker = createWorker({ fetchImpl });

  const result = await worker.scheduled({ cron: "0 */3 * * *" }, makeEnv(kv), {});

  assert.equal(result.status, "baseline");
  assert.equal(await kv.get(HIGGSFIELD_LAST_SHA_KEY), "5".repeat(40));
});

test("rules-only progress copy is safe when a commit message contains tracker identifiers", () => {
  const message = buildCronProgressMessage({
    commitMessage: "fix: update README PR #99 1234567890abcdef1234567890abcdef12345678",
  });
  assert.match(message, /AI 视频项目进度/);
  assert.doesNotMatch(message, /PR #99|1234567890abcdef1234567890abcdef12345678/);
});
