import assert from "node:assert/strict";
import test from "node:test";
import { dedupeKeys } from "../src/dedupe.mjs";
import { HELP_MESSAGE, PROGRESS_MESSAGE } from "../src/commands.mjs";
import { signOutboundText } from "../src/config.mjs";
import { hmacSha256Hex } from "../src/github.mjs";
import { createWorker } from "../src/worker.mjs";

const encoder = new TextEncoder();

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

async function encryptedEnvelope(payload, encryptKey) {
  const keyDigest = await crypto.subtle.digest("SHA-256", encoder.encode(encryptKey));
  const key = await crypto.subtle.importKey("raw", keyDigest, { name: "AES-CBC" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, encoder.encode(JSON.stringify(payload))));
  const bytes = new Uint8Array(iv.length + ciphertext.length);
  bytes.set(iv);
  bytes.set(ciphertext, iv.length);
  return JSON.stringify({ encrypt: Buffer.from(bytes).toString("base64") });
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
  chatId = "oc_chat",
  senderOpenId = "ou_user",
  senderName = "老王",
} = {}) {
  return {
    schema: "2.0",
    header: { event_id: eventId, event_type: eventType, token },
    event: {
      sender: { sender_type: senderType, sender_id: { open_id: senderOpenId, name: senderName } },
      message: {
        message_id: messageId,
        chat_id: chatId,
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

function makeGithubFetch({
  failReplyCount = 0,
  replies = [],
  calls = [],
  comments = [],
  issues = [],
  issue = {
    number: 20,
    title: "主任务卡",
    body: "## 任务\n- [ ] 新定价方案\n- [ ] 定域名\n## 卡点\n- 支付：Stripe",
  },
  closedPulls = [
    {
      title: "Public /examples sample pages from existing HD clips (#20) (#34)",
      merged_at: "2026-10-15T08:00:53Z",
      labels: [],
    },
  ],
  openPulls = [{ title: "Bind Feishu bot KV namespace", merged_at: null, labels: [] }],
} = {}) {
  const feishu = makeFeishuFetch({ failReplyCount, replies, calls });
  return async (url, init = {}) => {
    const href = String(url);
    if (href.includes("api.github.com") && href.includes("/comments")) {
      calls.push({ url, init });
      return Response.json(comments);
    }
    if (href.includes("api.github.com") && href.includes("/pulls")) {
      calls.push({ url, init });
      const state = new URL(href).searchParams.get("state") || "open";
      return Response.json(state === "closed" ? closedPulls : openPulls);
    }
    if (href.includes("api.github.com") && /\/issues\/\d+$/.test(href.split("?")[0]) && init.method !== "POST") {
      calls.push({ url, init });
      return Response.json(issue);
    }
    if (href.includes("api.github.com") && /\/issues$/.test(href) && init.method === "POST") {
      calls.push({ url, init });
      const posted = JSON.parse(init.body);
      const created = {
        number: 21,
        html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
        title: posted.title,
        body: posted.body,
      };
      issues.push(created);
      return Response.json(created, { status: 201 });
    }
    return feishu(url, init);
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

test("accepts an encrypted URL verification handshake without signature headers", async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error("unexpected fetch"); } });
  const env = makeEnv();
  env.FEISHU_ENCRYPT_KEY = "encrypt-test-key";
  const request = new Request("https://worker.test/feishu/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await encryptedEnvelope({
      type: "url_verification",
      token: "verify-token",
      challenge: "Encrypted-Challenge",
    }, env.FEISHU_ENCRYPT_KEY),
  });

  const response = await worker.fetch(request, env, {});
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { challenge: "Encrypted-Challenge" });

  const invalidTokenRequest = new Request("https://worker.test/feishu/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await encryptedEnvelope({
      type: "url_verification",
      token: "wrong-token",
      challenge: "Must-Not-Be-Echoed",
    }, env.FEISHU_ENCRYPT_KEY),
  });
  const invalidTokenResponse = await worker.fetch(invalidTokenRequest, env, {});
  assert.equal(invalidTokenResponse.status, 401);
});

