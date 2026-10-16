import assert from "node:assert/strict";
import test from "node:test";
import { hmacSha256Hex } from "../src/github.mjs";
import { isBroadcastRepo, resolveBroadcastRepos } from "../src/config.mjs";
import { BROADCAST_PREFIX, BROADCAST_TTL_SECONDS } from "../src/broadcast.mjs";
import { handleGithubWebhook } from "../src/requests.mjs";

const SECRET = "webhook-secret";
const encoder = new TextEncoder();
const SHA = "0123456789abcdef0123456789abcdef01234567";
const MAIN_REPO = "CharlesHarry7/dreamutopia-clone";

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

function makeEnv(extra = {}) {
  return {
    GITHUB_WEBHOOK_SECRET: SECRET,
    FEISHU_APP_ID: "app",
    FEISHU_APP_SECRET: "s",
    ALLOWED_CHAT_IDS: "oc_a",
    ...extra,
  };
}

async function signedRequest(payload, { event = "push", delivery = "delivery-1" } = {}) {
  const rawBody = encoder.encode(JSON.stringify(payload));
  const digest = await hmacSha256Hex(SECRET, rawBody);
  return {
    rawBody,
    headers: new Headers({
      "X-Hub-Signature-256": `sha256=${digest}`,
      "X-GitHub-Event": event,
      "X-GitHub-Delivery": delivery,
    }),
  };
}

// sendTextToChat sends either `text` content or a `post` payload (at-tags + text).
function extractMessageText(init) {
  const body = JSON.parse(init.body);
  const content = JSON.parse(body.content);
  if (typeof content?.text === "string") return content.text;
  const chunks = [];
  const collect = (node) => {
    if (typeof node === "string") {
      chunks.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(collect);
      return;
    }
    if (node && typeof node === "object") {
      if (typeof node.text === "string") chunks.push(node.text);
      if (node.title) collect(node.title);
      if (node.content) collect(node.content);
    }
  };
  collect(content);
  return chunks.join("");
}

