import assert from "node:assert/strict";
import test from "node:test";
import { HELP_MESSAGE } from "../src/commands.mjs";
import { signOutboundText } from "../src/config.mjs";
import {
  DEFAULT_LLM_DAILY_LIMIT,
  DEFAULT_LLM_TIMEOUT_MS,
  LLM_CAP_MESSAGE,
  MAX_LLM_TIMEOUT_MS,
  MIN_LLM_TIMEOUT_MS,
  buildSystemPrompt,
  chatCompletionsUrl,
  dailyKvKey,
  filterLlmOutput,
  hashChatId,
  historyKvKey,
  llmDayKey,
  replyWithOptionalLlm,
  resolveLlmConfig,
} from "../src/llm.mjs";

const LLM_URL = "https://llm.test/v1";
const LLM_KEY = "llm-test-key";

function fakeKv(seed = {}) {
  const values = new Map(Object.entries(seed));
  const writes = [];
  return {
    values,
    writes,
    async get(key) { return values.get(key) ?? null; },
    async put(key, value, options) {
      values.set(key, value);
      writes.push({ key, value, options });
    },
  };
}

function llmEnv(overrides = {}) {
  return {
    LLM_BASE_URL: LLM_URL,
    LLM_MODEL: "test-model",
    LLM_API_KEY: LLM_KEY,
    ALLOWED_CHAT_IDS: "oc_partner",
    GITHUB_TOKEN: "ghs_test_token",
    ...overrides,
  };
}

function githubAndLlmFetch({
  completion = "案例页已经换成我们自己的样片。",
  llmCalls = [],
  comments = [{ body: "PR #21 已合并（6f3fe2a），案例页换成我们自己的样片。" }],
  failLlm = false,
  delayMs = 0,
} = {}) {
  return async (url, init = {}) => {
    const href = String(url);
    if (href.includes("/chat/completions")) {
      llmCalls.push({ url: href, init });
      if (failLlm) return Response.json({ error: "nope" }, { status: 500 });
      if (delayMs) {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, delayMs);
          init.signal?.addEventListener("abort", () => {
            clearTimeout(timer);
            reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
          }, { once: true });
        });
      }
      return Response.json({
        choices: [{ message: { role: "assistant", content: completion } }],
      });
    }
    if (href.includes("api.github.com") && href.includes("/comments")) {
      return Response.json(comments);
    }
    if (href.includes("api.github.com") && href.includes("/pulls")) {
      return Response.json([{
        title: "Public /examples sample pages from existing HD clips (#34)",
        merged_at: "2026-10-15T08:00:53Z",
        labels: [],
      }]);
    }
    if (href.includes("api.github.com") && /\/issues\/\d+$/.test(href.split("?")[0])) {
      return Response.json({
        number: 20,
        title: "主任务卡",
        body: "## 任务\n- [ ] 新定价方案\n## 卡点\n- 支付：Stripe",
      });
    }
    if (href === "https://dreamutopia-clone.pages.dev/api/health") {
      return Response.json({ ok: true, authReady: true, generationEnabled: false });
    }
    throw new Error(`unexpected ${href}`);
  };
}

test("LLM stays off unless base URL, model, and API key are all set", () => {
  assert.equal(resolveLlmConfig({}), null);
  assert.equal(resolveLlmConfig({ LLM_BASE_URL: LLM_URL, LLM_MODEL: "m" }), null);
  assert.equal(resolveLlmConfig({ LLM_BASE_URL: LLM_URL, LLM_API_KEY: LLM_KEY }), null);
  assert.equal(resolveLlmConfig({ LLM_MODEL: "m", LLM_API_KEY: LLM_KEY }), null);
  const cfg = resolveLlmConfig(llmEnv({ LLM_DAILY_LIMIT: "50" }));
  assert.equal(cfg.model, "test-model");
  assert.equal(cfg.dailyLimit, 50);
  assert.equal(resolveLlmConfig(llmEnv()).dailyLimit, DEFAULT_LLM_DAILY_LIMIT);
  assert.equal(resolveLlmConfig({ LLM_API_KEY: LLM_KEY }), null);
});

test("LLM request timeout defaults to 9000ms and clamps LLM_TIMEOUT_MS to a sane range", () => {
  assert.equal(DEFAULT_LLM_TIMEOUT_MS, 9000);
  assert.equal(resolveLlmConfig(llmEnv()).timeoutMs, 9000);
  assert.equal(resolveLlmConfig(llmEnv({ LLM_TIMEOUT_MS: "5000" })).timeoutMs, 5000);
  assert.equal(resolveLlmConfig(llmEnv({ LLM_TIMEOUT_MS: "20" })).timeoutMs, MIN_LLM_TIMEOUT_MS);
  assert.equal(resolveLlmConfig(llmEnv({ LLM_TIMEOUT_MS: "999999" })).timeoutMs, MAX_LLM_TIMEOUT_MS);
  assert.equal(resolveLlmConfig(llmEnv({ LLM_TIMEOUT_MS: "nope" })).timeoutMs, DEFAULT_LLM_TIMEOUT_MS);
});

