import assert from "node:assert/strict";
import test from "node:test";
import { buildAcceptanceCard, buildDeployCard } from "../../../scripts/feishu-notify.mjs";
import { botConfig, DEFAULT_SIGNATURE, signOutboundText } from "../src/config.mjs";
import { hmacSha256Hex } from "../src/github.mjs";
import {
  ISSUE_MAP_PREFIX,
  handleFeishuRequest,
  handleGithubWebhook,
} from "../src/requests.mjs";
import { createWorker } from "../src/worker.mjs";

const REQUIRED_SIGNATURE = "Grok Bot · AI视频项目专属机器人 三儿";
const encoder = new TextEncoder();

function fakeKv(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    async get(key) { return values.get(key) ?? null; },
    async put(key, value, options) { values.set(key, value); return options; },
  };
}

function messagePayload({
  eventId = "evt-sign",
  messageId = "om_sign",
  text = "进度",
  chatType = "p2p",
  mentions = [],
  chatId = "oc_partner",
} = {}) {
  return {
    schema: "2.0",
    header: { event_id: eventId, event_type: "im.message.receive_v1", token: "verify-token" },
    event: {
      sender: { sender_type: "user", sender_id: { open_id: "ou_user", name: "老王" } },
      message: {
        message_id: messageId,
        chat_id: chatId,
        chat_type: chatType,
        message_type: "text",
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
    GITHUB_TOKEN: "ghs_test_token",
    ALLOWED_CHAT_IDS: "oc_partner",
  };
}

function collectFeishuFetch({ replies = [], comments = [] } = {}) {
  return async (url, init = {}) => {
    if (String(url).endsWith("/auth/v3/tenant_access_token/internal")) {
      return Response.json({ code: 0, tenant_access_token: "tenant-test-token", expire: 7200 });
    }
    if (String(url).endsWith("/bot/v3/info")) {
      return Response.json({ code: 0, bot: { open_id: "ou_bot" } });
    }
    if (String(url) === "https://dreamutopia-clone.pages.dev/api/health") {
      return Response.json({ ok: true, authReady: true, generationEnabled: false });
    }
    if (String(url).includes("api.github.com") && String(url).includes("/comments")) {
      return Response.json(comments);
    }
    if (String(url).includes("api.github.com") && String(url).includes("/pulls")) {
      const state = new URL(String(url)).searchParams.get("state") || "open";
      if (state === "closed") {
        return Response.json([
          {
            title: "Public /examples sample pages from existing HD clips (#20) (#34)",
            merged_at: "2026-10-15T08:00:53Z",
            labels: [],
          },
        ]);
      }
      return Response.json([{ title: "Bind Feishu bot KV namespace", merged_at: null, labels: [] }]);
    }
    if (String(url).includes("api.github.com") && /\/issues\/\d+$/.test(String(url).split("?")[0])) {
      return Response.json({
        number: 20,
        title: "主任务卡",
        body: "## 任务\n- [ ] 新定价方案\n- [ ] 定域名\n## 卡点\n- 支付：Stripe",
      });
    }
    if (String(url).includes("api.github.com") && /\/issues$/.test(String(url)) && init.method === "POST") {
      return Response.json({
        number: 21,
        html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/21",
        title: JSON.parse(init.body).title,
      }, { status: 201 });
    }
    if (String(url).includes("/im/v1/messages/") && (String(url).endsWith("/reply") || init.method === "POST")) {
      replies.push(JSON.parse(init.body));
      return Response.json({ code: 0, data: { message_id: "om_reply" } });
    }
    throw new Error(`unexpected ${url}`);
  };
}

function assertSignedOutbound(text, label) {
  assert.equal(typeof text, "string", `${label} should be text`);
  assert.ok(text.includes(REQUIRED_SIGNATURE), `${label} must include the exact signature`);
  assert.doesNotMatch(text, /老三/, `${label} must not contain 老三`);
}

test("config default signature is the required Grok Bot line and can be overridden", () => {
  assert.equal(DEFAULT_SIGNATURE, REQUIRED_SIGNATURE);
  assert.equal(botConfig.signature, REQUIRED_SIGNATURE);
  const signed = signOutboundText("项目进度摘要");
  assertSignedOutbound(signed, "default signed text");
  const custom = signOutboundText("项目进度摘要", { signature: "Role Bot · 复制实例" });
  assert.match(custom, /Role Bot · 复制实例/);
  assert.doesNotMatch(custom, /老三/);
});

test("every Feishu-facing outbound message includes the signature and excludes 老三", async () => {
  const outbound = [];

  const workerReplies = [];
  const worker = createWorker({
    fetchImpl: collectFeishuFetch({
      replies: workerReplies,
      comments: [{
        user: { login: "alice" },
        created_at: "2026-10-15T10:41:00.000Z",
        body: "验收通过，只剩报价待确认。",
      }],
    }),
  });
  const env = makeEnv();

  const commands = [
    { text: "进度", messageId: "om_progress", eventId: "evt-progress" },
    { text: "网址", messageId: "om_url", eventId: "evt-url" },
    { text: "健康", messageId: "om_health", eventId: "evt-health" },
    { text: "需求：落地页要加中文", messageId: "om_request", eventId: "evt-request" },
    { text: "随便问问", messageId: "om_help", eventId: "evt-help" },
  ];
  for (const command of commands) {
    const response = await worker.fetch(new Request("https://worker.test/feishu/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(messagePayload(command)),
    }), env, {});
    assert.equal(response.status, 200, `${command.text} should reply`);
  }
  assert.equal(workerReplies.length, commands.length);
  for (const [index, reply] of workerReplies.entries()) {
    outbound.push([`worker ${commands[index].text}`, JSON.parse(reply.content).text]);
  }

  const kv = fakeKv({
    [`${ISSUE_MAP_PREFIX}21`]: JSON.stringify({ chatId: "oc_partner", messageId: "om_request" }),
  });
  const closeReplies = [];
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
  const rawBody = encoder.encode(JSON.stringify(closed));
  const digest = await hmacSha256Hex(secret, rawBody);
  await handleGithubWebhook({
    rawBody,
    headers: new Headers({
      "X-Hub-Signature-256": `sha256=${digest}`,
      "X-GitHub-Event": "issues",
      "X-GitHub-Delivery": "delivery-sign-1",
    }),
    kv,
    env: {
      GITHUB_WEBHOOK_SECRET: secret,
      FEISHU_APP_ID: "app",
      FEISHU_APP_SECRET: "secret",
    },
    fetchImpl: collectFeishuFetch({ replies: closeReplies }),
  });
  assert.equal(closeReplies.length, 1);
  outbound.push(["close notice", JSON.parse(closeReplies[0].content).text]);

  const requestReply = await handleFeishuRequest({
    kv: fakeKv(),
    env: { GITHUB_TOKEN: "ghs_test_token", ALLOWED_CHAT_IDS: "oc_partner" },
    selected: { messageId: "om_direct", chatType: "group", text: "需求：补一页说明" },
    context: { chatId: "oc_partner", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl: async () => Response.json({
      number: 22,
      html_url: "https://github.com/CharlesHarry7/dreamutopia-clone/issues/22",
      title: "飞书需求：补一页说明",
    }, { status: 201 }),
  });
  outbound.push(["需求 created reply", requestReply]);

  const rejected = await handleFeishuRequest({
    kv: fakeKv(),
    env: { GITHUB_TOKEN: "ghs_test_token" },
    selected: { messageId: "om_denied", chatType: "group", text: "需求：不该建单" },
    context: { chatId: "oc_unknown", senderOpenId: "ou_user", senderName: "老王" },
    fetchImpl: async () => { throw new Error("denied chats must not hit GitHub"); },
  });
  outbound.push(["需求 rejected reply", rejected]);

  const deploy = buildDeployCard({
    pr: 39,
    title: "Public /examples sample pages from existing HD clips (#20) (#34)",
    sha: "08cca68",
    files: ["out/examples.html", "out/examples/rain-couple.html"],
    link: "https://github.com/CharlesHarry7/dreamutopia-clone/pull/39",
    site: "https://dreamutopia-clone.pages.dev",
    pendingItems: ["定价方案还没定", "正式域名还没定", "支付还没开通"],
  });
  const acceptance = buildAcceptanceCard({
    title: "主路径回归",
    status: "pass",
    summary: "健康检查通过",
    link: "https://dreamutopia-clone.pages.dev/api/health",
  });
  outbound.push(["deploy card", JSON.stringify(deploy)]);
  outbound.push(["acceptance card", JSON.stringify(acceptance)]);

  assert.ok(outbound.length >= 9, "should cover progress/url/health/request/help/close/cards");
  for (const [label, text] of outbound) {
    assertSignedOutbound(text, label);
  }

  const progressReply = outbound.find(([label]) => label.includes("进度"))?.[1] || "";
  assert.match(progressReply, /网站进度/);
  assert.match(progressReply, /还没做/);
  assert.doesNotMatch(progressReply, /#\d+/);
  assert.doesNotMatch(progressReply, /\b[0-9a-f]{7,40}\b/i);

  const deployJson = outbound.find(([label]) => label === "deploy card")?.[1] || "";
  assert.match(deployJson, /网站进度/);
  assert.match(deployJson, /案例页换成我们自己的样片/);
  assert.doesNotMatch(deployJson, /#\d+/);
  assert.doesNotMatch(deployJson, /\b[0-9a-f]{7,40}\b/i);
  assert.doesNotMatch(deployJson, /PR #39/);
  assert.doesNotMatch(deployJson, /08cca68/);
});
