import assert from "node:assert/strict";
import test from "node:test";
import {
  CRON_BATCH_LIMIT,
  CRON_SENDING_TTL_SECONDS,
  FORWARD_FAILED_MARK,
  FORWARD_PENDING_MARK,
  FORWARD_SENDING_PLACEHOLDER,
  FORWARD_TTL_SECONDS,
  MAX_PENDING_ATTEMPTS,
  PENDING_BACKOFF_MS,
  PENDING_FLAG_KEY,
  PENDING_PREFIX,
  PENDING_TTL_SECONDS,
  forwardKey,
  pendingKey,
  retryPendingForwards,
} from "../src/forward.mjs";
import worker from "../src/worker.mjs";

const RESEND_URL = "https://api.resend.com/emails";
const RESEND_KEY = "re_test_key";
// Example-only addresses: the real sender/recipients come from Worker vars.
const TEST_FORWARD_EMAIL_FROM = "bot@example.com";
const TEST_FORWARD_EMAIL_TO = "ops@example.com";

function fakeKv(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  const deletes = [];
  let listCalls = 0;
  return {
    values,
    writes,
    deletes,
    get listCalls() { return listCalls; },
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
      listCalls += 1;
      const names = [...values.keys()].filter((key) => key.startsWith(prefix)).sort();
      const selected = typeof limit === "number" ? names.slice(0, limit) : names;
      return { keys: selected.map((name) => ({ name })), list_complete: selected.length === names.length };
    },
  };
}

// A KV with the queue flag set, so the cron actually looks at the queue.
function queuedKv(initial = {}) {
  return fakeKv({ [PENDING_FLAG_KEY]: "1", ...initial });
}

function emailBody(messageId) {
  return JSON.stringify({
    from: TEST_FORWARD_EMAIL_FROM,
    to: [TEST_FORWARD_EMAIL_TO],
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
    nextAttemptAt: 0,
    ...overrides,
  });
}

function pendingKeys(kv) {
  return [...kv.values.keys()].filter((key) => key.startsWith(PENDING_PREFIX));
}

function resendEnv(overrides = {}) {
  return {
    RESEND_API_KEY: RESEND_KEY,
    FORWARD_EMAIL_FROM: TEST_FORWARD_EMAIL_FROM,
    FORWARD_EMAIL_TO: TEST_FORWARD_EMAIL_TO,
    ...overrides,
  };
}

test("cron resends a pending email with an Idempotency-Key, clears the pending record and marks it sent", async () => {
  const kv = queuedKv({
    [pendingKey("om_1")]: pendingRecord("om_1"),
    [forwardKey("om_1")]: FORWARD_PENDING_MARK,
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 1, failed: 0, skipped: 0, gaveUp: 0 });
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
  // The listing drained the queue, so the flag is cleared for the next empty run.
  assert.equal(await kv.get(PENDING_FLAG_KEY), null);
});

test("cron retry failure increments attempts and leaves the pending record claimed", async () => {
  const kv = queuedKv({
    [pendingKey("om_2")]: pendingRecord("om_2"),
    [forwardKey("om_2")]: FORWARD_PENDING_MARK,
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response("", { status: 502 });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl, now: () => 1700000000000 });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 1, skipped: 0, gaveUp: 0 });
  assert.equal(calls.length, 1);
  assert.equal(new Headers(calls[0].init.headers).get("idempotency-key"), "feishu-forward-om_2");

  const pending = JSON.parse(await kv.get(pendingKey("om_2")));
  assert.equal(pending.messageId, "om_2");
  assert.equal(pending.attempts, 4);
  assert.equal(pending.lastStatus, 502);
  assert.equal(pending.firstFailedAt, 1700000000000);
  assert.equal(pending.body, emailBody("om_2"));
  assert.equal(pending.nextAttemptAt, 1700000000000 + PENDING_BACKOFF_MS[0]);

  // Exactly one KV write on the failure path: the updated queued record. The dedupe key
  // was already "pending", so it is left untouched.
  assert.equal(kv.writes.length, 1);
  assert.equal(kv.writes[0].key, pendingKey("om_2"));
  assert.equal(await kv.get(forwardKey("om_2")), FORWARD_PENDING_MARK);
});

test("cron skips a pending record whose dedupe key is a sending placeholder", async () => {
  const kv = queuedKv({
    [pendingKey("om_3")]: pendingRecord("om_3"),
    [forwardKey("om_3")]: FORWARD_SENDING_PLACEHOLDER,
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1, gaveUp: 0 });
  assert.equal(calls.length, 0);
  assert.ok(await kv.get(pendingKey("om_3")));
  assert.equal(await kv.get(forwardKey("om_3")), FORWARD_SENDING_PLACEHOLDER);
});

test("cron drops a pending record when the dedupe key already shows a sent email", async () => {
  const kv = queuedKv({
    [pendingKey("om_4")]: pendingRecord("om_4"),
    [forwardKey("om_4")]: "1",
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1, gaveUp: 0 });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(pendingKey("om_4")), null);
  assert.equal(await kv.get(forwardKey("om_4")), "1");
  assert.deepEqual(kv.deletes, [pendingKey("om_4"), PENDING_FLAG_KEY]);
});

