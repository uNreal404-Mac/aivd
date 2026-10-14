import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { acceptZcvPaidCheckout, claimPaidGeneration, loadZcvOrder } from "../libs/zcv";
import { settleZcvVideo, startZcvPaidVideo, syncZcvOrder } from "../libs/zcvWorkflow";
import { ZCV_PRODUCT } from "../libs/zcvCore";
import { onRequestPost as kieCallback } from "../functions/api/zcv/kie-callback";
import { SqliteD1 } from "./helpers/sqliteD1";
import { testMp4 } from "./helpers/mp4";

function database() {
  const db = new SqliteD1();
  db.sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL)");
  db.sqlite.exec(readFileSync(new URL("../migrations/005_zcv_orders.sql", import.meta.url), "utf8"));
  db.sqlite.prepare("INSERT INTO users(id,email,password_hash) VALUES(42,'buyer@example.com','hash')").run();
  db.sqlite.prepare("INSERT INTO zcv_assets(id,r2_key,owner_kind,user_id,guest_id,asset_kind,content_type) VALUES('preview-full','zcv/preview-full.jpg','user',42,NULL,'video_input','image/jpeg')").run();
  db.sqlite.prepare("INSERT INTO zcv_previews(id,owner_kind,user_id,guest_id,input_asset_id,full_asset_id,preview_asset_id,task_id,callback_token,model,model_version,model_cost_usd,status) VALUES('zcp_1234567890123456','user',42,NULL,'preview-full','preview-full','preview-full','kie-image-1','cb_token','nano-banana-2','nano-banana-2',0.04,'ready')").run();
  db.prepare("INSERT INTO zcv_orders(id,user_id,preview_id,product_id,amount_total,currency,video_input_asset_id,callback_token) VALUES('zco_1234567890123456',42,'zcp_1234567890123456',?,699,'usd','preview-full','cb_token')").bind(ZCV_PRODUCT.id).run();
  db.sqlite.prepare("UPDATE zcv_orders SET checkout_session_id='cs_test_123', checkout_url='https://checkout.stripe.test/session' WHERE id='zco_1234567890123456'").run();
  return db;
}

const checkout = {
  id: "cs_test_123",
  mode: "payment",
  payment_status: "paid",
  status: "complete",
  amount_total: 699,
  currency: "usd",
  client_reference_id: "42",
  payment_intent: "pi_test_123",
  metadata: { orderId: "zco_1234567890123456", userId: "42", productId: ZCV_PRODUCT.id },
};

