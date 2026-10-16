import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_DEPLOY_KEY,
  AUTO_LLM_UNSURE,
  AUTO_PROGRESS_KEY,
  autoEventKey,
  autoLlmCountKey,
  buildAutoAnswer,
  classifyQuestion,
  isLlmAutoAnswerEnabled,
  llmAutoAnswer,
  resolveAutoLlmTimeoutMs,
} from "../src/auto-answer.mjs";
import { addReaction, replyPostToMessage } from "../src/feishu-api.mjs";

const LLM_ENV = {
  LLM_BASE_URL: "https://llm.test/v1",
  LLM_MODEL: "test-model",
  LLM_API_KEY: "llm-test-key",
};

function llmResponse(content) {
  return Response.json({ choices: [{ message: { role: "assistant", content } }] });
}

const HEALTH_URL_FOR_TEST = "https://dreamutopia-video.pages.dev/api/health";
const SITE_ORIGIN = "https://dreamutopia-video.pages.dev";

function fakeKv(values = {}) {
  const store = new Map(Object.entries(values));
  return {
    async get(key) { return store.get(key) ?? null; },
    async put(key, value) { store.set(key, value); },
  };
}

test("classifies clear single-intent questions in Chinese and English", () => {
  const cases = [
    ["进度", "progress"],
    ["@_user_1 进度呢", "progress"],
    ["progress", "progress"],
    ["status?", "progress"],
    ["网址", "url"],
    ["@_user_1 链接是什么", "url"],
    ["url", "url"],
    ["preview", "url"],
    ["版本", "version"],
    ["最新版本呢", "version"],
    ["deployed", "version"],
    ["上线了吗", "version"],
    ["在吗", "ping"],
    ["@_user_1 你在吗", "ping"],
    ["你去哪了", "ping"],
    ["收到没", "ping"],
    ["hello", "ping"],
    ["hi?", "ping"],
  ];

  for (const [text, expected] of cases) {
    assert.equal(classifyQuestion(text), expected, `text=${text}`);
  }
});

test("routes fixed-and-repaired questions to a human instead of the version intent", () => {
  assert.equal(classifyQuestion("修好了吗"), null);
  assert.equal(classifyQuestion("修复了吗"), null);
  assert.equal(classifyQuestion("版本"), "version");
});

test("returns null for vague, compound, or oversized questions", () => {
  const cases = [
    "进度怎么样，顺便把价格改一下",
    "网站首页要改版",
    "能不能加个功能",
    "帮我看下这个",
    "为什么进度慢了",
    "进度和网址",
    "",
    null,
    "这条消息特别长所以包含了很多无关的内容进度",
  ];

  for (const text of cases) {
    assert.equal(classifyQuestion(text), null, `text=${String(text)}`);
  }
});

test("progress answers use the stored status and fall back when it is missing", async () => {
  const kv = fakeKv({ [AUTO_PROGRESS_KEY]: "第 3 步：案例页替换" });
  assert.equal(await buildAutoAnswer({ intent: "progress", kv }), "当前进度：第 3 步：案例页替换");
  assert.equal(await buildAutoAnswer({ intent: "progress", kv: fakeKv() }), "暂无进度记录，已转给老三。");
  assert.equal(await buildAutoAnswer({ intent: "progress" }), "暂无进度记录，已转给老三。");
});

test("url answers show the site origin and the live health result", async () => {
  const ok = await buildAutoAnswer({
    intent: "url",
    fetchImpl: async () => Response.json({ ok: true }, { status: 200 }),
    healthUrl: HEALTH_URL_FOR_TEST,
  });
  assert.equal(ok, `预览站：${SITE_ORIGIN}\n健康检查：正常 (HTTP 200)`);

  const unhealthy = await buildAutoAnswer({
    intent: "url",
    fetchImpl: async () => new Response("", { status: 503 }),
    healthUrl: HEALTH_URL_FOR_TEST,
  });
  assert.equal(unhealthy, `预览站：${SITE_ORIGIN}\n健康检查：异常 (HTTP 503)`);

  const unreachable = await buildAutoAnswer({
    intent: "url",
    fetchImpl: async () => { throw new Error("network down"); },
    healthUrl: HEALTH_URL_FOR_TEST,
  });
  assert.equal(unreachable, `预览站：${SITE_ORIGIN}\n健康检查：无法访问`);

  const timedOut = await buildAutoAnswer({
    intent: "url",
    timeoutMs: 10,
    fetchImpl: (url, init = {}) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }),
    healthUrl: HEALTH_URL_FOR_TEST,
  });
  assert.equal(timedOut, `预览站：${SITE_ORIGIN}\n健康检查：无法访问`);
});

