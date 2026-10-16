import assert from "node:assert/strict";
import test from "node:test";
import { buildWebhookPayload, postGrokWebhook } from "../src/grok-webhook.mjs";

const WEBHOOK_URL = "https://hooks.test/grok";
const WEBHOOK_KEY = "super-secret-key";

function recordingFetch(calls, responder = () => Response.json({ ok: true })) {
  return async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return responder();
  };
}

test("skips the webhook when the url or the key is missing", async () => {
  const cases = [
    {},
    { GROK_WEBHOOK_URL: WEBHOOK_URL },
    { GROK_WEBHOOK_KEY: WEBHOOK_KEY },
    { GROK_WEBHOOK_URL: "   ", GROK_WEBHOOK_KEY: WEBHOOK_KEY },
    { GROK_WEBHOOK_URL: WEBHOOK_URL, GROK_WEBHOOK_KEY: "   " },
  ];

  for (const env of cases) {
    const calls = [];
    const result = await postGrokWebhook({ env, payload: { text: "hi" }, fetchImpl: recordingFetch(calls) });
    assert.deepEqual(result, { skipped: true });
    assert.equal(calls.length, 0);
  }
});

test("posts the documented body with a bearer token in the default Authorization header", async () => {
  const calls = [];
  const payload = buildWebhookPayload({
    text: "随便聊聊",
    senderOpenId: "ou_user",
    senderName: "老王",
    messageId: "om_1",
    chatId: "oc_1",
    mentionedBot: true,
  });

  const result = await postGrokWebhook({
    env: { GROK_WEBHOOK_URL: WEBHOOK_URL, GROK_WEBHOOK_KEY: WEBHOOK_KEY },
    payload,
    fetchImpl: recordingFetch(calls),
  });

  assert.deepEqual(result, { skipped: false, ok: true, status: 200 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, WEBHOOK_URL);
  assert.equal(calls[0].init.method, "POST");
  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("authorization"), `Bearer ${WEBHOOK_KEY}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    text: "随便聊聊",
    sender_open_id: "ou_user",
    sender_name: "老王",
    message_id: "om_1",
    chat_id: "oc_1",
    mentioned_bot: true,
  });
});

test("honours a custom webhook header name", async () => {
  const calls = [];
  await postGrokWebhook({
    env: { GROK_WEBHOOK_URL: WEBHOOK_URL, GROK_WEBHOOK_KEY: WEBHOOK_KEY, GROK_WEBHOOK_HEADER: "X-Grok-Key" },
    payload: { text: "hi" },
    fetchImpl: recordingFetch(calls),
  });

  const headers = new Headers(calls[0].init.headers);
  assert.equal(headers.get("x-grok-key"), `Bearer ${WEBHOOK_KEY}`);
  assert.equal(headers.get("authorization"), null);
});

test("logs a non-2xx status without ever logging the key", async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => { logs.push(args.join(" ")); };
  try {
    const result = await postGrokWebhook({
      env: { GROK_WEBHOOK_URL: WEBHOOK_URL, GROK_WEBHOOK_KEY: WEBHOOK_KEY },
      payload: { text: "hi" },
      fetchImpl: async () => new Response("", { status: 502 }),
    });
    assert.deepEqual(result, { skipped: false, ok: false, status: 502 });
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.some((line) => line.startsWith("[feishu-webhook]")), true);
  assert.equal(logs.some((line) => line.includes(WEBHOOK_KEY)), false);
});

test("logs a transport failure without ever logging the key", async () => {
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => { logs.push(args.join(" ")); };
  try {
    const result = await postGrokWebhook({
      env: { GROK_WEBHOOK_URL: WEBHOOK_URL, GROK_WEBHOOK_KEY: WEBHOOK_KEY },
      payload: { text: "hi" },
      fetchImpl: async () => { throw new Error("network down"); },
    });
    assert.deepEqual(result, { skipped: false, ok: false, status: null });
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.some((line) => line.includes("[feishu-webhook]")), true);
  assert.equal(logs.some((line) => line.includes(WEBHOOK_KEY)), false);
});

test("builds every documented body field with safe defaults", () => {
  assert.deepEqual(buildWebhookPayload(), {
    text: "",
    sender_open_id: "",
    sender_name: "",
    message_id: "",
    chat_id: "",
    mentioned_bot: false,
  });
  assert.equal(buildWebhookPayload({ text: "hi" }).mentioned_bot, false);
});