test("replaying one Stripe event ten times grants one paid generation claim", async () => {
  const db = database();
  let generationClaims = 0;
  for (let i = 0; i < 10; i++) {
    const accepted = await acceptZcvPaidCheckout(db as unknown as D1Database, "evt_same", checkout);
    assert.equal(accepted.ok, true);
    if (await claimPaidGeneration(db as unknown as D1Database, "zco_1234567890123456")) generationClaims++;
  }
  assert.equal(generationClaims, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM zcv_stripe_events").get()!.n, 1);
  assert.equal(db.sqlite.prepare("SELECT payment_status FROM zcv_orders").get()!.payment_status, "paid");
  db.close();
});

test("different Stripe event IDs for one Checkout session cannot grant twice", async () => {
  const db = database();
  let generationClaims = 0;
  for (let i = 0; i < 10; i++) {
    await acceptZcvPaidCheckout(db as unknown as D1Database, `evt_${i}`, checkout);
    if (await claimPaidGeneration(db as unknown as D1Database, "zco_1234567890123456")) generationClaims++;
  }
  assert.equal(generationClaims, 1);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM zcv_stripe_events").get()!.n, 10);
  db.close();
});

test("canceled, unpaid, wrong amount, and wrong owner payments do not change an order", async () => {
  for (const invalid of [
    { ...checkout, status: "expired" },
    { ...checkout, payment_status: "unpaid" },
    { ...checkout, amount_total: 1 },
    { ...checkout, client_reference_id: "7" },
  ]) {
    const db = database();
    const result = await acceptZcvPaidCheckout(db as unknown as D1Database, "evt_bad", invalid);
    assert.deepEqual(result, { ok: false, reason: "payment_mismatch" });
    assert.equal(db.sqlite.prepare("SELECT payment_status FROM zcv_orders").get()!.payment_status, "unpaid");
    db.close();
  }
});

test("an ambiguous KIE timeout is recorded as needs_check and a second webhook cannot rerun it", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='paid_pending' WHERE id='zco_1234567890123456'").run();
  const values = new Map<string, string>();
  const sessions = {
    put: async (key: string, value: string) => { values.set(key, value); },
    get: async (key: string) => values.get(key) || null,
  };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("simulated KIE timeout with unknown charge state"); };
  try {
    const env = { DB: db as unknown as D1Database, SESSIONS: sessions as unknown as KVNamespace, MEDIA: {} as R2Bucket, KIE_API_KEY: "test-only-key" };
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "needs_check");
    assert.equal(db.sqlite.prepare("SELECT status FROM zcv_orders").get()!.status, "needs_check");
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "needs_check");
    assert.equal(calls, 1);
    assert.equal(db.sqlite.prepare("SELECT generation_attempts FROM zcv_orders").get()!.generation_attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("a known failed KIE task retries once and records the new task ID", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='paid_pending' WHERE id='zco_1234567890123456'").run();
  const values = new Map<string, string>();
  const sessions = {
    put: async (key: string, value: string) => { values.set(key, value); },
    get: async (key: string) => values.get(key) || null,
  };
  const env = { DB: db as unknown as D1Database, SESSIONS: sessions as unknown as KVNamespace, MEDIA: {} as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 200, data: { taskId: `mock-video-${++calls}` } }), { status: 200 });
  try {
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "generating");
    const first = await loadZcvOrder(db as unknown as D1Database, "zco_1234567890123456");
    assert.equal(first?.video_task_id, "mock-video-1");
    const retried = await settleZcvVideo(env, first!, {
      ok: true, taskId: "mock-video-1", state: "fail", resultUrl: null,
      failCode: "moderation_failed", failMsg: "gore detected",
    }, "https://preview.example.pages.dev");
    assert.equal(calls, 2);
    assert.equal(retried?.status, "generating");
    assert.equal(retried?.video_task_id, "mock-video-2");
    assert.equal(retried?.generation_attempts, 2);
    const attempts = db.sqlite.prepare("SELECT attempt,task_id,status,estimated_cost_cents FROM zcv_task_attempts ORDER BY attempt").all().map((row) => ({ ...row }));
    assert.deepEqual(attempts, [
      { attempt: 1, task_id: "mock-video-1", status: "failed", estimated_cost_cents: 28 },
      { attempt: 2, task_id: "mock-video-2", status: "generating", estimated_cost_cents: 28 },
    ]);
    assert.equal(db.sqlite.prepare("SELECT video_cost_cents FROM zcv_orders").get()!.video_cost_cents, 56);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("a late KIE callback recovers a paid order after createTask timed out", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='paid_pending' WHERE id='zco_1234567890123456'").run();
  const values = new Map<string, string>();
  const sessions = {
    put: async (key: string, value: string) => { values.set(key, value); },
    get: async (key: string) => values.get(key) || null,
  };
  const env = { DB: db as unknown as D1Database, SESSIONS: sessions as unknown as KVNamespace, MEDIA: {} as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) throw new Error("simulated timeout after provider accepted task");
    return new Response(JSON.stringify({ code: 200, data: { taskId: "mock-recovered", state: "generating" } }), { status: 200 });
  };
  try {
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "needs_check");
    const callbackToken = db.sqlite.prepare("SELECT callback_token FROM zcv_orders").get()!.callback_token as string;
    const response = await kieCallback({
      env,
      request: new Request(`https://preview.example.pages.dev/api/zcv/kie-callback?type=order&id=zco_1234567890123456&token=${callbackToken}`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ taskId: "mock-recovered" }),
      }),
    } as never);
    assert.equal(response.status, 200);
    const recovered = await loadZcvOrder(db as unknown as D1Database, "zco_1234567890123456");
    assert.equal(recovered?.status, "generating");
    assert.equal(recovered?.video_task_id, "mock-recovered");
    assert.deepEqual({ ...db.sqlite.prepare("SELECT task_id,status FROM zcv_task_attempts").get() }, { task_id: "mock-recovered", status: "generating" });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("a paid video is private and delivered only after exact-spec validation and safe review", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='paid_pending' WHERE id='zco_1234567890123456'").run();
  const objects = new Map<string, Uint8Array>();
  const media = {
    put: async (key: string, value: ArrayBuffer | Uint8Array) => {
      objects.set(key, value instanceof Uint8Array ? value.slice() : new Uint8Array(value));
    },
    get: async (key: string) => {
      const bytes = objects.get(key);
      return bytes ? { arrayBuffer: async () => bytes.slice().buffer } : null;
    },
    delete: async (key: string) => { objects.delete(key); },
  };
  const values = new Map<string, string>();
  const sessions = {
    put: async (key: string, value: string) => { values.set(key, value); },
    get: async (key: string) => values.get(key) || null,
  };
  const env = {
    DB: db as unknown as D1Database,
    SESSIONS: sessions as unknown as KVNamespace,
    MEDIA: media as unknown as R2Bucket,
    KIE_API_KEY: "test-only-key",
  };
  const originalFetch = globalThis.fetch;
  let reviewCalls = 0;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url === "https://api.kie.ai/api/v1/jobs/createTask") {
      return new Response(JSON.stringify({ code: 200, data: { taskId: "mock-safe-video" } }), { status: 200 });
    }
    if (url === "https://provider.example/safe.mp4") {
      return new Response(testMp4().slice().buffer as ArrayBuffer, { status: 200, headers: { "content-type": "video/mp4" } });
    }
    if (url === "https://api.kie.ai/gemini-4-argon-openai/v1/chat/completions") {
      reviewCalls++;
      const request = JSON.parse(String(init?.body));
      assert.match(request.messages[0].content[1].image_url.url, /\/api\/zcv\/provider-media\?token=/);
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"safe":true,"reason":"cute cartoon"}' } }], credits_consumed: 0.01 }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "generating");
    const started = await loadZcvOrder(db as unknown as D1Database, "zco_1234567890123456");
    const delivered = await settleZcvVideo(env, started!, {
      ok: true, taskId: "mock-safe-video", state: "success", resultUrl: "https://provider.example/safe.mp4",
      failCode: null, failMsg: null, creditsConsumed: 55,
    }, "https://preview.example.pages.dev");
    assert.equal(delivered?.status, "delivered");
    assert.equal(delivered?.output_asset_id, "zco_1234567890123456_video_1");
    assert.equal(reviewCalls, 1);
    const attempt = db.sqlite.prepare("SELECT status,output_asset_id,provider_credits_consumed,video_width,video_height,video_duration_sec,video_has_audio,moderation_status,moderation_call_count,moderation_provider_credits FROM zcv_task_attempts").get()!;
    assert.deepEqual({ ...attempt }, {
      status: "delivered", output_asset_id: "zco_1234567890123456_video_1", provider_credits_consumed: 55, video_width: 1920,
      video_height: 1080, video_duration_sec: 10, video_has_audio: 0, moderation_status: "passed",
      moderation_call_count: 1, moderation_provider_credits: 0.01,
    });
    assert.equal(db.sqlite.prepare("SELECT video_provider_credits FROM zcv_orders").get()!.video_provider_credits, 55);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("an out-of-spec paid video is never delivered or sent for moderation", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='paid_pending' WHERE id='zco_1234567890123456'").run();
  const objects = new Map<string, Uint8Array>();
  const media = {
    put: async (key: string, value: ArrayBuffer | Uint8Array) => { objects.set(key, value instanceof Uint8Array ? value.slice() : new Uint8Array(value)); },
    get: async (key: string) => { const bytes = objects.get(key); return bytes ? { arrayBuffer: async () => bytes.slice().buffer } : null; },
    delete: async (key: string) => { objects.delete(key); },
  };
  const sessions = { put: async () => undefined, get: async () => null };
  const env = { DB: db as unknown as D1Database, SESSIONS: sessions as unknown as KVNamespace, MEDIA: media as unknown as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let creates = 0;
  let reviewCalls = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://api.kie.ai/api/v1/jobs/createTask") return new Response(JSON.stringify({ code: 200, data: { taskId: `mock-video-${++creates}` } }), { status: 200 });
    if (url === "https://provider.example/low-res.mp4") return new Response(testMp4({ width: 1280, height: 720 }).slice().buffer as ArrayBuffer, { status: 200, headers: { "content-type": "video/mp4" } });
    if (url.includes("gemini-4-argon-openai")) { reviewCalls++; return new Response("{}", { status: 200 }); }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "generating");
    const started = await loadZcvOrder(db as unknown as D1Database, "zco_1234567890123456");
    const retried = await settleZcvVideo(env, started!, {
      ok: true, taskId: "mock-video-1", state: "success", resultUrl: "https://provider.example/low-res.mp4", failCode: null, failMsg: null,
    }, "https://preview.example.pages.dev");
    assert.equal(retried?.status, "generating");
    assert.equal(retried?.generation_attempts, 2);
    assert.equal(retried?.output_asset_id, null);
    assert.equal(reviewCalls, 0);
    assert.equal(objects.has("zcv/zco_1234567890123456_video_1.mp4"), false);
    const attempts = db.sqlite.prepare("SELECT status,moderation_status,moderation_estimated_cost_cents FROM zcv_task_attempts ORDER BY attempt").all().map((row) => ({ ...row }));
    assert.deepEqual(attempts, [
      { status: "rejected", moderation_status: "not_run", moderation_estimated_cost_cents: 0 },
      { status: "generating", moderation_status: "pending", moderation_estimated_cost_cents: 1 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("gore can trigger two retries, and the safe third attempt can be delivered", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='paid_pending' WHERE id='zco_1234567890123456'").run();
  const objects = new Map<string, Uint8Array>();
  const media = {
    put: async (key: string, value: ArrayBuffer | Uint8Array) => { objects.set(key, value instanceof Uint8Array ? value.slice() : new Uint8Array(value)); },
    get: async (key: string) => { const bytes = objects.get(key); return bytes ? { arrayBuffer: async () => bytes.slice().buffer } : null; },
    delete: async (key: string) => { objects.delete(key); },
  };
  const sessions = { put: async () => undefined, get: async () => null };
  const env = { DB: db as unknown as D1Database, SESSIONS: sessions as unknown as KVNamespace, MEDIA: media as unknown as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let creates = 0;
  let reviews = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://api.kie.ai/api/v1/jobs/createTask") return new Response(JSON.stringify({ code: 200, data: { taskId: `mock-review-${++creates}` } }), { status: 200 });
    if (url === "https://provider.example/valid.mp4") return new Response(testMp4().slice().buffer as ArrayBuffer, { status: 200, headers: { "content-type": "video/mp4" } });
    if (url.includes("gemini-4-argon-openai")) {
      reviews++;
      const safe = reviews === 3;
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ safe, reason: safe ? "safe retry" : "blood detected" }) } }], credits_consumed: 0.01 }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "generating");
    const first = await loadZcvOrder(db as unknown as D1Database, "zco_1234567890123456");
    const retried = await settleZcvVideo(env, first!, {
      ok: true, taskId: "mock-review-1", state: "success", resultUrl: "https://provider.example/valid.mp4", failCode: null, failMsg: null,
    }, "https://preview.example.pages.dev");
    assert.equal(retried?.status, "generating");
    assert.equal(retried?.generation_attempts, 2);
    const second = await settleZcvVideo(env, retried!, {
      ok: true, taskId: "mock-review-2", state: "success", resultUrl: "https://provider.example/valid.mp4", failCode: null, failMsg: null,
    }, "https://preview.example.pages.dev");
    assert.equal(second?.status, "generating");
    assert.equal(second?.generation_attempts, 3);
    const third = await settleZcvVideo(env, second!, {
      ok: true, taskId: "mock-review-3", state: "success", resultUrl: "https://provider.example/valid.mp4", failCode: null, failMsg: null,
    }, "https://preview.example.pages.dev");
    assert.equal(third?.status, "delivered");
    assert.equal(reviews, 3);
    const attempts = db.sqlite.prepare("SELECT attempt,status,moderation_status,moderation_call_count FROM zcv_task_attempts ORDER BY attempt").all().map((row) => ({ ...row }));
    assert.deepEqual(attempts, [
      { attempt: 1, status: "rejected", moderation_status: "gore", moderation_call_count: 1 },
      { attempt: 2, status: "rejected", moderation_status: "gore", moderation_call_count: 1 },
      { attempt: 3, status: "delivered", moderation_status: "passed", moderation_call_count: 1 },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("the third failed paid attempt is refunded and never starts a fourth task", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='paid_pending' WHERE id='zco_1234567890123456'").run();
  const sessions = { put: async () => undefined, get: async () => null };
  const env = { DB: db as unknown as D1Database, SESSIONS: sessions as unknown as KVNamespace, MEDIA: {} as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let creates = 0;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 200, data: { taskId: `mock-fail-${++creates}` } }), { status: 200 });
  try {
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "generating");
    let order = await loadZcvOrder(db as unknown as D1Database, "zco_1234567890123456");
    for (let attempt = 1; attempt <= 3; attempt++) {
      order = await settleZcvVideo(env, order!, {
        ok: true, taskId: `mock-fail-${attempt}`, state: "fail", resultUrl: null, failCode: "provider_failed", failMsg: "mock failure",
      }, "https://preview.example.pages.dev");
    }
    assert.equal(order?.status, "refund_required");
    assert.equal(order?.generation_attempts, 3);
    assert.equal(creates, 3);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM zcv_task_attempts").get()!.n, 3);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("an unknown moderation result fails closed without starting another paid video", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='paid_pending' WHERE id='zco_1234567890123456'").run();
  const objects = new Map<string, Uint8Array>();
  const media = {
    put: async (key: string, value: ArrayBuffer | Uint8Array) => { objects.set(key, value instanceof Uint8Array ? value.slice() : new Uint8Array(value)); },
    get: async (key: string) => { const bytes = objects.get(key); return bytes ? { arrayBuffer: async () => bytes.slice().buffer } : null; },
    delete: async (key: string) => { objects.delete(key); },
  };
  const sessions = { put: async () => undefined, get: async () => null };
  const env = { DB: db as unknown as D1Database, SESSIONS: sessions as unknown as KVNamespace, MEDIA: media as unknown as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let creates = 0;
  let reviews = 0;
  globalThis.fetch = async (input) => {
    const url = String(input);
    if (url === "https://api.kie.ai/api/v1/jobs/createTask") return new Response(JSON.stringify({ code: 200, data: { taskId: `mock-unknown-${++creates}` } }), { status: 200 });
    if (url === "https://provider.example/valid.mp4") return new Response(testMp4().slice().buffer as ArrayBuffer, { status: 200, headers: { "content-type": "video/mp4" } });
    if (url.includes("gemini-4-argon-openai")) { reviews++; return new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), { status: 200 }); }
    throw new Error(`unexpected fetch: ${url}`);
  };
  try {
    assert.equal(await startZcvPaidVideo(env, "zco_1234567890123456", "https://preview.example.pages.dev"), "generating");
    const started = await loadZcvOrder(db as unknown as D1Database, "zco_1234567890123456");
    const rejected = await settleZcvVideo(env, started!, {
      ok: true, taskId: "mock-unknown-1", state: "success", resultUrl: "https://provider.example/valid.mp4", failCode: null, failMsg: null,
    }, "https://preview.example.pages.dev");
    assert.equal(rejected?.status, "refund_required");
    assert.equal(rejected?.generation_attempts, 1);
    assert.equal(rejected?.output_asset_id, null);
    assert.equal(creates, 1);
    assert.equal(reviews, 1);
    assert.deepEqual({ ...db.sqlite.prepare("SELECT moderation_status,moderation_call_count FROM zcv_task_attempts").get() }, {
      moderation_status: "unknown", moderation_call_count: 1,
    });
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("an abandoned moderation request is refunded without a second review call", async () => {
  const db = database();
  db.sqlite.prepare("UPDATE zcv_orders SET payment_status='paid', status='needs_check', video_task_id='mock-hung-task', generation_attempts=1 WHERE id='zco_1234567890123456'").run();
  db.sqlite.prepare("INSERT INTO zcv_task_attempts(order_id,attempt,task_id,model,model_version,status,moderation_status,moderation_call_count,updated_at) VALUES('zco_1234567890123456',1,'mock-hung-task','kling-2.6/image-to-video','kling-2.6','moderating','checking',1,datetime('now','-5 minutes'))").run();
  const env = { DB: db as unknown as D1Database, SESSIONS: {} as KVNamespace, MEDIA: {} as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("moderation must not be repeated"); };
  try {
    const result = await syncZcvOrder(env, "zco_1234567890123456", "https://preview.example.pages.dev");
    assert.equal(result?.status, "refund_required");
    assert.equal(result?.last_error, "moderation_result_unknown");
    assert.equal(calls, 0);
    assert.deepEqual({ ...db.sqlite.prepare("SELECT moderation_status,moderation_call_count FROM zcv_task_attempts").get() }, {
      moderation_status: "unknown", moderation_call_count: 1,
    });
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});
