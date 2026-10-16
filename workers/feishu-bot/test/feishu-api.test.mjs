import assert from "node:assert/strict";
import test from "node:test";
import { signOutboundText } from "../src/config.mjs";
import { buildMentionPost, getBotOpenId, getTenantAccessToken, getUserName, mentionText, replyToMessage, replyUuid } from "../src/feishu-api.mjs";

function fakeKv(seed = {}) {
  const values = new Map(Object.entries(seed));
  const puts = [];
  return {
    values,
    puts,
    async get(key) {
      return values.get(key) ?? null;
    },
    async put(key, value, options) {
      puts.push({ key, value, options });
      values.set(key, value);
    },
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("uses a cached tenant token when more than five minutes remain", async () => {
  const kv = fakeKv({ "feishu:tenant_access_token": JSON.stringify({ token: "cached-token", expiresAt: 1_400_001 }) });
  let fetchCalls = 0;

  const token = await getTenantAccessToken({
    kv,
    appId: "test-app-id",
    appSecret: "test-app-secret",
    fetchImpl: async () => { fetchCalls += 1; throw new Error("unexpected fetch"); },
    now: () => 1_000_000,
  });

  assert.equal(token, "cached-token");
  assert.equal(fetchCalls, 0);
});

test("refreshes a token when exactly five minutes remain and caches absolute expiry", async () => {
  const kv = fakeKv({ "feishu:tenant_access_token": JSON.stringify({ token: "old-token", expiresAt: 1_300_000 }) });
  let request;
  const token = await getTenantAccessToken({
    kv,
    appId: "test-app-id",
    appSecret: "test-app-secret",
    now: () => 1_000_000,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return jsonResponse({ code: 0, tenant_access_token: "new-token", expire: 7200 });
    },
  });

  assert.equal(token, "new-token");
  assert.equal(request.url, "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal");
  assert.equal(request.init.method, "POST");
  assert.deepEqual(JSON.parse(request.init.body), { app_id: "test-app-id", app_secret: "test-app-secret" });
  assert.deepEqual(JSON.parse(kv.values.get("feishu:tenant_access_token")), {
    token: "new-token",
    expiresAt: 8_200_000,
  });
});

test("does not fall back to an expired cached token when refresh fails", async () => {
  const kv = fakeKv({ "feishu:tenant_access_token": JSON.stringify({ token: "expired-token", expiresAt: 999_999 }) });

  await assert.rejects(() => getTenantAccessToken({
    kv,
    appId: "test-app-id",
    appSecret: "test-app-secret",
    now: () => 1_000_000,
    fetchImpl: async () => new Response("", { status: 503 }),
  }));
});

test("loads and caches the bot's own open_id for 24 hours", async () => {
  const kv = fakeKv();
  let fetchCalls = 0;
  const fetchImpl = async (url, init) => {
    fetchCalls += 1;
    assert.equal(url, "https://open.feishu.cn/open-apis/bot/v3/info");
    assert.equal(init.headers.Authorization, "Bearer tenant-token");
    return jsonResponse({ code: 0, bot: { open_id: "ou_bot" } });
  };

  assert.equal(await getBotOpenId({ kv, token: "tenant-token", fetchImpl }), "ou_bot");
  assert.equal(await getBotOpenId({ kv, token: "tenant-token", fetchImpl }), "ou_bot");
  assert.equal(fetchCalls, 1);
  assert.deepEqual(kv.puts, [{
    key: "feishu:bot:open_id",
    value: "ou_bot",
    options: { expirationTtl: 86400 },
  }]);
});

test("derives a stable RFC 4122 UUIDv5 from each message ID", async () => {
  const first = await replyUuid("om_message");
  const second = await replyUuid("om_message");
  const other = await replyUuid("om_other");

  assert.equal(first, second);
  assert.notEqual(first, other);
  assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("replies with text and the deterministic uuid in the Feishu request body", async () => {
  let request;
  await replyToMessage({
    token: "tenant-token",
    messageId: "om/message-1",
    text: "回复内容",
    fetchImpl: async (url, init) => {
      request = { url, init };
      return jsonResponse({ code: 0, data: { message_id: "om_reply" } });
    },
  });

  assert.equal(request.url, "https://open.feishu.cn/open-apis/im/v1/messages/om%2Fmessage-1/reply");
  assert.equal(request.init.method, "POST");
  assert.equal(request.init.headers.Authorization, "Bearer tenant-token");
  const body = JSON.parse(request.init.body);
  assert.equal(body.msg_type, "text");
  assert.deepEqual(JSON.parse(body.content), { text: signOutboundText("回复内容") });
  assert.equal(body.uuid, await replyUuid("om/message-1"));
});

test("throws when the Feishu reply API rejects the request", async () => {
  await assert.rejects(() => replyToMessage({
    token: "tenant-token",
    messageId: "om_message",
    text: "回复内容",
    fetchImpl: async () => jsonResponse({ code: 11223, msg: "no permission" }),
  }));
});

test("builds a Feishu post that mentions each valid open_id before the text", () => {
  assert.deepEqual(buildMentionPost({ text: "收到，老三正在处理", mentionOpenIds: ["ou_user"] }), {
    zh_cn: {
      title: "",
      content: [[
        { tag: "at", user_id: "ou_user" },
        { tag: "text", text: " 收到，老三正在处理" },
      ]],
    },
  });
});

test("drops invalid mention ids and de-duplicates the survivors in order", () => {
  const post = buildMentionPost({
    text: "hi",
    mentionOpenIds: ["ou_a", "ou_b", "not-an-open-id", "ou_a", null, "oc_chat"],
  });

  assert.deepEqual(post.zh_cn.content[0].slice(0, -1), [
    { tag: "at", user_id: "ou_a" },
    { tag: "at", user_id: "ou_b" },
  ]);
  assert.deepEqual(post.zh_cn.content[0].at(-1), { tag: "text", text: " hi" });
});

test("returns null from buildMentionPost when no mention id survives filtering", () => {
  for (const mentionOpenIds of [undefined, [], ["not-an-open-id"], ["oc_chat"], "ou_user"]) {
    assert.equal(buildMentionPost({ text: "hi", mentionOpenIds }), null);
  }
});

test("builds the plain-text mention form for each valid open_id", () => {
  assert.equal(mentionText("hi", ["ou_a", "ou_b"]), `<at user_id="ou_a"></at> <at user_id="ou_b"></at> hi`);
  assert.equal(mentionText("hi", ["bad", "ou_a", "ou_a"]), `<at user_id="ou_a"></at> hi`);
  assert.equal(mentionText("hi", []), "hi");
});

test("replies with a post mentioning the sender and appends no signature", async () => {
  let request;
  await replyToMessage({
    token: "tenant-token",
    messageId: "om_message",
    text: "收到，老三正在处理",
    mentionOpenIds: ["ou_user"],
    fetchImpl: async (url, init) => {
      request = { url, init };
      return jsonResponse({ code: 0, data: { message_id: "om_reply" } });
    },
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.msg_type, "post");
  assert.deepEqual(JSON.parse(body.content), {
    zh_cn: {
      title: "",
      content: [[
        { tag: "at", user_id: "ou_user" },
        { tag: "text", text: " 收到，老三正在处理" },
      ]],
    },
  });
  assert.doesNotMatch(body.content, /Grok Bot/);
});

test("falls back to a signed text reply when no mention id is valid", async () => {
  let request;
  await replyToMessage({
    token: "tenant-token",
    messageId: "om_message",
    text: "回复内容",
    mentionOpenIds: ["not-an-open-id"],
    fetchImpl: async (url, init) => {
      request = { url, init };
      return jsonResponse({ code: 0, data: { message_id: "om_reply" } });
    },
  });

  const body = JSON.parse(request.init.body);
  assert.equal(body.msg_type, "text");
  assert.deepEqual(JSON.parse(body.content), { text: signOutboundText("回复内容") });
});

test("uses the configured bot open_id without touching KV or the bot API", async () => {
  const kv = fakeKv();
  let fetchCalls = 0;

  const openId = await getBotOpenId({
    kv,
    token: "tenant-token",
    env: { FEISHU_BOT_OPEN_ID: "ou_configured" },
    fetchImpl: async () => { fetchCalls += 1; throw new Error("unexpected fetch"); },
  });

  assert.equal(openId, "ou_configured");
  assert.equal(fetchCalls, 0);
  assert.deepEqual(kv.puts, []);
});

test("loads and caches a sender name from the contact API", async () => {
  const kv = fakeKv();
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return jsonResponse({ code: 0, data: { user: { name: "老王" } } });
  };

  assert.equal(await getUserName({ kv, token: "tenant-token", openId: "ou_user", fetchImpl }), "老王");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://open.feishu.cn/open-apis/contact/v3/users/ou_user?user_id_type=open_id");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tenant-token");

  assert.equal(await getUserName({ kv, token: "tenant-token", openId: "ou_user", fetchImpl }), "老王");
  assert.equal(calls.length, 1);
  assert.deepEqual(kv.puts, [{
    key: "feishu:user_name:ou_user",
    value: "老王",
    options: { expirationTtl: 86400 },
  }]);
});

test("returns an empty sender name instead of throwing when the contact lookup fails", async () => {
  assert.equal(await getUserName({
    kv: fakeKv(),
    token: "tenant-token",
    openId: "ou_user",
    fetchImpl: async () => new Response("", { status: 500 }),
  }), "");
  assert.equal(await getUserName({
    kv: fakeKv(),
    token: "tenant-token",
    openId: "ou_user",
    fetchImpl: async () => jsonResponse({ code: 41050, msg: "no permission" }),
  }), "");
  assert.equal(await getUserName({
    kv: fakeKv(),
    token: "tenant-token",
    openId: "",
    fetchImpl: async () => { throw new Error("unexpected fetch"); },
  }), "");
});