test("version answers parse stored deploy records", async () => {
  const asJson = fakeKv({
    [AUTO_DEPLOY_KEY]: JSON.stringify({ version: "v1.2.3", time: "2026-10-15T08:00:00Z" }),
  });
  assert.equal(await buildAutoAnswer({ intent: "version", kv: asJson }), "最新部署：v1.2.3（2026-10-15T08:00:00Z）");

  const asString = fakeKv({ [AUTO_DEPLOY_KEY]: "v9" });
  assert.equal(await buildAutoAnswer({ intent: "version", kv: asString }), "最新部署：v9");

  assert.equal(await buildAutoAnswer({ intent: "version", kv: fakeKv() }), "暂无部署记录，已转给老三。");
  assert.equal(await buildAutoAnswer({ intent: "version" }), "暂无部署记录，已转给老三。");
});

test("ping answers with the fixed acknowledgement and unknown intents are rejected", async () => {
  assert.equal(await buildAutoAnswer({ intent: "ping" }), "在的，收到，正在处理。");
  await assert.rejects(() => buildAutoAnswer({ intent: "unknown" }), TypeError);
});

test("replyPostToMessage mentions a user open id and falls back to plain text otherwise", async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url, init });
    return Response.json({ code: 0 });
  };

  await replyPostToMessage({
    token: "tenant-test-token",
    messageId: "om_post",
    text: "暂无进度记录，已转给老三。",
    mentionOpenId: "ou_user_1",
    fetchImpl,
  });
  const post = JSON.parse(calls[0].init.body);
  assert.equal(post.msg_type, "post");
  const content = JSON.parse(post.content);
  assert.deepEqual(content.zh_cn.content[0][0], { tag: "at", user_id: "ou_user_1" });
  assert.equal(content.zh_cn.content[0][1].tag, "text");
  assert.match(content.zh_cn.content[0][1].text, /暂无进度记录/);

  await replyPostToMessage({
    token: "tenant-test-token",
    messageId: "om_text",
    text: "暂无进度记录，已转给老三。",
    mentionOpenId: "bot",
    fetchImpl,
  });
  assert.equal(JSON.parse(calls[1].init.body).msg_type, "text");
});

test("addReaction posts the OK emoji and retries once with Get when the API rejects it", async () => {
  const calls = [];
  const responses = [Response.json({ code: 99991400 }), Response.json({ code: 0 })];
  const fetchImpl = async (url, init = {}) => { calls.push({ url: String(url), init }); return responses.shift(); };

  const result = await addReaction({ token: "tenant-test-token", messageId: "om_reaction", fetchImpl });

  assert.equal(result.code, 0);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://open.feishu.cn/open-apis/im/v1/messages/om_reaction/reactions");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), "Bearer tenant-test-token");
  assert.deepEqual(JSON.parse(calls[0].init.body), { reaction_type: { emoji_type: "OK" } });
  assert.deepEqual(JSON.parse(calls[1].init.body), { reaction_type: { emoji_type: "Get" } });
});

test("addReaction logs and swallows every failure", async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => { logs.push(args.join(" ")); };
  try {
    const rejected = await addReaction({
      token: "tenant-test-token",
      messageId: "om_rejected",
      fetchImpl: async () => Response.json({ code: 99991400 }),
    });
    assert.equal(rejected.code, 99991400);

    const failed = await addReaction({
      token: "tenant-test-token",
      messageId: "om_failed",
      fetchImpl: async () => { throw new Error("network down"); },
    });
    assert.equal(failed, null);
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.some((line) => line.includes("[feishu-reaction]")), true);
});

test("addReaction still requires a token and a message id", async () => {
  await assert.rejects(() => addReaction({ token: "", messageId: "om_reaction" }), TypeError);
});

test("the LLM switch is only on for the exact true value", () => {
  assert.equal(isLlmAutoAnswerEnabled({ LLM_AUTO_ANSWER_ENABLED: "true" }), true);
  for (const env of [{}, { LLM_AUTO_ANSWER_ENABLED: "1" }, { LLM_AUTO_ANSWER_ENABLED: "TRUE" }, { LLM_AUTO_ANSWER_ENABLED: true }]) {
    assert.equal(isLlmAutoAnswerEnabled(env), false, JSON.stringify(env));
  }
});

test("event keys and llm day counters use the documented prefixes", () => {
  assert.equal(autoEventKey("evt-1"), "feishu:auto:event:evt-1");
  assert.equal(
    autoLlmCountKey(() => Date.parse("2026-10-16T00:00:00Z")),
    "feishu:auto:llm:count:2026-10-16",
  );
});

