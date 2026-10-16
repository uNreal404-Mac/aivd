import assert from "node:assert/strict";
import test from "node:test";
import { ACK_FAILURE_TEXT, ACK_SUCCESS_TEXT, ackKey } from "../src/ack.mjs";
import { AUTO_PROGRESS_KEY, autoEventKey, autoLlmCountKey } from "../src/auto-answer.mjs";

const SIGNATURE = "Grok Bot · AI视频项目专属机器人 老三";
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

function makeRecordingFetch({ replies = [], calls = [], forwardCalls = [], reactions = [] } = {}) {
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
    if (href.endsWith("/reactions")) {
      reactions.push({ url: href, body: JSON.parse(init.body) });
      return Response.json({ code: 0, data: { reaction_id: "reaction_1" } });
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
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
  assert.equal(SIGNATURE.length > 0, true);
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
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
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
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
});

test("emails a vague @bot message in the forwarding chat and then acknowledges it", async () => {
  const replies = [];
  const calls = [];
  const forwardCalls = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, calls, forwardCalls }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;

  const response = await send(
    worker,
    messagePayload({ text: "帮我看下这个", messageId: "om_progress", eventId: "evt_progress" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.ok(JSON.parse(forwardCalls[0].init.body).text.includes("text: 帮我看下这个"));
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
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
  const payload = messagePayload({ text: "帮我看下这个", messageId: "om_pfail", eventId: "evt_pfail" });
  const [eventKey, messageKey] = dedupeKeys("evt_pfail", "om_pfail");

  assert.equal((await send(worker, payload, env)).status, 503);
  assert.ok(forwardCalls.length >= 1);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FAILURE_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
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
  const payload = messagePayload({ text: "帮我看下这个", messageId: "om_pnokey", eventId: "evt_pnokey" });
  const [eventKey, messageKey] = dedupeKeys("evt_pnokey", "om_pnokey");

  assert.equal((await send(worker, payload, env)).status, 503);
  assert.equal(forwardCalls.length, 0);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_FAILURE_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
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
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
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
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
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

test("acknowledges a successful forward even when the model call would fail", async () => {
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
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.doesNotMatch(JSON.parse(replies[0].content).text, /Grok Bot/);
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

function llmWorkerEnv(overrides = {}) {
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  env.LLM_AUTO_ANSWER_ENABLED = "true";
  env.LLM_BASE_URL = "https://llm.test/v1";
  env.LLM_MODEL = "test-model";
  env.LLM_API_KEY = "llm-test-key";
  return Object.assign(env, overrides);
}

function createLlmWorker({ content = "", status = 200, llmCalls = [], replies = [], forwardCalls = [] } = {}) {
  const baseFetch = makeRecordingFetch({ replies, forwardCalls });
  return createWorker({
    fetchImpl: async (url, init = {}) => {
      if (String(url).includes("/chat/completions")) {
        llmCalls.push({ url: String(url), init });
        if (status !== 200) return new Response("", { status });
        return Response.json({ choices: [{ message: { role: "assistant", content } }] });
      }
      return baseFetch(url, init);
    },
  });
}

test("reacts to and auto-answers a @bot 进度 mention in the forwarding chat", async () => {
  const replies = [];
  const forwardCalls = [];
  const reactions = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls, reactions }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  await env.BOT_KV.put(AUTO_PROGRESS_KEY, "第 3 步：案例页替换");

  const response = await send(
    worker,
    messagePayload({ text: "进度", messageId: "om_auto", eventId: "evt_auto" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(reactions.length, 1);
  assert.equal(reactions[0].url.endsWith("/im/v1/messages/om_auto/reactions"), true);
  assert.deepEqual(reactions[0].body, { reaction_type: { emoji_type: "OK" } });

  assert.equal(forwardCalls.length, 1);
  const email = JSON.parse(forwardCalls[0].init.body);
  assert.equal(email.subject.startsWith("[auto] "), true);
  assert.ok(email.text.includes("auto_answer: 当前进度：第 3 步：案例页替换"));

  assert.equal(replies.length, 1);
  assert.equal(replies[0].msg_type, "post");
  const post = JSON.parse(replies[0].content);
  assert.deepEqual(post.zh_cn.content[0][0], { tag: "at", user_id: "ou_user" });
  assert.match(post.zh_cn.content[0][1].text, /当前进度：第 3 步：案例页替换/);

  assert.equal(await env.BOT_KV.get(autoEventKey("evt_auto")), "1");
  const eventWrite = env.BOT_KV.writes.find(({ key }) => key === autoEventKey("evt_auto"));
  assert.deepEqual(eventWrite.options, { expirationTtl: 604800 });
});

test("skips a redelivered event id even when it arrives with a different message id", async () => {
  const replies = [];
  const forwardCalls = [];
  const reactions = [];
  const worker = createWorker({ fetchImpl: makeRecordingFetch({ replies, forwardCalls, reactions }) });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;

  const first = messagePayload({ text: "随便聊聊", messageId: "om_dup_a", eventId: "evt_dup" });
  const second = messagePayload({ text: "随便聊聊", messageId: "om_dup_b", eventId: "evt_dup" });

  assert.equal((await send(worker, first, env)).status, 200);
  assert.equal((await send(worker, second, env)).status, 200);

  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 1);
  assert.equal(reactions.length, 1);
  assert.equal(await env.BOT_KV.get(autoEventKey("evt_dup")), "1");
});

test("mirrors every forwarded message to the Grok webhook in parallel with the email", async () => {
  const replies = [];
  const forwardCalls = [];
  const webhookCalls = [];
  const baseFetch = makeRecordingFetch({ replies, forwardCalls });
  const worker = createWorker({
    fetchImpl: async (url, init = {}) => {
      if (String(url) === "https://hooks.test/grok") {
        webhookCalls.push({ url: String(url), init });
        return Response.json({ ok: true });
      }
      return baseFetch(url, init);
    },
  });
  const env = makeEnv();
  env.RESEND_API_KEY = RESEND_KEY;
  env.GROK_WEBHOOK_URL = "https://hooks.test/grok";
  env.GROK_WEBHOOK_KEY = "super-secret-key";

  const response = await send(
    worker,
    messagePayload({ text: "随便聊聊", messageId: "om_webhook", eventId: "evt_webhook" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.equal(webhookCalls.length, 1);
  assert.equal(webhookCalls[0].init.method, "POST");
  const headers = new Headers(webhookCalls[0].init.headers);
  assert.equal(headers.get("authorization"), "Bearer super-secret-key");
  assert.equal(headers.get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(webhookCalls[0].init.body), {
    text: "随便聊聊",
    sender_open_id: "ou_user",
    sender_name: "老王",
    message_id: "om_webhook",
    chat_id: GROK_FORWARD_CHAT_ID,
    mentioned_bot: true,
  });
});

test("a failed webhook mirror never affects the email or the acknowledgement", async () => {
  const replies = [];
  const forwardCalls = [];
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => { logs.push(args.join(" ")); };
  try {
    const baseFetch = makeRecordingFetch({ replies, forwardCalls });
    const worker = createWorker({
      fetchImpl: async (url, init = {}) => {
        if (String(url) === "https://hooks.test/grok") return new Response("", { status: 502 });
        return baseFetch(url, init);
      },
    });
    const env = makeEnv();
    env.RESEND_API_KEY = RESEND_KEY;
    env.GROK_WEBHOOK_URL = "https://hooks.test/grok";
    env.GROK_WEBHOOK_KEY = "super-secret-key";

    const response = await send(
      worker,
      messagePayload({ text: "随便聊聊", messageId: "om_webfail", eventId: "evt_webfail" }),
      env,
    );

    assert.equal(response.status, 200);
    assert.equal(forwardCalls.length, 1);
    assert.equal(replies.length, 1);
    assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  } finally {
    console.log = originalLog;
  }

  assert.equal(logs.some((line) => line.includes("[feishu-webhook]")), true);
  assert.equal(logs.some((line) => line.includes("super-secret-key")), false);
});

test("auto-answers a @bot mention through the LLM when the switch is on", async () => {
  const replies = [];
  const forwardCalls = [];
  const llmCalls = [];
  const worker = createLlmWorker({ content: "  明天上线。  ", llmCalls, replies, forwardCalls });
  const env = llmWorkerEnv();
  await env.BOT_KV.put(AUTO_PROGRESS_KEY, "第 3 步：案例页替换");

  const response = await send(
    worker,
    messagePayload({ text: "什么时候上线", messageId: "om_llm", eventId: "evt_llm" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(llmCalls.length, 1);
  assert.equal(llmCalls[0].url, "https://llm.test/v1/chat/completions");
  const request = JSON.parse(llmCalls[0].init.body);
  assert.equal(request.model, "test-model");
  assert.equal(request.max_tokens, 200);
  assert.equal(request.temperature, 0);
  assert.equal(request.stream, false);
  assert.ok(request.messages[0].content.includes("NEEDS_DECISION"));
  assert.ok(request.messages[0].content.includes("第 3 步：案例页替换"));
  assert.ok(request.messages[1].content.includes("什么时候上线"));
  assert.equal(await env.BOT_KV.get(autoLlmCountKey()), "1");

  assert.equal(forwardCalls.length, 1);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].msg_type, "post");
  const post = JSON.parse(replies[0].content);
  assert.deepEqual(post.zh_cn.content[0][0], { tag: "at", user_id: "ou_user" });
  assert.match(post.zh_cn.content[0][1].text, /明天上线/);

  const email = JSON.parse(forwardCalls[0].init.body);
  assert.equal(email.subject.startsWith("[auto] "), true);
  assert.ok(email.text.includes("auto_answer: 明天上线。"));
});

test("falls back to the plain acknowledgement when the LLM asks for a decision", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createLlmWorker({ content: "NEEDS_DECISION", replies, forwardCalls });
  const env = llmWorkerEnv();

  const response = await send(
    worker,
    messagePayload({ text: "要不要加个功能", messageId: "om_decide", eventId: "evt_decide" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].msg_type, "text");
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  const email = JSON.parse(forwardCalls[0].init.body);
  assert.equal(email.subject.startsWith("[auto] "), false);
  assert.equal(email.text.includes("auto_answer:"), false);
});

test("posts the unsure reply for the asker when the LLM is unsure", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createLlmWorker({ content: "UNSURE", replies, forwardCalls });
  const env = llmWorkerEnv();

  const response = await send(
    worker,
    messagePayload({ text: "什么时候上线", messageId: "om_unsure", eventId: "evt_unsure" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(replies[0].msg_type, "post");
  assert.match(JSON.parse(replies[0].content).zh_cn.content[0][1].text, /这个问题老三稍后回复你。/);
  const email = JSON.parse(forwardCalls[0].init.body);
  assert.equal(email.subject.startsWith("[auto] "), false);
  assert.equal(email.text.includes("auto_answer:"), false);
});

test("falls back to the plain acknowledgement when the LLM request fails", async () => {
  const replies = [];
  const forwardCalls = [];
  const worker = createLlmWorker({ status: 500, replies, forwardCalls });
  const env = llmWorkerEnv();

  const response = await send(
    worker,
    messagePayload({ text: "什么时候上线", messageId: "om_llmfail", eventId: "evt_llmfail" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  const email = JSON.parse(forwardCalls[0].init.body);
  assert.equal(email.subject.startsWith("[auto] "), false);
  assert.equal(email.text.includes("auto_answer:"), false);
});

test("stops auto-answering once the daily LLM limit is reached", async () => {
  const replies = [];
  const forwardCalls = [];
  const llmCalls = [];
  const worker = createLlmWorker({ content: "明天上线。", llmCalls, replies, forwardCalls });
  const env = llmWorkerEnv({ LLM_DAILY_LIMIT: "1" });
  await env.BOT_KV.put(autoLlmCountKey(), "1");

  const response = await send(
    worker,
    messagePayload({ text: "什么时候上线", messageId: "om_limit", eventId: "evt_limit" }),
    env,
  );

  assert.equal(response.status, 200);
  assert.equal(llmCalls.length, 0);
  assert.equal(replies.length, 1);
  assert.equal(JSON.parse(replies[0].content).text, ACK_SUCCESS_TEXT);
  assert.equal(await env.BOT_KV.get(autoLlmCountKey()), "1");
});
