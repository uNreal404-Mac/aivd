import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost } from "../functions/api/webhooks/stripe";

async function stripeHeader(payload: string, secret: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`));
  const hex = Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, "0")).join("");
  return `t=${timestamp},v1=${hex}`;
}

test("invalid Stripe signatures return 400 before processing event data", async () => {
  const secret = "whsec_test_only";
  const response = await onRequestPost({
    env: { STRIPE_WEBHOOK_SECRET: secret, DB: {} as D1Database },
    request: new Request("https://preview.example.pages.dev/api/webhooks/stripe", {
      method: "POST", headers: { "stripe-signature": `t=${Math.floor(Date.now() / 1000)},v1=invalid` }, body: "{}",
    }),
  } as never);
  assert.equal(response.status, 400);
});

test("canceled Checkout sessions are ignored and cannot start video generation", async () => {
  const secret = "whsec_test_only";
  const payload = JSON.stringify({ id: "evt_cancel", livemode: false, type: "checkout.session.expired", data: { object: { id: "cs_test_cancel", metadata: { productId: "zombie-couple-video" } } } });
  const response = await onRequestPost({
    env: { STRIPE_WEBHOOK_SECRET: secret, DB: {} as D1Database, STRIPE_SECRET_KEY: "sk_test_placeholder" },
    request: new Request("https://preview.example.pages.dev/api/webhooks/stripe", {
      method: "POST", headers: { "stripe-signature": await stripeHeader(payload, secret) }, body: payload,
    }),
  } as never);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ignored: "checkout.session.expired" });
});

test("live-mode ZCV payment events are rejected even when signed", async () => {
  const secret = "whsec_test_only";
  const payload = JSON.stringify({ id: "evt_live", livemode: true, type: "checkout.session.completed", data: { object: { id: "cs_live", metadata: { productId: "zombie-couple-video" } } } });
  const response = await onRequestPost({
    env: { STRIPE_WEBHOOK_SECRET: secret, DB: {} as D1Database, STRIPE_SECRET_KEY: "sk_test_placeholder" },
    request: new Request("https://preview.example.pages.dev/api/webhooks/stripe", {
      method: "POST", headers: { "stripe-signature": await stripeHeader(payload, secret) }, body: payload,
    }),
  } as never);
  assert.equal(response.status, 503);
});