test("caps the llm timeout at 20s and falls back to 9s for invalid values", () => {
  assert.equal(resolveAutoLlmTimeoutMs("60000"), 20000);
  assert.equal(resolveAutoLlmTimeoutMs(20000), 20000);
  assert.equal(resolveAutoLlmTimeoutMs("500"), 500);
  assert.equal(resolveAutoLlmTimeoutMs(undefined), 9000);
  assert.equal(resolveAutoLlmTimeoutMs("abc"), 9000);
  assert.equal(resolveAutoLlmTimeoutMs("0"), 9000);
  assert.equal(resolveAutoLlmTimeoutMs("-5"), 9000);
});

test("llmAutoAnswer answers from the stored context and counts the attempt first", async () => {
  const now = () => Date.parse("2026-10-16T00:00:00Z");
  const kv = fakeKv({
    [AUTO_PROGRESS_KEY]: "第 3 步",
    [AUTO_DEPLOY_KEY]: JSON.stringify({ version: "v1.2.3", time: "2026-10-15T08:00:00Z" }),
  });
  const calls = [];

  const result = await llmAutoAnswer({
    env: LLM_ENV,
    kv,
    text: "什么时候上线",
    now,
    fetchImpl: async (url, init = {}) => { calls.push({ url: String(url), init }); return llmResponse("明天上线。"); },
  });

  assert.deepEqual(result, { answer: "明天上线。" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://llm.test/v1/chat/completions");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), "Bearer llm-test-key");
  const request = JSON.parse(calls[0].init.body);
  assert.equal(request.model, "test-model");
  assert.equal(request.max_tokens, 200);
  assert.equal(request.temperature, 0);
  assert.equal(request.stream, false);
  assert.ok(request.messages[0].content.includes("NEEDS_DECISION"));
  assert.ok(request.messages[0].content.includes("第 3 步"));
  assert.ok(request.messages[1].content.includes("第 3 步"));
  assert.ok(request.messages[1].content.includes("什么时候上线"));
  assert.equal(await kv.get(autoLlmCountKey(now)), "1");
});

test("llmAutoAnswer maps the reserved replies and empty answers to fallbacks", async () => {
  const now = () => Date.parse("2026-10-16T00:00:00Z");
  const run = (content) => llmAutoAnswer({
    env: LLM_ENV,
    kv: fakeKv(),
    text: "进度",
    now,
    fetchImpl: async () => llmResponse(content),
  });

  assert.deepEqual(await run(`  ${AUTO_LLM_UNSURE.replace("UNSURE", "NEEDS_DECISION")}  `), { fallback: "decision" });
  assert.deepEqual(await run(AUTO_LLM_UNSURE), { fallback: "unsure" });
  assert.deepEqual(await run("   "), { fallback: "error" });
});

test("llmAutoAnswer reports http failures, transport failures and timeouts", async () => {
  const now = () => Date.parse("2026-10-16T00:00:00Z");
  const base = { env: LLM_ENV, text: "进度", now };

  const httpFailure = await llmAutoAnswer({
    ...base,
    kv: fakeKv(),
    fetchImpl: async () => new Response("", { status: 500 }),
  });
  assert.deepEqual(httpFailure, { fallback: "error" });

  const transportFailure = await llmAutoAnswer({
    ...base,
    kv: fakeKv(),
    fetchImpl: async () => { throw new Error("network down"); },
  });
  assert.deepEqual(transportFailure, { fallback: "error" });

  const timedOut = await llmAutoAnswer({
    ...base,
    env: { ...LLM_ENV, LLM_TIMEOUT_MS: "5" },
    kv: fakeKv(),
    fetchImpl: (url, init = {}) => new Promise((_, reject) => {
      if (init.signal?.aborted) { reject(init.signal.reason); return; }
      init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    }),
  });
  assert.deepEqual(timedOut, { fallback: "timeout" });
});

test("llmAutoAnswer stops at the daily limit without calling the model", async () => {
  const now = () => Date.parse("2026-10-16T00:00:00Z");
  const kv = fakeKv({ [autoLlmCountKey(now)]: "3" });
  const calls = [];

  const result = await llmAutoAnswer({
    env: { ...LLM_ENV, LLM_DAILY_LIMIT: "3" },
    kv,
    text: "进度",
    now,
    fetchImpl: async (url, init = {}) => { calls.push({ url: String(url), init }); return llmResponse("x"); },
  });

  assert.deepEqual(result, { fallback: "limit" });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(autoLlmCountKey(now)), "3");
});

test("llmAutoAnswer never calls the model without a full configuration", async () => {
  const calls = [];
  const kv = fakeKv();

  const result = await llmAutoAnswer({
    env: { LLM_BASE_URL: "https://llm.test/v1", LLM_MODEL: "test-model" },
    kv,
    text: "进度",
    fetchImpl: async (url, init = {}) => { calls.push({ url: String(url), init }); return llmResponse("x"); },
  });

  assert.deepEqual(result, { fallback: "error" });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(autoLlmCountKey()), null);
});
