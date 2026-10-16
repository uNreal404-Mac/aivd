import assert from "node:assert/strict";
import test from "node:test";
import {
  CRON_BATCH_LIMIT,
  FORWARD_EMAIL_FROM,
  FORWARD_EMAIL_TO,
  FORWARD_PENDING_MARK,
  FORWARD_SENDING_PLACEHOLDER,
  FORWARD_TTL_SECONDS,
  PENDING_PREFIX,
  PENDING_TTL_SECONDS,
  forwardKey,
  pendingKey,
  retryPendingForwards,
} from "../src/forward.mjs";
import worker from "../src/worker.mjs";

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_KEY = "re_test_key";

function fakeKv(initial = {}) {
  const values = new Map(Object.entries(initial));
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
    async list({ prefix = "", limit } = {}) {
      const names = [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
      const selected = typeof limit === "number" ? names.slice(0, limit) : names;
      return { keys: selected.map((name) => ({ name })), list_complete: selected.length === names.length };
    },
  };
}

function emailBody(messageId) {
  return JSON.stringify({
    from: FORWARD_EMAIL_FROM,
    to: FORWARD_EMAIL_TO,
    subject: `[feishu] 老王 ${messageId}`,
    text: "text: 随便聊聊",
  });
}

function pendingRecord(messageId, overrides = {}) {
  return JSON.stringify({
    messageId,
    body: emailBody(messageId),
    attempts: 3,
    firstFailedAt: 1700000000000,
    lastStatus: 502,
    ...overrides,
  });
}

function pendingKeys(kv) {
  return [...kv.values.keys()].filter((key) => key.startsWith(PENDING_PREFIX));
}

function resendEnv() {
  return { RESEND_API_KEY: RESEND_KEY };
}

test("cron resends a pending email with an Idempotency-Key, clears the pending record and marks it sent", async () => {
  const kv = fakeKv({
    [pendingKey("om_1")]: pendingRecord("om_1"),
    [forwardKey("om_1")]: FORWARD_PENDING_MARK,
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 1, failed: 0, skipped: 0 });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, RESEND_URL);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(new Headers(calls[0].init.headers).get("content-type"), "application/json");
  assert.equal(new Headers(calls[0].init.headers).get("authorization"), `Bearer ${RESEND_KEY}`);
  assert.equal(new Headers(calls[0].init.headers).get("idempotency-key"), "feishu-forward-om_1");
  assert.equal(JSON.parse(calls[0].init.body).subject, "[feishu] 老王 om_1");
  assert.equal(calls[0].init.body, emailBody("om_1"));
  assert.equal(await kv.get(pendingKey("om_1")), null);
  assert.equal(await kv.get(forwardKey("om_1")), "1");
});

test("cron retry failure increments attempts and leaves the pending record claimed", async () => {
  const kv = fakeKv({
    [pendingKey("om_2")]: pendingRecord("om_2"),
    [forwardKey("om_2")]: FORWARD_PENDING_MARK,
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response("", { status: 502 });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 1, skipped: 0 });
  assert.equal(calls.length, 1);
  assert.equal(new Headers(calls[0].init.headers).get("idempotency-key"), "feishu-forward-om_2");

  const pending = JSON.parse(await kv.get(pendingKey("om_2")));
  assert.equal(pending.messageId, "om_2");
  assert.equal(pending.attempts, 4);
  assert.equal(pending.lastStatus, 502);
  assert.equal(pending.firstFailedAt, 1700000000000);
  assert.equal(pending.body, emailBody("om_2"));

  assert.deepEqual(kv.writes.at(-1), {
    key: forwardKey("om_2"),
    value: FORWARD_PENDING_MARK,
    options: { expirationTtl: PENDING_TTL_SECONDS },
  });
  assert.equal(await kv.get(forwardKey("om_2")), FORWARD_PENDING_MARK);
});