test("rejects a callback with the wrong verification token", async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error("unexpected fetch"); } });
  const response = await send(worker, messagePayload({ token: "wrong-token" }), makeEnv());

  assert.equal(response.status, 401);
});

test("rejects an unsigned plaintext message when an Encrypt Key is configured", async () => {
  const calls = [];
  const worker = createWorker({ fetchImpl: makeFeishuFetch({ calls }) });
  const env = makeEnv();
  env.FEISHU_ENCRYPT_KEY = "encrypt-test-key";
  const response = await send(worker, messagePayload(), env);

  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("routes progress, URL, health, and unsupported commands to safe text replies", async () => {
  const cases = [
    ["及时汇报项目进度", signOutboundText(PROGRESS_MESSAGE)],
    ["网址", signOutboundText("https://dreamutopia-clone.pages.dev")],
    ["健康", "健康检查：HTTP 200；ok=true；authReady=false"],
    ["做个视频", signOutboundText(HELP_MESSAGE)],
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

test("bounds a slow health command below Feishu's callback deadline", async () => {
  const worker = createWorker({
    callbackBudgetMs: 100,
    fetchImpl: async (url) => {
      if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
        return Response.json({ code: 0, tenant_access_token: "tenant-test-token", expire: 7200 });
      }
      if (url === "https://dreamutopia-clone.pages.dev/api/health") {
        return new Promise((resolve) => setTimeout(() => resolve(Response.json({ ok: true })), 300));
      }
      if (url.includes("/im/v1/messages/") && url.endsWith("/reply")) {
        return Response.json({ code: 0, data: { message_id: "om_reply" } });
      }
      throw new Error("Unexpected outbound request");
    },
  });
  const startedAt = performance.now();
  const response = await send(worker, messagePayload({ text: "健康" }), makeEnv());
  const elapsedMs = performance.now() - startedAt;

  assert.equal(response.status, 503);
  assert.ok(elapsedMs < 250, `callback took ${elapsedMs}ms`);
});

test("bounds streaming request body reads by the callback deadline", async () => {
  const worker = createWorker({
    callbackBudgetMs: 40,
    fetchImpl: async () => { throw new Error("unexpected fetch"); },
  });
  let delayedEnqueue;
  const body = new ReadableStream({
    start(controller) {
      delayedEnqueue = setTimeout(() => {
        controller.enqueue(encoder.encode(JSON.stringify({
          type: "url_verification",
          token: "verify-token",
          challenge: "late-body",
        })));
        controller.close();
      }, 200);
    },
    cancel() {
      clearTimeout(delayedEnqueue);
    },
  });
  const request = new Request("https://worker.test/feishu/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    duplex: "half",
  });
  const startedAt = performance.now();
  const response = await worker.fetch(request, makeEnv(), {});
  const elapsedMs = performance.now() - startedAt;

  assert.equal(response.status, 503);
  assert.ok(elapsedMs < 150, `callback took ${elapsedMs}ms`);
});

test("rejects callback bodies larger than one mebibyte", async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error("unexpected fetch"); } });
  const request = new Request("https://worker.test/feishu/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new Uint8Array(1024 * 1024 + 1),
  });

  assert.equal((await worker.fetch(request, makeEnv(), {})).status, 413);
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
  assert.equal(JSON.parse(replies[0].content).text, signOutboundText("https://dreamutopia-clone.pages.dev"));
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

