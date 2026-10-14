import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { onRequestGet as getOrder } from "../functions/api/zcv/order";
import { onRequestGet as getMedia } from "../functions/api/zcv/media";
import { onRequestGet as getPreview, onRequestPost as startPreview } from "../functions/api/zcv/preview";
import { claimGuestPreview, reserveZcvPreviewSlot } from "../libs/zcv";
import { hashIp } from "../libs/guest";
import { SqliteD1 } from "./helpers/sqliteD1";

test("account B cannot read account A order, input, or generated video", async () => {
  const db = new SqliteD1();
  db.sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL)");
  db.sqlite.exec(readFileSync(new URL("../migrations/005_zcv_orders.sql", import.meta.url), "utf8"));
  db.sqlite.exec("INSERT INTO users(id,email,password_hash) VALUES(42,'a@example.com','x'),(7,'b@example.com','x')");
  db.sqlite.exec("INSERT INTO zcv_assets(id,r2_key,owner_kind,user_id,guest_id,asset_kind,content_type) VALUES('asset_input_a','zcv/asset_input_a.jpg','user',42,NULL,'input','image/jpeg'),('asset_full_a','zcv/asset_full_a.jpg','user',42,NULL,'video_input','image/jpeg'),('asset_output_a','zcv/asset_output_a.mp4','user',42,NULL,'video','video/mp4')");
  db.sqlite.exec("INSERT INTO zcv_previews(id,owner_kind,user_id,input_asset_id,full_asset_id,callback_token,status) VALUES('zcp_1234567890123456','user',42,'asset_input_a','asset_full_a','cb_token','ready')");
  db.sqlite.exec("INSERT INTO zcv_orders(id,user_id,preview_id,product_id,amount_total,currency,output_asset_id,callback_token,payment_status,status) VALUES('zco_1234567890123456',42,'zcp_1234567890123456','zombie-couple-video',699,'usd','asset_output_a','cb_token','paid','delivered')");
  const sessions = { get: async (key: string) => key === "account-b-token" ? JSON.stringify({ userId: 7, email: "b@example.com" }) : key === "account-a-token" ? JSON.stringify({ userId: 42, email: "a@example.com" }) : null };
  const env = { DB: db as unknown as D1Database, SESSIONS: sessions as unknown as KVNamespace, MEDIA: {} as R2Bucket };
  const context = (url: string, token = "account-b-token") => ({ request: new Request(url, { headers: { authorization: "Bearer " + token } }), env });
  const orderResponse = await getOrder(context("https://preview.example.pages.dev/api/zcv/order?id=zco_1234567890123456") as never);
  assert.equal(orderResponse.status, 403);
  const inputResponse = await getMedia(context("https://preview.example.pages.dev/api/zcv/media?assetId=asset_input_a") as never);
  assert.equal(inputResponse.status, 403);
  const outputResponse = await getMedia(context("https://preview.example.pages.dev/api/zcv/media?assetId=asset_output_a&download=1") as never);
  assert.equal(outputResponse.status, 403);
  const sourceResponse = await getMedia(context("https://preview.example.pages.dev/api/zcv/media?assetId=asset_full_a", "account-a-token") as never);
  assert.equal(sourceResponse.status, 403);
  const ownOrder = await getOrder(context("https://preview.example.pages.dev/api/zcv/order?id=zco_1234567890123456", "account-a-token") as never);
  const ownOrderBody = await ownOrder.json() as { order: Record<string, unknown> };
  assert.equal(ownOrderBody.order.outputAssetId, "asset_output_a");
  assert.equal("costCents" in ownOrderBody.order, false);
  db.close();
});

test("a needs_check preview with a recovered KIE task continues polling", async () => {
  const db = new SqliteD1();
  db.sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL)");
  db.sqlite.exec(readFileSync(new URL("../migrations/005_zcv_orders.sql", import.meta.url), "utf8"));
  db.sqlite.exec("INSERT INTO zcv_assets(id,r2_key,owner_kind,user_id,guest_id,asset_kind,content_type) VALUES('guest_input','zcv/guest_input.jpg','guest',NULL,'gst_aaaaaaaaaaaaaaaa','input','image/jpeg')");
  db.sqlite.exec("INSERT INTO zcv_previews(id,owner_kind,guest_id,input_asset_id,task_id,callback_token,status) VALUES('zcp_1234567890123456','guest','gst_aaaaaaaaaaaaaaaa','guest_input','mock-kie-task','cb_token','needs_check')");
  const env = { DB: db as unknown as D1Database, SESSIONS: { get: async () => null } as unknown as KVNamespace, MEDIA: {} as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({ code: 200, data: { taskId: "mock-kie-task", state: "generating" } }), { status: 200 });
  };
  try {
    const response = await getPreview({
      request: new Request("https://preview.example.pages.dev/api/zcv/preview?id=zcp_1234567890123456", { headers: { cookie: "du_guest=gst_aaaaaaaaaaaaaaaa" } }),
      env,
    } as never);
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.equal((await response.json() as { preview: { status: string } }).preview.status, "needs_check");
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});