function feishuFetch() {
  const messages = [];
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push(url);
    if (url.endsWith("/auth/v3/tenant_access_token/internal")) {
      return Response.json({ code: 0, tenant_access_token: "t", expire: 7200 });
    }
    if (url.includes("/im/v1/messages")) {
      messages.push({ url, init, text: extractMessageText(init), body: JSON.parse(init.body) });
      return Response.json({ code: 0, data: { message_id: "m" } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  return { fetchImpl, messages, calls };
}

function commit(index, message) {
  return { message, url: `https://github.com/${MAIN_REPO}/commit/c${index}` };
}

function pushPayload({
  ref = "refs/heads/main",
  fullName = MAIN_REPO,
  sha = SHA,
  commits = [commit(1, "feat: 第一条")],
  compare = "https://github.com/CharlesHarry7/dreamutopia-clone/compare/a...b",
} = {}) {
  return {
    ref,
    after: sha,
    compare,
    repository: { full_name: fullName },
    commits,
  };
}

async function dispatch(payload, kv, fetchImpl, { event = "push", delivery = "delivery-1" } = {}) {
  const request = await signedRequest(payload, { event, delivery });
  return handleGithubWebhook({ ...request, kv, env: makeEnv(), fetchImpl });
}

test("ignores pushes to non-main branches", async () => {
  const kv = fakeKv();
  const { fetchImpl, messages } = feishuFetch();
  const result = await dispatch(pushPayload({ ref: "refs/heads/dev" }), kv, fetchImpl, { delivery: "d-dev" });
  assert.equal(result.status, 200);
  assert.equal(messages.length, 0);
});

test("ignores pushes from repositories outside the whitelist", async () => {
  const kv = fakeKv();
  const { fetchImpl, messages } = feishuFetch();
  const result = await dispatch(pushPayload({ fullName: "someone/other" }), kv, fetchImpl, { delivery: "d-other" });
  assert.equal(result.status, 200);
  assert.equal(messages.length, 0);
});

test("rejects a broadcast webhook with a bad signature", async () => {
  const kv = fakeKv();
  await assert.rejects(() => handleGithubWebhook({
    rawBody: encoder.encode(JSON.stringify(pushPayload())),
    headers: new Headers({
      "X-Hub-Signature-256": `sha256=${"ab".repeat(32)}`,
      "X-GitHub-Event": "push",
      "X-GitHub-Delivery": "d-bad",
    }),
    kv,
    env: makeEnv(),
    fetchImpl: async () => {
      throw new Error("no fetch");
    },
  }), (error) => error.status === 401);
  assert.equal(kv.writes.length, 0);
});

test("dedupes the same main push sha across deliveries", async () => {
  const kv = fakeKv();
  const { fetchImpl, messages } = feishuFetch();
  await dispatch(pushPayload(), kv, fetchImpl, { delivery: "d-push-1" });
  assert.equal(messages.length, 1);
  await dispatch(pushPayload(), kv, fetchImpl, { delivery: "d-push-2" });
  assert.equal(messages.length, 1);

  const key = `${BROADCAST_PREFIX}${MAIN_REPO.toLowerCase()}:${SHA}`;
  const marker = kv.writes.find((write) => write.key === key);
  assert.ok(marker, "the broadcast dedupe key must be recorded");
  assert.ok(marker.options.expirationTtl > 0);
  assert.equal(marker.options.expirationTtl, BROADCAST_TTL_SECONDS);
});

test("broadcasts published releases only", async () => {
  const kv = fakeKv();
  const { fetchImpl, messages } = feishuFetch();
  const release = {
    action: "published",
    repository: { full_name: "CharlesHarry7/higgsfield-1" },
    release: {
      id: 7,
      name: "v1.2.0",
      tag_name: "v1.2.0",
      html_url: "https://github.com/CharlesHarry7/higgsfield-1/releases/tag/v1.2.0",
      target_commitish: "main",
    },
  };
  await dispatch(release, kv, fetchImpl, { event: "release", delivery: "d-rel-1" });
  assert.equal(messages.length, 1);
  assert.match(messages[0].text, /v1\.2\.0/);
  assert.match(messages[0].text, /https:\/\/github\.com\/CharlesHarry7\/higgsfield-1\/releases\/tag\/v1\.2\.0/);

  await dispatch({ ...release, action: "created" }, kv, fetchImpl, { event: "release", delivery: "d-rel-2" });
  assert.equal(messages.length, 1);
});

test("limits push broadcasts to three commits and never mentions anyone", async () => {
  const commits = [
    commit(1, "feat: 第一条\n更多说明"),
    commit(2, "fix: 第二条 @someone"),
    commit(3, "docs: 第三条"),
    commit(4, "chore: 第四条"),
    commit(5, "test: 第五条"),
  ];
  const kv = fakeKv();
  const { fetchImpl, messages } = feishuFetch();
  await dispatch(pushPayload({ commits }), kv, fetchImpl, { delivery: "d-many" });
  assert.equal(messages.length, 1);

  const text = messages[0].text;
  assert.match(text, /第一条/);
  assert.match(text, /第二条/);
  assert.match(text, /第三条/);
  assert.doesNotMatch(text, /第四条/);
  assert.doesNotMatch(text, /第五条/);
  assert.match(text, /CharlesHarry7\/dreamutopia-clone/);
  assert.match(text, new RegExp(SHA.slice(0, 7)));
  assert.match(text, /commit\/c1/);
  assert.match(text, /commit\/c2/);
  assert.match(text, /commit\/c3/);
  assert.doesNotMatch(text, /@/);
  assert.match(text, /compare\/a\.\.\.b/);
});

test("recognizes whitelisted repositories case-insensitively", () => {
  assert.equal(isBroadcastRepo("CharlesHarry7/dreamutopia-clone"), true);
  assert.equal(isBroadcastRepo("CHARLESHARRY7/HIGGSFIELD-1"), true);
  assert.equal(isBroadcastRepo("charlesharry7/higgsfield-1"), true);
  assert.equal(isBroadcastRepo("someone/other"), false);
  assert.equal(isBroadcastRepo(""), false);
  assert.equal(isBroadcastRepo(undefined), false);
  assert.ok(resolveBroadcastRepos().includes("charlesharry7/dreamutopia-clone"));
});
