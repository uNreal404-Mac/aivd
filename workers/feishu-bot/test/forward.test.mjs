import assert from "node:assert/strict";
import test from "node:test";
import { FORWARD_EMAIL_FROM, FORWARD_EMAIL_TO, GROK_FORWARD_CHAT_ID, forwardKey, forwardToGrok } from "../src/forward.mjs";
import { createWorker } from "../src/worker.mjs";

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_KEY = "re_test_key";

function fakeKv() {
  const values = new Map();
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

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function resendEnv(overrides = {}) {
  return {
    RESEND_API_KEY: RESEND_KEY,
    ...overrides,
  };
}

function selectedMessage(overrides = {}) {
  return {
    eventId: "evt-1",
    messageId: "om_1",
    chatType: "group",
    text: "  随便聊聊  ",
    ...overrides,
  };
}

function senderContext(overrides = {}) {
  return {
    chatId: GROK_FORWARD_CHAT_ID,
    senderOpenId: "ou_user",
    senderName: "老王",
    ...overrides,
  };
}

function makeEnv(kv = fakeKv()) {
  return {
    BOT_KV: kv,
    FEISHU_APP_ID: "test-app-id",
    FEISHU_APP_SECRET: "test-app-secret",
    FEISHU_VERIFICATION_TOKEN: "verify-token",
    FEISHU_ENCRYPT_KEY: "",
  };
}

function messagePayload({
  eventId = "evt-1",
  messageId = "om_1",
  text = "随便聊聊",
  chatType = "group",
  chatId = GROK_FORWARD_CHAT_ID,
  mentions = [{ key: "@_bot_1", id: { open_id: "ou_bot" } }],
  token = "verify-token",
} = {}) {
  return {
    schema: "2.0",
    header: { event_id: eventId, event_type: "im.message.receive_v1", token },
    event: {
      sender: { sender_type: "user", sender_id: { open_id: "ou_user", name: "老王" } },
      message: {
        message_id: messageId,
        chat_id: chatId,
        chat_type: chatType,
        message_type: "text",
        content: JSON.stringify({ text }),
        mentions,
        create_time: "1700000000000",
      },
    },
  };
}

function makeRecordingFetch({ replies = [], calls = [], forwardCalls = [] } = {}) {
  return async (url, init = {}) => {
    const href = String(url);
    calls.push({ url: href, init });
    if (href === RESEND_URL) {
      forwardCalls.push({ url: href, init });
      return Response.json({ ok: true });
    }
    if (href.endsWith("/auth/v3/tenant_access_token/internal")) {
      return Response.json({ code: 0, tenant_access_token: "tenant-test-token", expire: 7200 });
    }
    if (href.endsWith("/bot/v3/info")) {
      return Response.json({ code: 0, bot: { open_id: "ou_bot" } });
    }
    if (href.includes("/im/v1/messages/") && href.endsWith("/reply")) {
      replies.push(JSON.parse(init.body));
      return Response.json({ code: 0, data: { message_id: "om_reply" } });
    }
    throw new Error(`Unexpected outbound request: ${href}`);
  };
}

async function send(worker, payload, env) {
  const request = new Request("https://worker.test/feishu/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return worker.fetch(request, env, {});
}

test("emails the trimmed message through Resend with a bearer token and records a dedupe key", async () => {
  const kv = fakeKv();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };
  const payload = { event: { message: { create_time: "1700000000000" } } };

  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload,
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl,
  });

  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, RESEND_URL);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(new Headers(calls[0].init.headers).get("content-type"), "application/json");
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), `Bearer ${RESEND_KEY}`);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.from, FORWARD_EMAIL_FROM);
  assert.deepEqual(body.to, FORWARD_EMAIL_TO);
  assert.equal(body.subject, "[feishu] 老王");
  for (const fragment of [
    "sender_open_id: ou_user",
    "sender_name: 老王",
    "text: 随便聊聊",
    `chat_id: ${GROK_FORWARD_CHAT_ID}`,
    "message_id: om_1",
    "create_time: 1700000000000",
  ]) {
    assert.ok(body.text.includes(fragment), `expected email body to contain ${fragment}`);
  }
  assert.equal(await kv.get(forwardKey("evt-1")), "1");
  assert.deepEqual(kv.writes[0].options, { expirationTtl: 604800 });
});

test("skips forwarding without fetching when the Resend API key is missing", async () => {
  for (const env of [resendEnv({ RESEND_API_KEY: "" }), resendEnv({ RESEND_API_KEY: undefined })]) {
    const calls = [];
    const kv = fakeKv();
    const result = await forwardToGrok({
      env,
      kv,
      payload: {},
      selected: selectedMessage(),
      context: senderContext(),
      fetchImpl: async (url, init = {}) => { calls.push({ url, init }); return Response.json({ ok: true }); },
    });
    assert.equal(result, false);
    assert.equal(calls.length, 0);
    assert.equal(kv.writes.length, 0);
  }
});