test("cron skips a pending record whose dedupe key is a sending placeholder", async () => {
  const kv = fakeKv({
    [pendingKey("om_3")]: pendingRecord("om_3"),
    [forwardKey("om_3")]: FORWARD_SENDING_PLACEHOLDER,
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1 });
  assert.equal(calls.length, 0);
  assert.ok(await kv.get(pendingKey("om_3")));
  assert.equal(await kv.get(forwardKey("om_3")), FORWARD_SENDING_PLACEHOLDER);
});

test("cron drops a pending record when the dedupe key already shows a sent email", async () => {
  const kv = fakeKv({
    [pendingKey("om_4")]: pendingRecord("om_4"),
    [forwardKey("om_4")]: "1",
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1 });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(pendingKey("om_4")), null);
  assert.equal(await kv.get(forwardKey("om_4")), "1");
  assert.deepEqual(kv.deletes, [pendingKey("om_4")]);
});

test("cron deletes a pending record that is not valid JSON", async () => {
  const kv = fakeKv({ [pendingKey("om_5")]: "{not json" });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1 });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(pendingKey("om_5")), null);
  assert.equal(await kv.get(forwardKey("om_5")), null);
});

test("cron deletes a pending record missing a message id or body", async () => {
  const kv = fakeKv({
    [pendingKey("om_empty")]: JSON.stringify({ messageId: "", body: "", attempts: 3, lastStatus: 502 }),
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1 });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(pendingKey("om_empty")), null);
});

test("cron returns zeros when the Resend key or KV binding is missing", async () => {
  const cases = [
    { env: {}, kv: fakeKv({ [pendingKey("om_6")]: pendingRecord("om_6") }) },
    { env: { RESEND_API_KEY: "" }, kv: fakeKv({ [pendingKey("om_6")]: pendingRecord("om_6") }) },
    { env: { RESEND_API_KEY: RESEND_KEY }, kv: null },
  ];

  for (const { env, kv } of cases) {
    const calls = [];
    const summary = await retryPendingForwards({
      env,
      kv,
      fetchImpl: async (url, init = {}) => {
        calls.push({ url: String(url), init });
        return Response.json({ ok: true });
      },
    });
    assert.deepEqual(summary, { scanned: 0, sent: 0, failed: 0, skipped: 0 });
    assert.equal(calls.length, 0);
  }
});

test("cron processes at most CRON_BATCH_LIMIT pending records per run", async () => {
  const initial = {};
  for (let index = 0; index < CRON_BATCH_LIMIT + 5; index += 1) {
    initial[pendingKey(`om_batch_${index}`)] = pendingRecord(`om_batch_${index}`);
  }
  const kv = fakeKv(initial);
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.equal(summary.scanned, CRON_BATCH_LIMIT);
  assert.equal(summary.sent, CRON_BATCH_LIMIT);
  assert.equal(calls.length, CRON_BATCH_LIMIT);
  assert.equal(pendingKeys(kv).length, 5);
});

test("worker.scheduled queues the cron retry through waitUntil", async () => {
  const kv = fakeKv({
    [pendingKey("om_cron")]: pendingRecord("om_cron"),
    [forwardKey("om_cron")]: FORWARD_PENDING_MARK,
  });
  const env = { BOT_KV: kv, RESEND_API_KEY: RESEND_KEY };
  const queued = [];
  const ctx = { waitUntil: (promise) => { queued.push(promise); } };
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  try {
    await worker.scheduled({}, env, ctx);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(queued.length, 1);
  await Promise.all(queued);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, RESEND_URL);
  assert.equal(new Headers(calls[0].init.headers).get("idempotency-key"), "feishu-forward-om_cron");
  assert.equal(await kv.get(forwardKey("om_cron")), "1");
  assert.equal(await kv.get(pendingKey("om_cron")), null);
});

test("worker.scheduled still completes when it runs without a waitUntil context", async () => {
  const kv = fakeKv({ [pendingKey("om_nocontext")]: pendingRecord("om_nocontext") });
  const env = { BOT_KV: kv, RESEND_API_KEY: RESEND_KEY };
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  try {
    await worker.scheduled({}, env, {});
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(await kv.get(forwardKey("om_nocontext")), "1");
});