test("chat completions URL is derived from the configured base without putting the key in it", () => {
  assert.equal(chatCompletionsUrl(`${LLM_URL}/`), `${LLM_URL}/chat/completions`);
  assert.equal(chatCompletionsUrl(`${LLM_URL}/chat/completions`), `${LLM_URL}/chat/completions`);
  assert.equal(chatCompletionsUrl(""), "");
});

test("post-filters model text: strip #\d+ and SHAs, redact privacy fields, drop 老三", () => {
  const filtered = filterLlmOutput("见 PR #21 和 abcdef1，邮箱 a@b.com，电话 13812345678。老三说可以。");
  assert.doesNotMatch(filtered, /#\d+/);
  assert.doesNotMatch(filtered, /\b[0-9a-f]{7,40}\b/i);
  assert.match(filtered, /已脱敏-邮箱/);
  assert.match(filtered, /已脱敏-电话/);
  assert.doesNotMatch(filtered, /老三/);
  const signed = signOutboundText(filtered);
  assert.match(signed, /Grok Bot · AI视频项目专属机器人 三儿/);
  assert.doesNotMatch(signed, /老三/);
});

test("system prompt includes 白话 progress, comments, health, and the no-invent rules", () => {
  const prompt = buildSystemPrompt({
    progress: "网站进度\n• 案例页换成我们自己的样片\n\n还没做\n• 定价方案还没定",
    notes: "• 已合并，案例页换成我们自己的样片。",
    health: "健康检查：HTTP 200；ok=true；generationEnabled=false",
  });
  assert.match(prompt, /不要编造/);
  assert.match(prompt, /不要提及 PR 号/);
  assert.match(prompt, /网站进度/);
  assert.match(prompt, /案例页换成我们自己的样片/);
  assert.match(prompt, /健康检查/);
  assert.doesNotMatch(prompt, /老三/);
  assert.doesNotMatch(prompt, /#\d+/);
});

test("unconfigured LLM never calls the model and returns the rule help text", async () => {
  const llmCalls = [];
  const text = await replyWithOptionalLlm({
    kv: fakeKv(),
    env: { ALLOWED_CHAT_IDS: "oc_partner" },
    chatId: "oc_partner",
    userText: "今天网站改了什么",
    fetchImpl: githubAndLlmFetch({ llmCalls }),
  });
  assert.equal(text, HELP_MESSAGE);
  assert.equal(llmCalls.length, 0);
});

test("non-allowlisted chats cannot use LLM even when it is configured", async () => {
  const llmCalls = [];
  const text = await replyWithOptionalLlm({
    kv: fakeKv(),
    env: llmEnv({ ALLOWED_CHAT_IDS: "" }),
    chatId: "oc_partner",
    userText: "今天网站改了什么",
    fetchImpl: githubAndLlmFetch({ llmCalls }),
  });
  assert.equal(text, HELP_MESSAGE);
  assert.equal(llmCalls.length, 0);
});

test("allowlisted freeform chat posts an OpenAI-compatible completion and filters the reply", async () => {
  const llmCalls = [];
  const kv = fakeKv();
  const text = await replyWithOptionalLlm({
    kv,
    env: llmEnv(),
    chatId: "oc_partner",
    userText: "案例页现在是什么样？看 PR #34 / 1c5dd76",
    fetchImpl: githubAndLlmFetch({
      llmCalls,
      completion: "案例页已经换了样片。详见 PR #34（1c5dd76）。邮箱 boss@x.com",
    }),
  });

  assert.equal(llmCalls.length, 1);
  assert.equal(llmCalls[0].url, `${LLM_URL}/chat/completions`);
  assert.equal(llmCalls[0].init.method, "POST");
  assert.equal(llmCalls[0].init.headers.Authorization, `Bearer ${LLM_KEY}`);
  assert.equal(String(llmCalls[0].init.body).includes(LLM_KEY), false);
  const body = JSON.parse(llmCalls[0].init.body);
  assert.equal(body.model, "test-model");
  assert.equal(body.messages[0].role, "system");
  assert.match(body.messages[0].content, /网站进度/);
  assert.match(body.messages[0].content, /健康检查/);
  assert.match(body.messages[0].content, /案例页换成我们自己的样片/);
  assert.doesNotMatch(body.messages[0].content, /#\d+/);
  assert.doesNotMatch(body.messages.at(-1).content, /#\d+/);
  assert.doesNotMatch(body.messages.at(-1).content, /1c5dd76/);
  assert.match(text, /案例页已经换了样片/);
  assert.doesNotMatch(text, /#\d+/);
  assert.doesNotMatch(text, /1c5dd76/);
  assert.match(text, /已脱敏-邮箱/);
  assert.doesNotMatch(text, /\/api\/(generate|upload)/);
  const signed = signOutboundText(text);
  assert.match(signed, /Grok Bot · AI视频项目专属机器人 三儿/);
});

test("stores only redacted turns under a hashed chat id, keeping the last 6 messages", async () => {
  const kv = fakeKv();
  const env = llmEnv();
  const fetchImpl = githubAndLlmFetch({ completion: "知道了，案例页已更新。" });
  for (let index = 0; index < 4; index += 1) {
    await replyWithOptionalLlm({
      kv,
      env,
      chatId: "oc_partner",
      userText: `第${index}次，看 #20 和 deadbee`,
      fetchImpl,
    });
  }
  const hash = await hashChatId("oc_partner");
  const stored = JSON.parse(await kv.get(historyKvKey(hash)));
  assert.equal(stored.length, 6);
  assert.equal(kv.values.has("oc_partner"), false);
  assert.ok(kv.values.has(historyKvKey(hash)));
  assert.ok([...kv.values.keys()].some((key) => key.startsWith("llm:daily:")));
  for (const key of kv.values.keys()) {
    assert.equal(key.includes("oc_partner"), false);
  }
  for (const item of stored) {
    assert.doesNotMatch(item.content, /#\d+/);
    assert.doesNotMatch(item.content, /deadbee/);
    assert.doesNotMatch(item.content, /oc_partner/);
  }
});

test("daily cap replies politely without calling the model", async () => {
  const hash = await hashChatId("oc_partner");
  const day = llmDayKey(Date.parse("2026-10-15T10:00:00Z"));
  const kv = fakeKv({ [dailyKvKey(hash, day)]: "200" });
  const llmCalls = [];
  const text = await replyWithOptionalLlm({
    kv,
    env: llmEnv(),
    chatId: "oc_partner",
    userText: "还能聊吗",
    fetchImpl: githubAndLlmFetch({ llmCalls }),
    now: () => Date.parse("2026-10-15T10:00:00Z"),
  });
  assert.equal(text, LLM_CAP_MESSAGE);
  assert.equal(llmCalls.length, 0);
  assert.match(signOutboundText(text), /三儿/);
});

test("LLM HTTP errors and timeouts fall back to the rule help text and still count toward the daily cap", async () => {
  const now = () => Date.parse("2026-10-15T10:00:00Z");
  const hash = await hashChatId("oc_partner");
  const day = llmDayKey(now());

  const kvFail = fakeKv();
  const failed = await replyWithOptionalLlm({
    kv: kvFail,
    env: llmEnv(),
    chatId: "oc_partner",
    userText: "在吗",
    fetchImpl: githubAndLlmFetch({ failLlm: true }),
    now,
  });
  assert.equal(failed, HELP_MESSAGE);
  assert.equal(await kvFail.get(dailyKvKey(hash, day)), "1");

  const kvTimeout = fakeKv();
  const timedOut = await replyWithOptionalLlm({
    kv: kvTimeout,
    env: llmEnv({ LLM_TIMEOUT_MS: String(MIN_LLM_TIMEOUT_MS) }),
    chatId: "oc_partner",
    userText: "在吗",
    fetchImpl: githubAndLlmFetch({ delayMs: MIN_LLM_TIMEOUT_MS + 400 }),
    now,
  });
  assert.equal(timedOut, HELP_MESSAGE);
  assert.equal(await kvTimeout.get(dailyKvKey(hash, day)), "1");
});

test("LLM path never calls generate, upload, or KIE", async () => {
  const urls = [];
  await replyWithOptionalLlm({
    kv: fakeKv(),
    env: llmEnv(),
    chatId: "oc_partner",
    userText: "生成一个视频",
    fetchImpl: async (url, init) => {
      urls.push(String(url));
      return githubAndLlmFetch()(url, init);
    },
  });
  assert.equal(urls.some((url) => /\/api\/(generate|upload)(?:\?|$)/.test(url)), false);
  assert.equal(urls.some((url) => /kie\.ai/i.test(url)), false);
});