test("cron deletes a pending record that is not valid JSON", async () => {
  const kv = queuedKv({ [pendingKey("om_5")]: "{not json" });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1, gaveUp: 0 });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(pendingKey("om_5")), null);
  assert.equal(await kv.get(forwardKey("om_5")), null);
  assert.deepEqual(kv.deletes, [pendingKey("om_5"), PENDING_FLAG_KEY]);
});

test("cron deletes a pending record missing a message id or body", async () => {
  const kv = queuedKv({
    [pendingKey("om_empty")]: JSON.stringify({ messageId: "", body: "", attempts: 3, lastStatus: 502 }),
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1, gaveUp: 0 });
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
    assert.deepEqual(summary, { scanned: 0, sent: 0, failed: 0, skipped: 0, gaveUp: 0 });
    assert.equal(calls.length, 0);
  }
});

test("cron skips the queue and leaves pending records untouched when email config is missing", async () => {
  const cases = [
    { FORWARD_EMAIL_FROM: "", FORWARD_EMAIL_TO: TEST_FORWARD_EMAIL_TO },
    { FORWARD_EMAIL_FROM: TEST_FORWARD_EMAIL_FROM, FORWARD_EMAIL_TO: "" },
    { FORWARD_EMAIL_FROM: "   ", FORWARD_EMAIL_TO: " , " },
  ];

  for (const overrides of cases) {
    const kv = queuedKv({
      [pendingKey("om_nocfg")]: pendingRecord("om_nocfg"),
      [forwardKey("om_nocfg")]: FORWARD_PENDING_MARK,
    });
    const calls = [];
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => { logs.push(args.join(" ")); };
    let summary;
    try {
      summary = await retryPendingForwards({
        env: resendEnv(overrides),
        kv,
        fetchImpl: async (url, init = {}) => { calls.push({ url: String(url), init }); return Response.json({ ok: true }); },
      });
    } finally {
      console.log = originalLog;
    }

    assert.deepEqual(summary, { scanned: 0, sent: 0, failed: 0, skipped: 0, gaveUp: 0 });
    assert.equal(calls.length, 0);
    assert.equal(kv.writes.length, 0);
    assert.equal(kv.deletes.length, 0);
    assert.equal(kv.listCalls, 0);
    assert.ok(await kv.get(pendingKey("om_nocfg")));
    assert.equal(await kv.get(forwardKey("om_nocfg")), FORWARD_PENDING_MARK);
    const skipLog = logs.find((line) => line.includes("skipped: email not configured"));
    assert.ok(skipLog, "expected a skip log line");
    assert.equal(skipLog.includes("@"), false);
  }
});

test("cron processes at most CRON_BATCH_LIMIT pending records per run", async () => {
  const initial = {};
  for (let index = 0; index < CRON_BATCH_LIMIT + 5; index += 1) {
    initial[pendingKey(`om_batch_${index}`)] = pendingRecord(`om_batch_${index}`);
  }
  const kv = queuedKv(initial);
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
  const kv = queuedKv({
    [pendingKey("om_cron")]: pendingRecord("om_cron"),
    [forwardKey("om_cron")]: FORWARD_PENDING_MARK,
  });
  const env = {
    BOT_KV: kv,
    RESEND_API_KEY: RESEND_KEY,
    FORWARD_EMAIL_FROM: TEST_FORWARD_EMAIL_FROM,
    FORWARD_EMAIL_TO: TEST_FORWARD_EMAIL_TO,
  };
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
  const kv = queuedKv({ [pendingKey("om_nocontext")]: pendingRecord("om_nocontext") });
  const env = {
    BOT_KV: kv,
    RESEND_API_KEY: RESEND_KEY,
    FORWARD_EMAIL_FROM: TEST_FORWARD_EMAIL_FROM,
    FORWARD_EMAIL_TO: TEST_FORWARD_EMAIL_TO,
  };
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

test("cron gives up after MAX_PENDING_ATTEMPTS and marks the message failed", async () => {
  const kv = queuedKv({
    [pendingKey("om_giveup")]: pendingRecord("om_giveup", { attempts: MAX_PENDING_ATTEMPTS - 1 }),
    [forwardKey("om_giveup")]: FORWARD_PENDING_MARK,
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return new Response("", { status: 502 });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl, now: () => 1700000000000 });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 0, gaveUp: 1 });
  assert.equal(calls.length, 1);
  assert.equal(await kv.get(pendingKey("om_giveup")), null);
  assert.deepEqual(kv.writes, [{
    key: forwardKey("om_giveup"),
    value: FORWARD_FAILED_MARK,
    options: { expirationTtl: PENDING_TTL_SECONDS },
  }]);
  // Dropping the last queued record drains the queue, so the flag goes too.
  assert.deepEqual(kv.deletes, [pendingKey("om_giveup"), PENDING_FLAG_KEY]);
});

