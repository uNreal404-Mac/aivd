import assert from "node:assert/strict";
import test from "node:test";
import { PhotonImage } from "@cf-wasm/photon";
import { makeWatermarkedPreview } from "../libs/zcvPreviewImage";
import { settleZcvPreview } from "../libs/zcvWorkflow";
import { loadZcvPreview } from "../libs/zcv";
import { SqliteD1 } from "./helpers/sqliteD1";
import { readFileSync } from "node:fs";

test("free image previews are resized and contain a burned-in watermark", () => {
  const source = new PhotonImage(new Uint8Array(800 * 400 * 4).fill(180), 800, 400);
  const sourceBytes = source.get_bytes();
  source.free();
  const result = makeWatermarkedPreview(sourceBytes);
  const preview = PhotonImage.new_from_byteslice(result.bytes);
  assert.equal(preview.get_width(), 480);
  assert.equal(preview.get_height(), 240);
  assert.equal(result.contentType, "image/jpeg");
  assert.ok(result.bytes.length < sourceBytes.length);
  preview.free();
});

test("Nano Banana provider credits are attached to the preview cost record", async () => {
  const db = new SqliteD1();
  db.sqlite.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL)");
  db.sqlite.exec(readFileSync(new URL("../migrations/005_zcv_orders.sql", import.meta.url), "utf8"));
  db.sqlite.exec("INSERT INTO zcv_assets(id,r2_key,owner_kind,guest_id,asset_kind,content_type) VALUES('preview_input','zcv/preview_input.jpg','guest','gst_aaaaaaaaaaaaaaaa','input','image/jpeg')");
  db.sqlite.exec("INSERT INTO zcv_previews(id,owner_kind,guest_id,input_asset_id,callback_token,status,model_cost_usd,model_cost_cents) VALUES('zcp_1234567890123456','guest','gst_aaaaaaaaaaaaaaaa','preview_input','cb_token','processing',0.025,3)");
  const env = { DB: db as unknown as D1Database, SESSIONS: {} as KVNamespace, MEDIA: {} as R2Bucket };
  try {
    const preview = await loadZcvPreview(env.DB, "zcp_1234567890123456");
    const settled = await settleZcvPreview(env, preview!, {
      ok: true, taskId: "mock-image-cost", state: "fail", resultUrl: null, failCode: "mock", failMsg: "mock failure", creditsConsumed: 5,
    }, "https://preview.example.pages.dev");
    assert.equal(settled?.status, "failed");
    assert.equal(settled?.model_provider_credits, 5);
    assert.equal(settled?.model_cost_usd, 0.025);
    assert.equal(settled?.model_cost_cents, 3);
  } finally { db.close(); }
});
