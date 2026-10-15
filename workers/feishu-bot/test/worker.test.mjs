import assert from "node:assert/strict";
import test from "node:test";
import { dedupeKeys } from "../src/dedupe.mjs";
import { HELP_MESSAGE, PROGRESS_MESSAGE } from "../src/commands.mjs";
import { createWorker } from "../src/worker.mjs";

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

function messagePayload({
  eventId = "evt-1",
  messageId = "om_1",
  text = "进度",
  chatType = "p2p",
  eventType = "im.message.receive_v1",
  senderType = "user",
  messageType = "text",
  mentions = [],
  token = "verify-token",
} = {}) {
  return {
    schema: "2.0",
    header: { event_id: eventId, event_type: eventType, token },
    event: {
      sender: { sender_type: senderType },
      message: {
        message_id: messageId,
        chat_type: chatType,
        message_type: messageType,
        content: JSON.stringify({ text }),
        mentions,
      },
    },
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

function makeFeishuFetch({ failReplyCount = 0, replies = [], calls = [] } = {}) {
  return async (url, init = {}) => {
    calls.push({ url, init });
    if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
      return Response.json({ code: 0, tenant_access_token: "tenant-test-token", expire: 7200 });
    }
    if (url.endsWith("/bot/v3/info")) {
      return Response.json({ code: 0, bot: { open_id: "ou_bot" } });
    }
    if (url === "https://dreamutopia-clone.pages.dev/api/health") {
      return Response.json({ ok: true, authReady: false, generationEnabled: false });
    }
    if (url.includes("/im/v1/messages/") && url.endsWith("/reply")) {
      replies.push(JSON.parse(init.body));
      if (failReplyCount > 0) {
        failReplyCount -= 1;
        return new Response("", { status: 503 });
      }
      return Response.json({ code: 0, data: { message_id: "om_reply" } });
    }
    throw new Error("Unexpected outbound request");
  };
}

async function send(worker, payload, env, path = "/feishu/events", method = "POST") {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(payload) : undefined,
  });
  return worker.fetch(request, env, {});
}

test("serves only POST /feishu/events", async () => {
  let fetchCalls = 0;
  const worker = createWorker({ fetchImpl: async () => { fetchCalls += 1; throw new Error("unexpected fetch"); } });
  const env = makeEnv();

  assert.equal((await send(worker, {}, env, "/other")).status, 404);
  assert.equal((await send(worker, {}, env, "/feishu/events", "GET")).status, 404);
  assert.equal(fetchCalls, 0);
});

test("returns the exact challenge value after validating the URL verification token", async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error("unexpected fetch"); } });
  const env = makeEnv();
  const response = await send(worker, {
    type: "url_verification",
    token: "verify-token",
    challenge: "Challenge-With Exact Case",
  }, env);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
  assert.deepEqual(await response.json(), { challenge: "Challenge-With Exact Case" });
});

test("rejects a callback with the wrong verification token", async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error("unexpected fetch"); } });
  const response = await send(worker, messagePayload({ token: "wrong-token" }), makeEnv());

  assert.equal(response.status, 401);
});

test("routes progress, URL, health, and unsupported commands to safe text replies", async () => {
  const cases = [
    ["及时汇报项目进度", PROGRESS_MESSAGE],
    ["网址", "https://dreamutopia-clone.pages.dev"],
    ["健康", "健康检查：HTTP 200；ok=true；authReady=false"],
    ["做个视频", HELP_MESSAGE],
  ];

  for (const [text, expected] of cases) {
    const replies = [];
    const calls = [];
    const worker = createWorker({ fetchImpl: makeFeishuFetch({ replies, calls }) });
    const response = await send(worker, messagePayload({ text, messageId: `om_${text}` }), makeEnv());
    assert.equal(response.status, 200);
    const replyText = JSON.parse(replies[0].content).text;
    if (text === "健康") assert.ok(replyText.startsWith(expected));
    else assert.equal(replyText, expected);
    assert.equal(replies[0].msg_type, "text");
    assert.equal(calls.some(({ url }) => /\/api\/(generate|upload)(?:\?|$)/.test(url)), false);
  }
});

test("replies to a group message only when the mention matches the bot open_id", async () => {
  const replies = [];
  const worker = createWorker({ fetchImpl: makeFeishuFetch({ replies }) });
  const env = makeEnv();
  const personMention = messagePayload({
    chatType: "group",
    mentions: [{ key: "@_person", id: { open_id: "ou_person" } }],
  });
  const botMention = messagePayload({
    eventId: "evt-2",
    messageId: "om_2",
    chatType: "group",
    text: "@_bot_1 网址",
    mentions: [{ key: "@_bot_1", id: { open_id: "ou_bot" } }],
  });

  assert.equal((await send(worker, personMention, env)).status, 200);
  assert.equal(replies.length, 0);
  assert.equal((await send(worker, botMention, env)).status, 200);
  assert.equal(JSON.parse(replies[0].content).text, "https://dreamutopia-clone.pages.dev");
});

test("deduplicates a repeated event and a repeated message with another event_id", async () => {
  const replies = [];
  const kv = fakeKv();
  const worker = createWorker({ fetchImpl: makeFeishuFetch({ replies }) });
  const env = makeEnv(kv);
  const original = messagePayload();
  const duplicateMessage = messagePayload({ eventId: "evt-2", messageId: "om_1" });

  assert.equal((await send(worker, original, env)).status, 200);
  assert.equal(kv.writes.filter(({ key }) => key.startsWith("feishu:processed:")).length, 2);
  assert.equal((await send(worker, original, env)).status, 200);
  assert.equal((await send(worker, duplicateMessage, env)).status, 200);
  assert.equal(replies.length, 1);
});

test("leaves dedupe markers unwritten when a reply fails so the callback can retry", async () => {
  const kv = fakeKv();
  const worker = createWorker({ fetchImpl: makeFeishuFetch({ failReplyCount: 1 }) });
  const env = makeEnv(kv);
  const payload = messagePayload();
  const [eventKey, messageKey] = dedupeKeys("evt-1", "om_1");

  const response = await send(worker, payload, env);
  assert.equal(response.status, 503);
  assert.equal(await kv.get(eventKey), null);
  assert.equal(await kv.get(messageKey), null);
});

test("retries a failed reply using the same deterministic reply UUID", async () => {
  const replies = [];
  const worker = createWorker({ fetchImpl: makeFeishuFetch({ failReplyCount: 1, replies }) });
  const env = makeEnv();
  const payload = messagePayload();

  assert.equal((await send(worker, payload, env)).status, 503);
  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal(replies.length, 2);
  assert.equal(replies[0].uuid, replies[1].uuid);
});

test("acknowledges unrelated event types without making API calls", async () => {
  let fetchCalls = 0;
  const worker = createWorker({ fetchImpl: async () => { fetchCalls += 1; throw new Error("unexpected fetch"); } });
  const response = await send(worker, messagePayload({ eventType: "im.message.reaction_v1" }), makeEnv());

  assert.equal(response.status, 200);
  assert.equal(fetchCalls, 0);
});
