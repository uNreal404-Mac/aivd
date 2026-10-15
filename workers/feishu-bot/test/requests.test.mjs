import assert from "node:assert/strict";
import test from "node:test";
import { replyUuid } from "../src/feishu-api.mjs";
import {
  ISSUE_MAP_PREFIX,
  REQUEST_ISSUE_PREFIX,
  buildIssueContent,
  handleFeishuRequest,
  handleGithubWebhook,
  parseRequestBody,
  PUBLIC_ISSUE_NOTICE,
  sanitizeRequestText,
} from "../src/requests.mjs";
import { DEFAULT_SIGNATURE } from "../src/config.mjs";

function assertRedacted(sample, label = sample) {
  const out = sanitizeRequestText(`请看 ${sample} 再评估`);
  assert.doesNotMatch(out, new RegExp(sample.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${label} must be redacted`);
  assert.match(out, /已脱敏/, `${label} must use a redaction marker`);
}

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

const encoder = new TextEncoder();

async function signedGithubRequest(payload, secret, headers = {}) {
  const rawBody = encoder.encode(typeof payload === "string" ? payload : JSON.stringify(payload));
  const { hmacSha256Hex } = await import("../src/github.mjs");
  const digest = await hmacSha256Hex(secret, rawBody);
  return {
    rawBody,
    headers: new Headers({
      "X-Hub-Signature-256": `sha256=${digest}`,
      "X-GitHub-Event": "issues",
      "X-GitHub-Delivery": "delivery-1",
      ...headers,
    }),
  };
}

test("parses 需求 with a fullwidth or halfwidth colon and ignores other text", () => {
  assert.equal(parseRequestBody("需求：落地页要中文"), "落地页要中文");
  assert.equal(parseRequestBody("需求: 先出报价"), "先出报价");
  assert.equal(parseRequestBody("  需求：  多行\n第二行"), "多行\n第二行");
  assert.equal(parseRequestBody("需求"), null);
  assert.equal(parseRequestBody("进度"), null);
});

test("builds a public issue without requester name, open_id, or chat_id", () => {
  const content = buildIssueContent({
    requester: { name: "老王", openId: "ou_user" },
    chatId: "oc_chat",
    messageId: "om_msg",
    body: "落地页要加中文",
  });
  assert.equal(content.title, "飞书需求：落地页要加中文");
  assert.match(content.body, /落地页要加中文/);
  assert.doesNotMatch(content.title, /老王|ou_user|oc_chat/);
  assert.doesNotMatch(content.body, /老王|ou_user|oc_chat/);
  assert.deepEqual(content.labels, ["feishu-request"]);
});

test("redacts phones, emails, and money amounts before writing the public issue", () => {
  const content = buildIssueContent({
    requester: { name: "老王", openId: "ou_user" },
    chatId: "oc_chat",
    body: "联系 13812345678 / user@example.com，预算 5000元 或 $99.50 / ¥1,200。",
  });
  assert.doesNotMatch(content.title, /13812345678|user@example\.com|5000元|\$99\.50|¥1,200/);
  assert.doesNotMatch(content.body, /13812345678|user@example\.com|5000元|\$99\.50|¥1,200/);
  assert.match(content.body, /已脱敏/);
});

test("redacts money written as 5000 美元", () => {
  assertRedacted("5000 美元");
});

test("redacts money written as 2万", () => {
  assertRedacted("2万");
});

test("redacts money written as 3.5万", () => {
  assertRedacted("3.5万");
});

test("redacts money written as 5k", () => {
  assertRedacted("5k");
});

test("redacts money written as 500USD", () => {
  assertRedacted("500USD");
});

test("redacts Chinese-numeral money 两万块", () => {
  assertRedacted("两万块");
});

test("redacts Chinese-numeral money 三千元", () => {
  assertRedacted("三千元");
});

test("redacts Chinese-numeral money 十万", () => {
  assertRedacted("十万");
});

test("redacts landline 021-12345678 with a dash", () => {
  assertRedacted("021-12345678");
});

test("redacts landline 02112345678 without a dash", () => {
  assertRedacted("02112345678");
});

test("redacts landline 0755-1234567 with a 4-digit area code", () => {
  assertRedacted("0755-1234567");
});

test("redacts 5千刀 including the trailing 刀", () => {
  const out = sanitizeRequestText("预算 5千刀");
  assert.doesNotMatch(out, /5千刀/);
  assert.doesNotMatch(out, /刀/);
  assert.match(out, /已脱敏-金额/);
});

test("does not treat 2万次播放 as money", () => {
  const out = sanitizeRequestText("目标 2万次播放");
  assert.match(out, /2万次播放/);
  assert.doesNotMatch(out, /已脱敏-金额/);
});

test("leaves 1080p, 9:16, 30秒 and dates alone", () => {
  const out = sanitizeRequestText("规格 1080p、9:16、30秒，日期 2026-10-15");
  assert.match(out, /1080p/);
  assert.match(out, /9:16/);
  assert.match(out, /30秒/);
  assert.match(out, /2026-10-15/);
  assert.doesNotMatch(out, /已脱敏/);
});

test("需求 replies warn that the issue is public and keep the signature", async () => {
  const text = await handleFeishuRequest({
    kv: fakeKv(),
    env: { GITHUB_TOKEN: "ghs_test_token", ALLOWED_CHAT_IDS: "oc_chat" },
    selected: { messageId: "om_notice", text: "需求：落地页要加中文" },
    context: { chatId: "oc_chat", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl: async () => Response.json({
      number: 21,
      html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
      title: "飞书需求：落地页要加中文",
    }, { status: 201 }),
  });
  assert.match(text, new RegExp(PUBLIC_ISSUE_NOTICE));
  assert.match(text, new RegExp(DEFAULT_SIGNATURE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("rejects 需求 from unknown group chats and fail-closes when the allowlist is empty", async () => {
  let githubCalls = 0;
  const fetchImpl = async () => {
    githubCalls += 1;
    throw new Error("unknown chats must not create issues");
  };
  const denied = await handleFeishuRequest({
    kv: fakeKv(),
    env: { GITHUB_TOKEN: "ghs_test_token" },
    selected: { messageId: "om_denied", chatType: "group", text: "需求：落地页要加中文" },
    context: { chatId: "oc_unknown", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl,
  });
  assert.equal(githubCalls, 0);
  assert.match(denied, /未授权|不允许|不接受/);

  const emptyAllowlist = await handleFeishuRequest({
    kv: fakeKv(),
    env: { GITHUB_TOKEN: "ghs_test_token", ALLOWED_CHAT_IDS: "" },
    selected: { messageId: "om_empty", chatType: "group", text: "需求：落地页要加中文" },
    context: { chatId: "oc_chat", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl,
  });
  assert.equal(githubCalls, 0);
  assert.match(emptyAllowlist, /未授权|不允许|不接受/);
});

test("creates a GitHub issue, stores the chat mapping, and returns the issue link", async () => {
  const kv = fakeKv();
  const githubPosts = [];
  const text = await handleFeishuRequest({
    kv,
    env: { GITHUB_TOKEN: "ghs_test_token", ALLOWED_CHAT_IDS: "oc_chat" },
    selected: { messageId: "om_1", text: "需求：落地页要加中文" },
    context: { chatId: "oc_chat", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl: async (url, init) => {
      githubPosts.push({ url, init });
      return Response.json({
        number: 21,
        html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
        title: "飞书需求：落地页要加中文",
      }, { status: 201 });
    },
  });

  assert.match(text, /https:\/\/github.com\/CharlesHarry7\/dreamutopia-clone\/issues\/21/);
  assert.equal(githubPosts.length, 1);
  const created = JSON.parse(githubPosts[0].init.body);
  assert.doesNotMatch(created.title, /老王|ou_user|oc_chat/);
  assert.doesNotMatch(created.body, /老王|ou_user|oc_chat/);
  const mapping = JSON.parse(await kv.get(`${ISSUE_MAP_PREFIX}21`));
  assert.equal(mapping.chatId, "oc_chat");
  assert.equal(mapping.messageId, "om_1");
  assert.equal(mapping.requester, "老王");
  assert.equal(await kv.get(`${REQUEST_ISSUE_PREFIX}om_1`), "21");
});

test("does not create a second issue when the same Feishu message is retried", async () => {
  const kv = fakeKv({
    [`${REQUEST_ISSUE_PREFIX}om_1`]: "21",
    [`${ISSUE_MAP_PREFIX}21`]: JSON.stringify({
      chatId: "oc_chat",
      messageId: "om_1",
      htmlUrl: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
    }),
  });
  let githubCalls = 0;
  const text = await handleFeishuRequest({
    kv,
    env: { GITHUB_TOKEN: "ghs_test_token", ALLOWED_CHAT_IDS: "oc_chat" },
    selected: { messageId: "om_1", text: "需求：落地页要加中文" },
    context: { chatId: "oc_chat", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl: async () => {
      githubCalls += 1;
      throw new Error("network should not be used");
    },
  });
  assert.equal(githubCalls, 0);
  assert.match(text, /issues\/21/);
});

test("rate-limits repeated 需求 from the same sender", async () => {
  const kv = fakeKv({ "rl:request:ou_user": "1" });
  let githubCalls = 0;
  const text = await handleFeishuRequest({
    kv,
    env: { GITHUB_TOKEN: "ghs_test_token", ALLOWED_CHAT_IDS: "oc_chat" },
    selected: { messageId: "om_2", text: "需求：再提一个" },
    context: { chatId: "oc_chat", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl: async () => {
      githubCalls += 1;
      throw new Error("rate limited requests must not hit GitHub");
    },
  });
  assert.equal(githubCalls, 0);
  assert.match(text, /频繁|稍后再试/);
});

test("asks for details instead of opening an empty issue", async () => {
  let githubCalls = 0;
  const text = await handleFeishuRequest({
    kv: fakeKv(),
    env: { GITHUB_TOKEN: "ghs_test_token" },
    selected: { messageId: "om_3", text: "需求：   " },
    context: { chatId: "oc_chat", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl: async () => {
      githubCalls += 1;
      throw new Error("empty requests must not hit GitHub");
    },
  });
  assert.equal(githubCalls, 0);
  assert.match(text, /需求：/);
});

test("notifies the original Feishu thread when a mapped issue is closed", async () => {
  const kv = fakeKv({
    [`${ISSUE_MAP_PREFIX}21`]: JSON.stringify({
      chatId: "oc_chat",
      messageId: "om_1",
      requester: "老王",
    }),
  });
  const replies = [];
  const secret = "webhook-secret";
  const closed = {
    action: "closed",
    issue: {
      number: 21,
      title: "飞书需求：落地页要加中文",
      html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
      closed_at: "2026-10-15T12:00:00Z",
    },
  };
  const request = await signedGithubRequest(closed, secret);
  const result = await handleGithubWebhook({
    ...request,
    kv,
    env: {
      GITHUB_WEBHOOK_SECRET: secret,
      FEISHU_APP_ID: "app",
      FEISHU_APP_SECRET: "secret",
    },
    fetchImpl: async (url, init) => {
      if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
        return Response.json({ code: 0, tenant_access_token: "tenant-test-token", expire: 7200 });
      }
      if (url.includes("/im/v1/messages/") && url.endsWith("/reply")) {
        replies.push(JSON.parse(init.body));
        return Response.json({ code: 0, data: { message_id: "om_reply" } });
      }
      throw new Error(`unexpected ${url}`);
    },
  });

  assert.equal(result.status, 200);
  assert.equal(replies.length, 1);
  const replyText = JSON.parse(replies[0].content).text;
  assert.match(replyText, /已关闭/);
  assert.match(replyText, /#21/);
  assert.match(replyText, /https:\/\/github.com\/CharlesHarry7\/dreamutopia-clone\/issues\/21/);
  assert.equal(replies[0].uuid, await replyUuid("closed:21:2026-10-15T12:00:00Z"));
  assert.equal(await kv.get("github:delivery:delivery-1"), "1");
  assert.ok(await kv.get("github:closed-notified:21:2026-10-15T12:00:00Z"));
});

test("dedupes a GitHub delivery and a repeated close for the same issue", async () => {
  const mapping = JSON.stringify({ chatId: "oc_chat", messageId: "om_1" });
  const kv = fakeKv({
    [`${ISSUE_MAP_PREFIX}21`]: mapping,
    "github:delivery:delivery-1": "1",
  });
  const secret = "webhook-secret";
  const closed = {
    action: "closed",
    issue: {
      number: 21,
      title: "飞书需求：落地页",
      html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
      closed_at: "2026-10-15T12:00:00Z",
    },
  };

  let feishuCalls = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
      return Response.json({ code: 0, tenant_access_token: "tenant-test-token", expire: 7200 });
    }
    if (url.includes("/im/v1/messages/")) {
      feishuCalls += 1;
      return Response.json({ code: 0, data: {} });
    }
    throw new Error(url);
  };

  const first = await signedGithubRequest(closed, secret, { "X-GitHub-Delivery": "delivery-1" });
  assert.equal((await handleGithubWebhook({ ...first, kv, env: { GITHUB_WEBHOOK_SECRET: secret }, fetchImpl })).status, 200);
  assert.equal(feishuCalls, 0);

  kv.values.set("github:closed-notified:21:2026-10-15T12:00:00Z", "1");
  const second = await signedGithubRequest(closed, secret, { "X-GitHub-Delivery": "delivery-2" });
  assert.equal((await handleGithubWebhook({ ...second, kv, env: { GITHUB_WEBHOOK_SECRET: secret }, fetchImpl })).status, 200);
  assert.equal(feishuCalls, 0);
});

test("rejects a GitHub webhook with a bad signature without side effects", async () => {
  const kv = fakeKv({ [`${ISSUE_MAP_PREFIX}21`]: JSON.stringify({ chatId: "oc_chat", messageId: "om_1" }) });
  let fetchCalls = 0;
  await assert.rejects(() => handleGithubWebhook({
    rawBody: encoder.encode(JSON.stringify({ action: "closed", issue: { number: 21 } })),
    headers: new Headers({
      "X-Hub-Signature-256": `sha256=${"ab".repeat(32)}`,
      "X-GitHub-Event": "issues",
      "X-GitHub-Delivery": "delivery-x",
    }),
    kv,
    env: { GITHUB_WEBHOOK_SECRET: "webhook-secret" },
    fetchImpl: async () => {
      fetchCalls += 1;
      throw new Error("no fetch");
    },
  }), /signature/i);
  assert.equal(fetchCalls, 0);
});