test("cron gives up on a queued record already at MAX_PENDING_ATTEMPTS without resending", async () => {
  const kv = queuedKv({
    [pendingKey("om_max")]: pendingRecord("om_max", { attempts: MAX_PENDING_ATTEMPTS }),
    [forwardKey("om_max")]: FORWARD_PENDING_MARK,
  });
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return Response.json({ ok: true });
  };

  const summary = await retryPendingForwards({ env: resendEnv(), kv, fetchImpl });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 0, gaveUp: 1 });
  assert.equal(calls.length, 0);
  assert.equal(await kv.get(pendingKey("om_max")), null);
  assert.equal(await kv.get(forwardKey("om_max")), FORWARD_FAILED_MARK);
});

test("cron lists nothing and writes nothing when the pending flag is missing", async () => {
  const kv = fakeKv();
  const summary = await retryPendingForwards({
    env: resendEnv(),
    kv,
    fetchImpl: async () => { throw new Error("cron must not call Resend without a queue"); },
  });

  assert.deepEqual(summary, { scanned: 0, sent: 0, failed: 0, skipped: 0, gaveUp: 0 });
  assert.equal(kv.listCalls, 0);
  assert.equal(kv.writes.length, 0);
  assert.equal(kv.deletes.length, 0);
});

test("cron clears the pending flag when the queue drains to an empty list", async () => {
  const kv = queuedKv();
  const summary = await retryPendingForwards({
    env: resendEnv(),
    kv,
    fetchImpl: async () => { throw new Error("cron must not call Resend on an empty queue"); },
  });

  assert.deepEqual(summary, { scanned: 0, sent: 0, failed: 0, skipped: 0, gaveUp: 0 });
  assert.equal(kv.listCalls, 1);
  assert.equal(kv.writes.length, 0);
  assert.deepEqual(kv.deletes, [PENDING_FLAG_KEY]);
  assert.equal(await kv.get(PENDING_FLAG_KEY), null);
});

test("cron skips a record whose nextAttemptAt is in the future without any KV write", async () => {
  const kv = queuedKv({
    [pendingKey("om_future")]: pendingRecord("om_future", { nextAttemptAt: 1700000900000 }),
    [forwardKey("om_future")]: FORWARD_PENDING_MARK,
  });
  const calls = [];
  const summary = await retryPendingForwards({
    env: resendEnv(),
    kv,
    now: () => 1700000000000,
    fetchImpl: async (url, init = {}) => {
      calls.push({ url: String(url), init });
      return Response.json({ ok: true });
    },
  });

  assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 0, skipped: 1, gaveUp: 0 });
  assert.equal(calls.length, 0);
  assert.equal(kv.writes.length, 0);
  assert.equal(kv.deletes.length, 0);
  assert.ok(await kv.get(pendingKey("om_future")));
  assert.equal(await kv.get(forwardKey("om_future")), FORWARD_PENDING_MARK);
});

test("cron reschedules failed retries along the PENDING_BACKOFF_MS ladder", async () => {
  const nowMs = 1700000000000;
  const cases = [
    [3, PENDING_BACKOFF_MS[0]],
    [4, PENDING_BACKOFF_MS[1]],
    [5, PENDING_BACKOFF_MS[2]],
    [6, PENDING_BACKOFF_MS[2]],
  ];

  for (const [attempts, expectedDelay] of cases) {
    const kv = queuedKv({
      [pendingKey("om_backoff")]: pendingRecord("om_backoff", { attempts }),
      [forwardKey("om_backoff")]: FORWARD_PENDING_MARK,
    });
    const summary = await retryPendingForwards({
      env: resendEnv(),
      kv,
      now: () => nowMs,
      fetchImpl: async () => new Response("", { status: 502 }),
    });

    assert.deepEqual(summary, { scanned: 1, sent: 0, failed: 1, skipped: 0, gaveUp: 0 });
    const pending = JSON.parse(await kv.get(pendingKey("om_backoff")));
    assert.equal(pending.attempts, attempts + 1);
    assert.equal(pending.nextAttemptAt, nowMs + expectedDelay);
    assert.equal(kv.writes.length, 1);
  }
});

test("cron claims the dedupe key with the long sending TTL when it is unclaimed", async () => {
  const kv = queuedKv({ [pendingKey("om_claim")]: pendingRecord("om_claim") });
  const summary = await retryPendingForwards({
    env: resendEnv(),
    kv,
    fetchImpl: async () => Response.json({ ok: true }),
  });

  assert.deepEqual(summary, { scanned: 1, sent: 1, failed: 0, skipped: 0, gaveUp: 0 });
  assert.deepEqual(kv.writes[0], {
    key: forwardKey("om_claim"),
    value: FORWARD_SENDING_PLACEHOLDER,
    options: { expirationTtl: CRON_SENDING_TTL_SECONDS },
  });
  assert.deepEqual(kv.writes[1], {
    key: forwardKey("om_claim"),
    value: "1",
    options: { expirationTtl: FORWARD_TTL_SECONDS },
  });
});