test("replies to 进度 with a website-progress summary and no PR/SHA trackers", async () => {
  const replies = [];
  const worker = createWorker({
    fetchImpl: makeGithubFetch({ replies }),
  });
  const env = makeEnv();
  assert.equal((await send(worker, messagePayload({ text: "进度", messageId: "om_progress_gh" }), env)).status, 200);
  const replyText = JSON.parse(replies[0].content).text;
  assert.match(replyText, /网站进度/);
  assert.match(replyText, /案例页换成我们自己的样片/);
  assert.match(replyText, /还没做/);
  assert.match(replyText, /Grok Bot · AI视频项目专属机器人 三儿/);
  assert.doesNotMatch(replyText, /老三/);
  assert.doesNotMatch(replyText, /#\d+/);
  assert.doesNotMatch(replyText, /\b[0-9a-f]{7,40}\b/i);
  assert.equal((replyText.match(/详情/g) || []).length, 1);
});

test("creates a GitHub issue from a group 需求 mention and replies with the link", async () => {
  const replies = [];
  const issues = [];
  const worker = createWorker({ fetchImpl: makeGithubFetch({ replies, issues }) });
  const env = makeEnv();
  env.GITHUB_TOKEN = "ghs_test_token";
  env.ALLOWED_CHAT_IDS = "oc_chat";
  const payload = messagePayload({
    chatType: "group",
    text: "@_bot_1 需求：落地页要加中文",
    mentions: [{ key: "@_bot_1", id: { open_id: "ou_bot" } }],
    messageId: "om_request",
    eventId: "evt-request",
  });

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal(issues.length, 1);
  assert.match(issues[0].title, /落地页要加中文/);
  assert.doesNotMatch(issues[0].title, /老王|ou_user|oc_chat/);
  assert.doesNotMatch(issues[0].body, /老王|ou_user|oc_chat/);
  assert.match(JSON.parse(replies[0].content).text, /issues\/21/);
  assert.equal(await env.BOT_KV.get("feishu:request-issue:om_request"), "21");
});

test("rejects 需求 from a group that is not on the allowlist", async () => {
  const replies = [];
  const issues = [];
  const worker = createWorker({ fetchImpl: makeGithubFetch({ replies, issues }) });
  const env = makeEnv();
  env.GITHUB_TOKEN = "ghs_test_token";
  const payload = messagePayload({
    chatType: "group",
    chatId: "oc_unknown",
    text: "@_bot_1 需求：不该建单",
    mentions: [{ key: "@_bot_1", id: { open_id: "ou_bot" } }],
    messageId: "om_denied",
    eventId: "evt-denied",
  });

  assert.equal((await send(worker, payload, env)).status, 200);
  assert.equal(issues.length, 0);
  assert.match(JSON.parse(replies[0].content).text, /未授权/);
});

test("posts a close notice through the GitHub webhook and ignores a duplicate delivery", async () => {
  const replies = [];
  const kv = fakeKv();
  await kv.put("github:issue-map:21", JSON.stringify({
    chatId: "oc_chat",
    messageId: "om_request",
    requester: "老王",
  }));
  const env = makeEnv(kv);
  env.GITHUB_WEBHOOK_SECRET = "webhook-secret";
  const worker = createWorker({ fetchImpl: makeFeishuFetch({ replies }) });
  const closed = {
    action: "closed",
    issue: {
      number: 21,
      title: "飞书需求：落地页要加中文",
      html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
      closed_at: "2026-10-15T12:00:00Z",
    },
  };
  const raw = JSON.stringify(closed);
  const digest = await hmacSha256Hex(env.GITHUB_WEBHOOK_SECRET, raw);
  const headers = {
    "content-type": "application/json",
    "X-Hub-Signature-256": `sha256=${digest}`,
    "X-GitHub-Event": "issues",
    "X-GitHub-Delivery": "delivery-worker-1",
  };
  const post = () => worker.fetch(new Request("https://worker.test/github/webhook", {
    method: "POST",
    headers,
    body: raw,
  }), env, {});

  assert.equal((await post()).status, 200);
  assert.equal((await post()).status, 200);
  assert.equal(replies.length, 1);
  assert.match(JSON.parse(replies[0].content).text, /已关闭/);
});

test("returns 503 for GitHub webhooks when the signing secret is missing", async () => {
  const worker = createWorker({ fetchImpl: async () => { throw new Error("unexpected fetch"); } });
  const response = await worker.fetch(new Request("https://worker.test/github/webhook", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  }), makeEnv(), {});
  assert.equal(response.status, 503);
});
