import assert from "node:assert/strict";
import test from "node:test";
import { ACK_FALLBACK_TEXT, ackKey } from "../src/ack.mjs";
import { dedupeKeys } from "../src/dedupe.mjs";
import { FORWARD_EMAIL_FROM, FORWARD_EMAIL_TO, GROK_FORWARD_CHAT_ID, forwardKey, forwardToGrok } from "../src/forward.mjs";
import { createWorker } from "../src/worker.mjs";

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_KEY = "re_test_key";

function fakeKv() {
  const values = new Map();
  const writes = [];
  const deletes = [];
  return {
    values,
    writes,
    deletes,
    async get(key) { return values.get(key) ?? null; },
    async put(key, value, options) {
      values.set(key, value);
      writes.push({ key, value, options });
    },
    async delete(key) {
      values.delete(key);
      deletes.push(key);
    },
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

function recordingSleep() {
  const delays = [];
  return {
    delays,
    sleep: async (ms) => { delays.push(ms); },
  };
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
    messageType: "text",
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
  messageType = "text",
  content,
  mentions = [{ key: "@_bot_1", id: { open_id: "ou_bot" } }],
  senderType = "user",
  senderOpenId = "ou_user",
  senderName = "老王",
  token = "verify-token",
} = {}) {
  return {
    schema: "2.0",
    header: { event_id: eventId, event_type: "im.message.receive_v1", token },
    event: {
      sender: { sender_type: senderType, sender_id: { open_id: senderOpenId, name: senderName } },
      message: {
        message_id: messageId,
        chat_id: chatId,
        chat_type: chatType,
        message_type: messageType,
        content: content ?? JSON.stringify({ text }),
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
  const { sleep, delays } = recordingSleep();

  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload,
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl,
    sleep,
  });

  assert.deepEqual(result, { ok: true, attempts: 1, status: 200 });
  assert.deepEqual(delays, []);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, RESEND_URL);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(new Headers(calls[0].init.headers).get("content-type"), "application/json");
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), `Bearer ${RESEND_KEY}`);
  const body = JSON.parse(calls[0].init.body);
  assert.equal(body.from, FORWARD_EMAIL_FROM);
  assert.deepEqual(body.to, FORWARD_EMAIL_TO);
  assert.equal(body.subject, "[feishu] 老王 om_1");
  for (const fragment of [
    "sender_open_id: ou_user",
    "sender_name: 老王",
    "message_type: text",
    "text: 随便聊聊",
    `chat_id: ${GROK_FORWARD_CHAT_ID}`,
    "message_id: om_1",
    "create_time: 1700000000000",
  ]) {
    assert.ok(body.text.includes(fragment), `expected email body to contain ${fragment}`);
  }
  assert.equal(await kv.get(forwardKey("om_1")), "1");
  assert.deepEqual(kv.writes.map(({ value }) => value), ["sending", "1"]);
  assert.deepEqual(kv.writes[0].options, { expirationTtl: 120 });
  assert.deepEqual(kv.writes[1].options, { expirationTtl: 604800 });
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
    assert.deepEqual(result, { ok: false, attempts: 0, status: null });
    assert.equal(calls.length, 0);
    assert.equal(kv.writes.length, 0);
  }
});

test("treats an already-forwarded message as done without a second fetch", async () => {
  const calls = [];
  const kv = fakeKv();
  const { sleep } = recordingSleep();
  await kv.put(forwardKey("om_1"), "1", { expirationTtl: 604800 });
  const fetchImpl = async (url, init = {}) => { calls.push({ url, init }); return Response.json({ ok: true }); };

  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl,
    sleep,
  });

  assert.deepEqual(result, { ok: true, attempts: 0, status: null, skipped: true });
  assert.equal(calls.length, 0);
});

test("writes a sending placeholder before the Resend request", async () => {
  const kv = fakeKv();
  const { sleep } = recordingSleep();
  const writesAtFetch = [];

  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl: async () => {
      writesAtFetch.push(kv.writes.map(({ key, value }) => `${key}=${value}`));
      return Response.json({ ok: true });
    },
    sleep,
  });

  assert.deepEqual(result, { ok: true, attempts: 1, status: 200 });
  assert.deepEqual(writesAtFetch, [[`${forwardKey("om_1")}=sending`]]);
  assert.deepEqual(kv.writes.map(({ value }) => value), ["sending", "1"]);
});

test("does not send again while an unexpired sending placeholder is present", async () => {
  const kv = fakeKv();
  const { sleep } = recordingSleep();
  const calls = [];
  await kv.put(forwardKey("om_1"), "sending", { expirationTtl: 120 });

  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl: async (url, init = {}) => { calls.push({ url, init }); return Response.json({ ok: true }); },
    sleep,
  });

  assert.deepEqual(result, { ok: true, attempts: 0, status: null, skipped: true });
  assert.equal(calls.length, 0);
});