test("treats an already-forwarded event as done without a second fetch", async () => {
  const calls = [];
  const kv = fakeKv();
  await kv.put(forwardKey("evt-1"), "1", { expirationTtl: 604800 });
  const fetchImpl = async (url, init = {}) => { calls.push({ url, init }); return Response.json({ ok: true }); };

  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl,
  });

  assert.equal(result, true);
  assert.equal(calls.length, 0);
});

test("skips messages from other chats without fetching", async () => {
  const calls = [];
  const kv = fakeKv();
  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext({ chatId: "oc_other" }),
    fetchImpl: async (url, init = {}) => { calls.push({ url, init }); return Response.json({ ok: true }); },
  });

  assert.equal(result, false);
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(forwardKey("evt-1")), null);
});

test("returns false and writes no dedupe key when Resend responds with an error", async () => {
  const kv = fakeKv();
  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl: async () => new Response("", { status: 502 }),
  });

  assert.equal(result, false);
  assert.equal(await kv.get(forwardKey("evt-1")), null);
  assert.equal(kv.writes.length, 0);
});

test("emails a group mention instead of replying to Feishu", async () => {
  const replies = [];
  const calls = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, calls, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;

  const response = await send(worker, messagePayload({ text: "随便聊聊", messageId: "om_fwd", eventId: "evt_fwd" }), env);

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.equal(forwardCalls[0].url, RESEND_URL);
  assert.equal(new Headers(forwardCalls[0].init.headers).get("authorization"), `Bearer ${RESEND_KEY}`);
  assert.equal(replies.length, 0);
  assert.equal(calls.some(({ url }) => url.includes("/im/v1/messages/")), false);
});

test("uses the normal reply path for group messages outside the forwarding chat", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls }) });
  const env = makeEnv();

  const response = await send(
    worker,
    messagePayload({ text: "随便聊聊", messageId: "om_nofwd", eventId: "evt_nofwd", chatId: "oc_other_group" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 0);
  assert.equal(replies.length, 1);
});

test("forwards a repeated Feishu delivery only once", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  const payload = messagePayload({ text: "随便聊聊", messageId: "om_retry", eventId: "evt_retry" });

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal((await send(worker, payload, env)).status, 200);

  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 0);
});

test("acks before the deferred email forward resolves when waitUntil is available", async () => {
  const replies = [];
  const calls = [];
  const forwardCalls = [];
  const gate = deferred();
  const started = deferred();

  const baseFetch = makeRecordingFetch({ replies, calls, forwardCalls });
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    if (href === RESEND_URL) {
      forwardCalls.push({ url: href, init });
      started.resolve();
      await gate.promise;
      return Response.json({ ok: true });
    }
    return baseFetch(url, init);
  };

  const worker = createWorker({ fetchImpl });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  const waitUntilPromises = [];
  const ctx = { waitUntil: (promise) => { waitUntilPromises.push(promise); } };
  const request = new Request("https://worker.test/feishu/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(messagePayload({ text: "随便聊聊", messageId: "om_bg", eventId: "evt_bg" })),
  });

  const response = await worker.fetch(request, env, ctx);

  assert.equal(response.status, 200);
  assert.equal(waitUntilPromises.length, 1);
  await started.promise;
  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 0);

  gate.resolve();
  await Promise.all(waitUntilPromises);

  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 0);
});

test("emails a 进度 command in the forwarding chat without replying to Feishu", async () => {
  const replies = [];
  const calls = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, calls, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;

  const response = await send(
    worker,
    messagePayload({ text: "进度", messageId: "om_progress", eventId: "evt_progress" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.ok(JSON.parse(forwardCalls[0].init.body).text.includes("text: 进度"));
  assert.equal(replies.length, 0);
  assert.equal(calls.some(({ url }) => url.includes("/im/v1/messages/")), false);
});

test("marks a 进度 command in the forwarding chat processed after a Resend failure", async () => {
  const replies = [];
  const forwardCalls = [];
  const baseFetch = makeRecordingFetch({ replies, forwardCalls });
  const fetchImpl = async (url, init = {}) => {
    if (String(url) === RESEND_URL) {
      forwardCalls.push({ url: String(url), init });
      return new Response("", { status: 502 });
    }
    return baseFetch(url, init);
  };
  const worker = createWorker({ fetchImpl });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  const payload = messagePayload({ text: "进度", messageId: "om_pfail", eventId: "evt_pfail" });

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 0);

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 0);
});

test("marks a 进度 command in the forwarding chat processed when the Resend key is missing", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls }) });
  const env = makeEnv();
  const payload = messagePayload({ text: "进度", messageId: "om_pnokey", eventId: "evt_pnokey" });

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal(forwardCalls.length, 0);
  assert.equal(replies.length, 0);

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal(forwardCalls.length, 0);
  assert.equal(replies.length, 0);
});
