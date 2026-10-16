import assert from "node:assert/strict";
import test from "node:test";
import { buildWebhookPayload, postGrokWebhook, WEBHOOK_RETRY_DELAYS_MS } from "../src/grok-webhook.mjs";

const WEBHOOK_URL = "https://grok.test/hooks/feishu";
const WEBHOOK_KEY = "grok-secret-key";

function recordingSleep() {
  const delays = [];
  return {
    delays,
    sleep: async (ms) => { delays.push(ms); },
  };
}

function webhookEnv(overrides = {}) {
  return { GROK_WEBHOOK_URL: WEBHOOK_URL, GROK_WEBHOOK_KEY: WEBHOOK_KEY, ...overrides };
}

function buildPayload(overrides = {}) {
  return buildWebhookPayload({
    selected: { messageId: "om_1", text: "随便聊聊", ...overrides.selected },
    context: { chatId: "oc_chat", senderOpenId: "ou_user", senderName: "老王", ...overrides.context },
    mentionedBot: overrides.mentionedBot ?? true,
  });
}

test("buildWebhookPayload maps the selected message and context with stable fields", () => {
  assert.deepEqual(buildPayload(), {
    text: "随便聊聊",
    sender_open_id: "ou_user",
    sender_name: "老王",
    message_id: "om_1",
    chat_id: "oc_chat",
    mentioned_bot: true,
  });
  assert.deepEqual(buildWebhookPayload({}), {
    text: "",
    sender_open_id: "",
    sender_name: "",
    message_id: "",
    chat_id: "",
    mentioned_bot: false,
  });
});

test("POSTs the webhook once with a bearer token and the JSON payload", async () => {
  const calls = [];
  const { sleep, delays } = recordingSleep();

  const result = await postGrokWebhook({
    env: webhookEnv(),
    payload: buildPayload(),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return Response.json({ ok: true });
    },
    sleep,
  });

  assert.deepEqual(result, { ok: true, attempts: 1, status: 200 });
  assert.deepEqual(delays, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, WEBHOOK_URL);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(new Headers(calls[0].init.headers).get("content-type"), "application/json");
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), `Bearer ${WEBHOOK_KEY}`);
  assert.deepEqual(JSON.parse(calls[0].init.body), buildPayload());
});

test("retries with the configured delays and succeeds on the third attempt", async () => {
  const calls = [];
  const { sleep, delays } = recordingSleep();
  let attempts = 0;

  const result = await postGrokWebhook({
    env: webhookEnv(),
    payload: buildPayload(),
    fetchImpl: async (url, init = {}) => {
      attempts += 1;
      calls.push({ url: String(url), init });
      if (attempts === 1) return new Response("", { status: 500 });
      if (attempts === 2) return new Response("", { status: 502 });
      return Response.json({ ok: true });
    },
    sleep,
  });

  assert.deepEqual(result, { ok: true, attempts: 3, status: 200 });
  assert.equal(calls.length, 3);
  assert.deepEqual(delays, WEBHOOK_RETRY_DELAYS_MS);
  assert.deepEqual(WEBHOOK_RETRY_DELAYS_MS, [500, 1500]);
});

test("gives up after three attempts when every call fails, without throwing", async () => {
  const calls = [];
  const { sleep, delays } = recordingSleep();

  const result = await postGrokWebhook({
    env: webhookEnv(),
    payload: buildPayload(),
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      throw new Error("network unreachable");
    },
    sleep,
  });

  assert.deepEqual(result, { ok: false, attempts: 3, status: null });
  assert.equal(calls.length, 3);
  assert.deepEqual(delays, [500, 1500]);
});

test("skips without fetching when the webhook url or key is missing", async () => {
  const cases = [
    webhookEnv({ GROK_WEBHOOK_URL: "" }),
    webhookEnv({ GROK_WEBHOOK_URL: undefined }),
    webhookEnv({ GROK_WEBHOOK_URL: "   " }),
    webhookEnv({ GROK_WEBHOOK_KEY: "" }),
    webhookEnv({ GROK_WEBHOOK_KEY: undefined }),
    webhookEnv({ GROK_WEBHOOK_KEY: "   " }),
  ];
  for (const env of cases) {
    let calls = 0;
    const result = await postGrokWebhook({
      env,
      payload: buildPayload(),
      fetchImpl: async () => { calls += 1; return Response.json({ ok: true }); },
      sleep: async () => {},
    });
    assert.deepEqual(result, { skipped: true });
    assert.equal(calls, 0);
  }
});

test("never logs the webhook url or key on failure", async () => {
  const logged = [];
  const original = console.log;
  console.log = (...args) => { logged.push(args.map(String).join(" ")); };
  try {
    await postGrokWebhook({
      env: webhookEnv(),
      payload: buildPayload({ selected: { messageId: "om_log" } }),
      fetchImpl: async () => { throw new Error(`boom ${WEBHOOK_URL} ${WEBHOOK_KEY}`); },
      sleep: async () => {},
    });
    await postGrokWebhook({
      env: webhookEnv(),
      payload: buildPayload({ selected: { messageId: "om_log" } }),
      fetchImpl: async () => new Response("", { status: 500 }),
      sleep: async () => {},
    });
  } finally {
    console.log = original;
  }

  assert.ok(logged.length > 0);
  for (const line of logged) {
    assert.ok(!line.includes(WEBHOOK_URL), `log leaked the url: ${line}`);
    assert.ok(!line.includes(WEBHOOK_KEY), `log leaked the key: ${line}`);
  }
});