test("skips messages from other chats without fetching", async () => {
  const calls = [];
  const kv = fakeKv();
  const { sleep } = recordingSleep();
  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext({ chatId: "oc_other" }),
    fetchImpl: async (url, init = {}) => { calls.push({ url, init }); return Response.json({ ok: true }); },
    sleep,
  });

  assert.deepEqual(result, { ok: false, attempts: 0, status: null });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(forwardKey("om_1")), null);
});

test("retries Resend with a 1s then 3s backoff and marks the message once a later attempt succeeds", async () => {
  const kv = fakeKv();
  const { sleep, delays } = recordingSleep();
  let attempts = 0;
  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) return new Response("", { status: 502 });
      return Response.json({ ok: true });
    },
    sleep,
  });

  assert.deepEqual(result, { ok: true, attempts: 3, status: 200 });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1000, 3000]);
  assert.equal(await kv.get(forwardKey("om_1")), "1");
});

test("leaves the message unmarked when every Resend attempt fails", async () => {
  const kv = fakeKv();
  const { sleep, delays } = recordingSleep();
  let attempts = 0;
  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl: async () => { attempts += 1; return new Response("", { status: 502 }); },
    sleep,
  });

  assert.deepEqual(result, { ok: false, attempts: 3, status: 502 });
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [1000, 3000]);
  assert.equal(await kv.get(forwardKey("om_1")), null);
  assert.deepEqual(kv.writes.map(({ value }) => value), ["sending"]);
  assert.deepEqual(kv.deletes, [forwardKey("om_1")]);
});

test("retries after a thrown transport error and marks the message on the next success", async () => {
  const kv = fakeKv();
  const { sleep, delays } = recordingSleep();
  let attempts = 0;
  const result = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage(),
    context: senderContext(),
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("network unreachable");
      return Response.json({ ok: true });
    },
    sleep,
  });

  assert.deepEqual(result, { ok: true, attempts: 2, status: 200 });
  assert.deepEqual(delays, [1000]);
  assert.equal(await kv.get(forwardKey("om_1")), "1");
});

test("dedupes by message id so a repeated delivery never emails twice", async () => {
  const kv = fakeKv();
  const { sleep } = recordingSleep();
  const calls = [];
  const fetchImpl = async (url, init = {}) => { calls.push({ url: String(url), init }); return Response.json({ ok: true }); };

  const first = await forwardToGrok({
    env: resendEnv(), kv, payload: {}, selected: selectedMessage(), context: senderContext(), fetchImpl, sleep,
  });
  const second = await forwardToGrok({
    env: resendEnv(),
    kv,
    payload: {},
    selected: selectedMessage({ eventId: "evt-2" }),
    context: senderContext(),
    fetchImpl,
    sleep,
  });

  assert.equal(first.ok, true);
  assert.deepEqual(second, { ok: true, attempts: 0, status: null, skipped: true });
  assert.equal(calls.length, 1);
});

test("formats the email subject from the sender name and message id", async () => {
  const cases = [
    [senderContext({ senderName: "老王", senderOpenId: "ou_user" }), "[feishu] 老王 om_1"],
    [senderContext({ senderName: "", senderOpenId: "ou_user" }), "[feishu] ou_user om_1"],
    [senderContext({ senderName: "", senderOpenId: "" }), "[feishu] unknown om_1"],
  ];

  for (const [context, expected] of cases) {
    const kv = fakeKv();
    const { sleep } = recordingSleep();
    const calls = [];
    const result = await forwardToGrok({
      env: resendEnv(),
      kv,
      payload: {},
      selected: selectedMessage(),
      context,
      fetchImpl: async (url, init = {}) => { calls.push({ url: String(url), init }); return Response.json({ ok: true }); },
      sleep,
    });

    assert.equal(result.ok, true);
    assert.equal(JSON.parse(calls[0].init.body).subject, expected);
  }
});

