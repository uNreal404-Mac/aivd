import test from "node:test";
import assert from "node:assert/strict";
import { hmacSha256Hex } from "../src/github.mjs";
import { handleGithubWebhook } from "../src/requests.mjs";

const encoder = new TextEncoder();
const SECRET = "webhook-secret";
function fakeKv(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async get(k) {
      return values.has(k) ? values.get(k) : null;
    },
    async put(k, v) {
      values.set(k, String(v));
    }
  };
}
async function signed(event, payload, delivery = "d-1") {
  const rawBody = encoder.encode(JSON.stringify(payload));
  const sig = await hmacSha256Hex(SECRET, rawBody);
  return {
    rawBody,
    headers: new Headers({
      "X-Hub-Signature-256": `sha256=${sig}`,
      "X-GitHub-Event": event,
      "X-GitHub-Delivery": delivery
    })
  };
}
const baseEnv = {
  GITHUB_WEBHOOK_SECRET: SECRET,
  FEISHU_APP_ID: "app",
  FEISHU_APP_SECRET: "app-secret",
  ALLOWED_CHAT_IDS: "oc_a,oc_b",
  GITHUB_TOKEN: "ghs_x",
  LLM_BASE_URL: "https://llm.test",
  LLM_MODEL: "m",
  LLM_API_KEY: "sk-test-key"
};
const ISSUE_BODY = "## 卡点\n- [ ] 支付开通 预计：2026-11-01\n- [ ] 正式域名购买";
function makeFetch({ llmFails = false, sent }) {
  return async (url, init = {}) => {
    const href = String(url);
    if (href.endsWith("/auth/v3/tenant_access_token/internal"))
      return Response.json({ code: 0, tenant_access_token: "t", expire: 7200 });
    if (href.includes("/im/v1/messages?receive_id_type=chat_id")) {
      sent.push(JSON.parse(init.body));
      return Response.json({ code: 0, data: { message_id: "om" } });
    }
    if (href.startsWith("https://llm.test")) {
      if (llmFails) return new Response("boom", { status: 500 });
      return Response.json({
        choices: [{ message: { content: "- 新增案例页筛选\n- 支持中文落地页" } }]
      });
    }
    if (href.includes("api.github.com") && /\/issues\/\d+$/.test(href))
      return Response.json({
        number: 20,
        title: "p",
        body: ISSUE_BODY,
        state: "open"
      });
    throw new Error(`unexpected ${href}`);
  };
}
const mergedPr = {
  action: "closed",
  pull_request: {
    number: 46,
    title: "案例页筛选",
    body: "加了筛选",
    merged: true,
    base: { ref: "main" },
    user: { login: "alice" },
    html_url: "https://github.com/o/r/pull/46"
  }
};

test("ping returns pong", async () => {
  const { rawBody, headers } = await signed("ping", { zen: "x" });
  const res = await handleGithubWebhook({ rawBody, headers, kv: fakeKv(), env: baseEnv, fetchImpl: makeFetch({ sent: [] }) });
  assert.equal(res.status, 200);
  assert.equal(res.body, "pong");
});

test("merged PR announces highlights and pending ETAs to every allowed chat", async () => {
  const sent = [];
  const { rawBody, headers } = await signed("pull_request", mergedPr);
  const res = await handleGithubWebhook({ rawBody, headers, kv: fakeKv(), env: baseEnv, fetchImpl: makeFetch({ sent }) });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 2);
  assert.deepEqual(
    sent.map((m) => m.receive_id),
    ["oc_a", "oc_b"]
  );
  const text = JSON.parse(sent[0].content).text;
  assert.match(text, /#46/);
  assert.match(text, /案例页筛选/);
  assert.match(text, /alice/);
  assert.match(text, /https:\/\/github.com\/o\/r\/pull\/46/);
  assert.match(text, /新增案例页筛选/);
  assert.match(text, /2026-11-01/);
  assert.match(text, /待定/);
  assert.ok(!text.includes("sk-test-key"));
  assert.ok(!text.includes("app-secret"));
  assert.ok(!text.includes("ghs_x"));
});

test("LLM failure falls back to title-only highlight", async () => {
  const sent = [];
  const { rawBody, headers } = await signed("pull_request", mergedPr);
  const res = await handleGithubWebhook({ rawBody, headers, kv: fakeKv(), env: baseEnv, fetchImpl: makeFetch({ llmFails: true, sent }) });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 2);
  const text = JSON.parse(sent[0].content).text;
  assert.match(text, /• 案例页筛选/);
  assert.doesNotMatch(text, /新增案例页筛选/);
});

test("unmerged PR is ignored", async () => {
  const sent = [];
  const { rawBody, headers } = await signed("pull_request", {
    ...mergedPr,
    pull_request: { ...mergedPr.pull_request, merged: false }
  });
  const res = await handleGithubWebhook({ rawBody, headers, kv: fakeKv(), env: baseEnv, fetchImpl: makeFetch({ sent }) });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

test("PR to non-main base is ignored", async () => {
  const sent = [];
  const { rawBody, headers } = await signed("pull_request", {
    ...mergedPr,
    pull_request: { ...mergedPr.pull_request, base: { ref: "dev" } }
  });
  const res = await handleGithubWebhook({ rawBody, headers, kv: fakeKv(), env: baseEnv, fetchImpl: makeFetch({ sent }) });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 0);
});

test("published release announces name, tag and link", async () => {
  const sent = [];
  const { rawBody, headers } = await signed("release", {
    action: "published",
    release: {
      name: "v1.0",
      tag_name: "v1.0.0",
      body: "首个版本",
      html_url: "https://github.com/o/r/releases/tag/v1.0.0"
    }
  });
  const res = await handleGithubWebhook({ rawBody, headers, kv: fakeKv(), env: baseEnv, fetchImpl: makeFetch({ sent }) });
  assert.equal(res.status, 200);
  assert.equal(sent.length, 2);
  const text = JSON.parse(sent[0].content).text;
  assert.match(text, /v1\.0\.0/);
  assert.match(text, /https:\/\/github.com\/o\/r\/releases\/tag\/v1.0.0/);
});

test("unknown event is ignored", async () => {
  const sent = [];
  const { rawBody, headers } = await signed("push", { zen: "x" });
  const res = await handleGithubWebhook({ rawBody, headers, kv: fakeKv(), env: baseEnv, fetchImpl: makeFetch({ sent }) });
  assert.equal(res.status, 200);
  assert.equal(res.body, "ok");
  assert.equal(sent.length, 0);
});

test("duplicate delivery is not announced twice", async () => {
  const kv = fakeKv();
  const sent = [];
  const { rawBody, headers } = await signed("pull_request", mergedPr, "d-dup");
  await handleGithubWebhook({ rawBody, headers, kv: kv, env: baseEnv, fetchImpl: makeFetch({ sent }) });
  await handleGithubWebhook({ rawBody, headers, kv: kv, env: baseEnv, fetchImpl: makeFetch({ sent }) });
  assert.equal(sent.length, 2);
});