test("guest preview claim can be repeated by the same account after a lost response", async () => {
  const db = new SqliteD1();
  db.sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL)");
  db.sqlite.exec(readFileSync(new URL("../migrations/005_zcv_orders.sql", import.meta.url), "utf8"));
  db.sqlite.exec("INSERT INTO users(id,email,password_hash) VALUES(42,'a@example.com','x'),(7,'b@example.com','x')");
  db.sqlite.exec("INSERT INTO zcv_assets(id,r2_key,owner_kind,user_id,guest_id,asset_kind,content_type) VALUES('guest_input','zcv/guest_input.jpg','guest',NULL,'guest-a','input','image/jpeg'),('guest_preview','zcv/guest_preview.jpg','guest',NULL,'guest-a','preview','image/jpeg')");
  db.sqlite.exec("INSERT INTO zcv_previews(id,owner_kind,user_id,guest_id,input_asset_id,preview_asset_id,callback_token,status) VALUES('zcp_1234567890123456','guest',NULL,'guest-a','guest_input','guest_preview','cb_token','ready')");

  const firstClaim = await claimGuestPreview(db as unknown as D1Database, "zcp_1234567890123456", "guest-a", 42);
  const replayedClaim = await claimGuestPreview(db as unknown as D1Database, "zcp_1234567890123456", "guest-a", 42);
  const otherAccountClaim = await claimGuestPreview(db as unknown as D1Database, "zcp_1234567890123456", "guest-a", 7);

  assert.equal(firstClaim, true);
  assert.equal(replayedClaim, true);
  assert.equal(otherAccountClaim, false);
  assert.equal(db.sqlite.prepare("SELECT owner_kind || ':' || user_id AS owner FROM zcv_previews WHERE id='zcp_1234567890123456'").get()!.owner, "user:42");
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM zcv_assets WHERE owner_kind='user' AND user_id=42").get()!.n, 2);
  db.close();
});

test("free preview quota is atomic and expires after one day", async () => {
  const db = new SqliteD1();
  db.sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL)");
  db.sqlite.exec(readFileSync(new URL("../migrations/005_zcv_orders.sql", import.meta.url), "utf8"));
  const key = `ip_${await hashIp("203.0.113.4")}`;
  assert.equal(await reserveZcvPreviewSlot(db as unknown as D1Database, key), true);
  assert.equal(await reserveZcvPreviewSlot(db as unknown as D1Database, key), true);
  assert.equal(await reserveZcvPreviewSlot(db as unknown as D1Database, key), false);
  db.sqlite.prepare("UPDATE zcv_rate_limits SET window_started_at=datetime('now','-2 days') WHERE quota_key=?").run(key);
  assert.equal(await reserveZcvPreviewSlot(db as unknown as D1Database, key), true);
  assert.equal(db.sqlite.prepare("SELECT usage_count FROM zcv_rate_limits WHERE quota_key=?").get(key)!.usage_count, 1);
  db.close();
});

test("a guest with an exhausted free preview quota gets no additional model task", async () => {
  const db = new SqliteD1();
  db.sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL)");
  db.sqlite.exec(readFileSync(new URL("../migrations/005_zcv_orders.sql", import.meta.url), "utf8"));
  db.sqlite.exec("INSERT INTO zcv_assets(id,r2_key,owner_kind,guest_id,asset_kind,content_type) VALUES('guest_input','zcv/guest_input.jpg','guest','gst_aaaaaaaaaaaaaaaa','input','image/jpeg')");
  const ip = "203.0.113.4";
  const key = `preview_ip_${await hashIp(ip)}`;
  await reserveZcvPreviewSlot(db as unknown as D1Database, key);
  await reserveZcvPreviewSlot(db as unknown as D1Database, key);
  const env = { DB: db as unknown as D1Database, SESSIONS: { get: async () => null } as unknown as KVNamespace, MEDIA: {} as R2Bucket, KIE_API_KEY: "test-only-key" };
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  globalThis.fetch = async () => { providerCalls++; throw new Error("quota must stop the provider call"); };
  try {
    const response = await startPreview({
      request: new Request("https://preview.example.pages.dev/api/zcv/preview", {
        method: "POST",
        headers: { cookie: "du_guest=gst_aaaaaaaaaaaaaaaa", "cf-connecting-ip": ip, "content-type": "application/json" },
        body: JSON.stringify({ assetId: "guest_input" }),
      }),
      env,
    } as never);
    assert.equal(response.status, 429);
    assert.equal(providerCalls, 0);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) AS n FROM zcv_previews").get()!.n, 0);
  } finally {
    globalThis.fetch = originalFetch;
    db.close();
  }
});