test("emails a group @bot mention and then replies once with the fallback acknowledgement", async () => {
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
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
  assert.equal(calls.some(({ url }) => url.includes("/im/v1/messages/")), true);
  assert.equal(await env.BOT_KV.get(ackKey("om_fwd")), "1");
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

test("forwards and acknowledges a repeated Feishu delivery only once", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  const payload = messagePayload({ text: "随便聊聊", messageId: "om_retry", eventId: "evt_retry" });

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal((await send(worker, payload, env)).status, 200);

  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
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
  while (waitUntilPromises.length > 0) {
    await Promise.all(waitUntilPromises.splice(0));
  }

  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
});

test("emails a 进度 command in the forwarding chat and then acknowledges it", async () => {
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
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
  assert.equal(calls.some(({ url }) => url.includes("/im/v1/messages/")), true);
});

test("still acknowledges a forward-chat @bot mention when the email forward fails, and never marks it processed", async () => {
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
  const worker = createWorker({ fetchImpl, sleep: async () => {} });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  const payload = messagePayload({ text: "进度", messageId: "om_pfail", eventId: "evt_pfail" });
  const [eventKey, messageKey] = dedupeKeys("evt_pfail", "om_pfail");

  assert.equal((await send(worker, payload, env)).status, 503);
  assert.ok(forwardCalls.length >= 1);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
  assert.equal(await env.BOT_KV.get(ackKey("om_pfail")), "1");
  // The failed attempt clears its placeholder so a later redelivery can email again.
  assert.equal(await env.BOT_KV.get(forwardKey("om_pfail")), null);
  assert.equal(await env.BOT_KV.get(eventKey), null);
  assert.equal(await env.BOT_KV.get(messageKey), null);

  const before = forwardCalls.length;
  assert.equal((await send(worker, payload, env)).status, 503);
  assert.ok(forwardCalls.length > before);
  assert.equal(replies.length, 1);
});

test("does not mark a forwarding-chat message processed when the Resend key is missing", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls }) });
  const env = makeEnv();
  const payload = messagePayload({ text: "进度", messageId: "om_pnokey", eventId: "evt_pnokey" });
  const [eventKey, messageKey] = dedupeKeys("evt_pnokey", "om_pnokey");

  assert.equal((await send(worker, payload, env)).status, 503);
  assert.equal(forwardCalls.length, 0);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
  assert.equal(await env.BOT_KV.get(eventKey), null);
  assert.equal(await env.BOT_KV.get(messageKey), null);

  assert.equal((await send(worker, payload, env)).status, 503);
  assert.equal(forwardCalls.length, 0);
  assert.equal(replies.length, 1);
});

test("forwards an unsupported forward-chat message with a placeholder instead of dropping it", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;

  const response = await send(
    worker,
    messagePayload({
      messageType: "file",
      content: JSON.stringify({ file_key: "file_1" }),
      messageId: "om_file",
      eventId: "evt_file",
    }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.ok(JSON.parse(forwardCalls[0].init.body).text.includes("text: [unsupported:file]"));
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
});

test("acks a forward-chat mention with the fixed text without ever calling the LLM", async () => {
  const replies = [];
  const forwardCalls = [];
  const llmCalls = [];
  const baseFetch = makeRecordingFetch({ replies, forwardCalls });
  const worker = createWorker({
    fetchImpl: async (url, init = {}) => {
      if (String(url).includes("/chat/completions")) {
        llmCalls.push({ url: String(url), init });
        return Response.json({
          choices: [{ message: { role: "assistant", content: "落地页要加中文。" } }],
        });
      }
      return baseFetch(url, init);
    },
  });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  env.LLM_BASE_URL = "https://llm.test/v1";
  env.LLM_MODEL = "test-model";
  env.LLM_API_KEY = "llm-test-key";

  const response = await send(
    worker,
    messagePayload({ text: "落地页要加中文", messageId: "om_ack", eventId: "evt_ack" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.equal(llmCalls.length, 0);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
  assert.equal(await env.BOT_KV.get(ackKey("om_ack")), "1");
});

test("does not email or acknowledge the same forward-chat message twice", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  const payload = messagePayload({ text: "随便聊聊", messageId: "om_ack_dup", eventId: "evt_ack_dup" });

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal((await send(worker, payload, env)).status, 200);

  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 1);
});

test("forwards a forward-chat message without a mention and never looks up the bot open_id", async () => {
  const replies = [];
  const calls = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, calls, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;

  const response = await send(
    worker,
    messagePayload({ text: "随便聊聊", mentions: [], messageId: "om_nomention", eventId: "evt_nomention" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 0);
  assert.equal(calls.some(({ url }) => url.includes("/bot/v3/info")), false);
  assert.equal(await env.BOT_KV.get(ackKey("om_nomention")), null);
});

test("falls back to the fixed acknowledgement text when the model call fails", async () => {
  const replies = [];
  const forwardCalls = [];
  const baseFetch = makeRecordingFetch({ replies, forwardCalls });
  const worker = createWorker({
    fetchImpl: async (url, init = {}) => {
      if (String(url).includes("/chat/completions")) return new Response("", { status: 500 });
      return baseFetch(url, init);
    },
  });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  env.LLM_BASE_URL = "https://llm.test/v1";
  env.LLM_MODEL = "test-model";
  env.LLM_API_KEY = "llm-test-key";

  const response = await send(
    worker,
    messagePayload({ text: "落地页要加中文", messageId: "om_ack_fail", eventId: "evt_ack_fail" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FALLBACK_TEXT);
});

test("never acknowledges a forward-chat mention sent by the bot itself", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;

  const response = await send(
    worker,
    messagePayload({ text: "随便聊聊", senderOpenId: "ou_bot", messageId: "om_self", eventId: "evt_self" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 0);
  assert.equal(await env.BOT_KV.get(ackKey("om_self")), null);
});
