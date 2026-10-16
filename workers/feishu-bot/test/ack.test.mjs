import assert from "node:assert/strict";
import test from "node:test";
import { ACK_FALLBACK_TEXT, ackKey, buildAckText, isSafeAckSummary } from "../src/ack.mjs";
import { summarizeForAck } from "../src/llm.mjs";

const LLM_URL = "https://llm.test/v1";
const LLM_KEY = "llm-test-key";

function llmEnv(overrides = {}) {
  return {
    LLM_BASE_URL: LLM_URL,
    LLM_MODEL: "test-model",
    LLM_API_KEY: LLM_KEY,
    ...overrides,
  };
}

test("builds the acknowledgement text from a one-line summary", () => {
  assert.equal(
    buildAckText("落地页要加中文"),
    "收到，我理解是：落地页要加中文。马上安排，结果稍后回复。——老三",
  );
  assert.equal(
    buildAckText("落地页要加中文。"),
    "收到，我理解是：落地页要加中文。马上安排，结果稍后回复。——老三",
  );
});

test("falls back to the fixed acknowledgement text when there is no summary", () => {
  assert.equal(ACK_FALLBACK_TEXT, "收到，马上处理，结果稍后回复。——老三");
  assert.equal(buildAckText(""), ACK_FALLBACK_TEXT);
  assert.equal(buildAckText("   "), ACK_FALLBACK_TEXT);
  assert.equal(buildAckText(undefined), ACK_FALLBACK_TEXT);
});

test("truncates the summary to at most 30 characters and namespaces the dedupe key", () => {
  const long = "需".repeat(40);
  const text = buildAckText(long);

  assert.equal(text, `收到，我理解是：${"需".repeat(30)}。马上安排，结果稍后回复。——老三`);
  assert.equal(text.includes("需".repeat(31)), false);
  assert.equal(ackKey("om_1"), "feishu:acked:message:om_1");
});

test("falls back to the fixed acknowledgement text for unsafe summaries", () => {
  const unsafe = [
    "https://dreamutopia-clone.pages.dev",
    "www.example.com",
    "明天上线",
    "价格是 9.9 元",
    "$5",
    "保证一定完成",
  ];

  for (const summary of unsafe) {
    assert.equal(isSafeAckSummary(summary), false, `expected ${summary} to be unsafe`);
    assert.equal(buildAckText(summary), ACK_FALLBACK_TEXT, `expected fallback for ${summary}`);
  }
});

test("keeps a safe summary inside the acknowledgement text", () => {
  const summary = "落地页要加中文";

  assert.equal(isSafeAckSummary(summary), true);
  assert.equal(
    buildAckText(summary),
    "收到，我理解是：落地页要加中文。马上安排，结果稍后回复。——老三",
  );
});

test("returns an empty string when the LLM is not configured", async () => {
  let calls = 0;
  const result = await summarizeForAck({
    env: {},
    text: "落地页要加中文",
    fetchImpl: async () => { calls += 1; return Response.json({}); },
  });

  assert.equal(result, "");
  assert.equal(calls, 0);
});

test("returns the filtered one-line summary from the model", async () => {
  const calls = [];
  const result = await summarizeForAck({
    env: llmEnv(),
    text: "看 #21 落地页要加中文 boss@x.com",
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return Response.json({
        choices: [{ message: { role: "assistant", content: "落地页要加中文。见 PR #21，邮箱 boss@x.com" } }],
      });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${LLM_URL}/chat/completions`);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${LLM_KEY}`);
  assert.match(result, /落地页要加中文/);
  assert.doesNotMatch(result, /#\d+/);
  assert.doesNotMatch(result, /boss@x\.com/);
});

test("returns an empty string on an HTTP error and on a timeout", async () => {
  const failed = await summarizeForAck({
    env: llmEnv(),
    text: "落地页要加中文",
    fetchImpl: async () => new Response("", { status: 500 }),
  });
  assert.equal(failed, "");

  const timedOut = await summarizeForAck({
    env: llmEnv(),
    text: "落地页要加中文",
    timeoutMs: 200,
    fetchImpl: async (url, init = {}) => new Promise((_, reject) => {
      init.signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      }, { once: true });
    }),
  });
  assert.equal(timedOut, "");
});
