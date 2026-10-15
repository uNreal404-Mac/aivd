#!/usr/bin/env node
/**
 * Mock Stripe checks — signature, site filter, idempotent credit grant.
 * Does not call Stripe or KIE.
 */
import { applyPaidPack } from "../libs/account.ts";
import { PACKS } from "../libs/packs.ts";
import {
  PAYMENT_SITE,
  buildCheckoutSessionParams,
  checkoutGrantDecision,
  createCheckoutSession,
  hasStripe,
  verifyStripeSignature,
} from "../libs/stripe.ts";
import { onRequestGet, onRequestPost as checkoutPost } from "../functions/api/checkout.ts";
import { onRequestPost as stripeWebhook } from "../functions/api/webhooks/stripe.ts";
import { onRequestPost as stripeWebhookAlias } from "../functions/api/stripe/webhook.ts";

const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

const WEBHOOK_SECRET = "test_webhook_secret_value";
const SECRET_KEY = "test_secret_key_value";

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function signPayload(secret, payload, ts = Math.floor(Date.now() / 1000)) {
  const hex = await hmacSha256Hex(secret, `${ts}.${payload}`);
  return { header: `t=${ts},v1=${hex}`, ts };
}

function memoryD1(seedUsers) {
  const users = new Map(seedUsers.map((u) => [u.id, { ...u }]));
  const sessions = new Map();
  const events = [];

  function runSql(sql, args) {
    const s = sql.replace(/\s+/g, " ").trim();
    if (/SELECT session_id FROM stripe_sessions WHERE session_id = \?/.test(s)) {
      return sessions.has(args[0]) ? { session_id: args[0] } : null;
    }
    if (/SELECT id FROM credit_events WHERE stripe_session_id = \?/.test(s)) {
      const row = events.find((e) => e.stripe_session_id === args[0]);
      return row ? { id: row.id } : null;
    }
    if (/SELECT credits FROM users WHERE id = \?/.test(s)) {
      const u = users.get(args[0]);
      return u ? { credits: u.credits } : null;
    }
    if (/SELECT id, credits, first_purchase_at, referred_by FROM users WHERE id = \?/.test(s)) {
      const u = users.get(args[0]);
      return u
        ? {
            id: u.id,
            credits: u.credits,
            first_purchase_at: u.first_purchase_at,
            referred_by: u.referred_by,
          }
        : null;
    }
    if (/INSERT INTO stripe_sessions \(session_id, user_id, pack, credits\) VALUES/.test(s)) {
      const [sessionId, userId, pack, credits] = args;
      if (sessions.has(sessionId)) throw new Error("UNIQUE constraint failed: stripe_sessions.session_id");
      sessions.set(sessionId, { session_id: sessionId, user_id: userId, pack, credits });
      return { success: true, meta: { changes: 1 } };
    }
    if (/UPDATE users SET credits = credits \+ \?, first_purchase_at = datetime\('now'\) WHERE id = \?/.test(s)) {
      const [delta, userId] = args;
      const u = users.get(userId);
      if (u) {
        u.credits += delta;
        u.first_purchase_at = "now";
      }
      return { success: true, meta: { changes: u ? 1 : 0 } };
    }
    if (/UPDATE users SET credits = credits \+ \? WHERE id = \?/.test(s)) {
      const [delta, userId] = args;
      const u = users.get(userId);
      if (u) u.credits += delta;
      return { success: true, meta: { changes: u ? 1 : 0 } };
    }
    if (/INSERT INTO credit_events \(user_id, delta, reason, stripe_session_id\) VALUES/.test(s)) {
      const [userId, delta, reason, stripeSessionId] = args;
      if (events.some((e) => e.stripe_session_id === stripeSessionId)) {
        throw new Error("UNIQUE constraint failed: credit_events.stripe_session_id");
      }
      events.push({
        id: events.length + 1,
        user_id: userId,
        delta,
        reason,
        stripe_session_id: stripeSessionId,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (/SELECT stripe_customer_id FROM users WHERE id = \?/.test(s)) {
      const u = users.get(args[0]);
      return u ? { stripe_customer_id: u.stripe_customer_id || null } : null;
    }
    if (/UPDATE users SET stripe_customer_id = \?/.test(s)) {
      const [customerId, userId] = args;
      const u = users.get(userId);
      if (u && !u.stripe_customer_id) u.stripe_customer_id = customerId;
      return { success: true, meta: { changes: u ? 1 : 0 } };
    }
    throw new Error("unmocked sql: " + s);
  }

  function statement(sql) {
    return {
      bind(...args) {
        const bound = {
          async first() {
            return runSql(sql, args);
          },
          async run() {
            return runSql(sql, args) || { success: true, meta: { changes: 0 } };
          },
        };
        return bound;
      },
    };
  }

  return {
    users,
    sessions,
    events,
    prepare(sql) {
      return statement(sql);
    },
    async batch(stmts) {
      const out = [];
      for (const stmt of stmts) out.push(await stmt.run());
      return out;
    },
  };
}

function pagesCtx(env, request) {
  return { env, request, waitUntil() {}, params: {}, data: {}, functionPath: "", next: async () => new Response("ok") };
}

async function jsonOf(res) {
  return { status: res.status, body: await res.json() };
}

const origFetch = globalThis.fetch;
const fetchCalls = [];
globalThis.fetch = async (input, init) => {
  const url = String(input);
  fetchCalls.push({ url, init });
  if (/kie\.ai/i.test(url)) throw new Error("test must not call KIE: " + url);
  if (/api\.stripe\.com/i.test(url)) {
    const headers = init?.headers || {};
    const auth = headers.Authorization || headers.authorization || "";
    if (auth.includes("sk_live") || auth.includes("sk_test")) {
      throw new Error("test must not use a real Stripe key");
    }
    return Response.json({
      id: "cs_mock_1",
      url: "https://checkout.stripe.com/c/pay/cs_mock_1",
    });
  }
  throw new Error("unexpected network call: " + url);
};

try {
  {
    assert(PAYMENT_SITE === "dreamutopia", "payment site slug is dreamutopia");
    assert(!hasStripe({}), "missing STRIPE_SECRET_KEY → hasStripe false");
    assert(!hasStripe({ STRIPE_SECRET_KEY: "  " }), "blank STRIPE_SECRET_KEY → hasStripe false");
    assert(hasStripe({ STRIPE_SECRET_KEY: SECRET_KEY }), "present STRIPE_SECRET_KEY → hasStripe true");
  }

  {
    const getRes = await checkoutPost(
      pagesCtx({}, new Request("https://dreamutopia-clone.pages.dev/api/checkout", { method: "POST", body: "{}" }))
    );
    const got = await jsonOf(getRes);
    assert(got.status === 503 && got.body.code === "checkout_not_configured", "POST /api/checkout without key is 503 checkout_not_configured");
    assert(fetchCalls.length === 0, "POST /api/checkout without key does not call Stripe");

    const catalog = await jsonOf(
      await onRequestGet(pagesCtx({}, new Request("https://dreamutopia-clone.pages.dev/api/checkout")))
    );
    assert(catalog.status === 503 && catalog.body.configured === false, "GET /api/checkout without key is honest 503");
  }

  {
    const params = buildCheckoutSessionParams({
      origin: "https://dreamutopia-clone.pages.dev",
      userId: 40,
      email: "buyer@example.com",
      pack: PACKS.starter,
    });
    const body = params.toString();
    assert(params.get("mode") === "payment", "checkout mode=payment");
    assert(
      params.get("success_url") === "https://dreamutopia-clone.pages.dev/workspace?checkout=success",
      "success_url is /workspace"
    );
    assert(
      params.get("cancel_url") === "https://dreamutopia-clone.pages.dev/workspace?checkout=cancel",
      "cancel_url is /workspace"
    );
    assert(params.get("metadata[user_id]") === "40", "metadata.user_id");
    assert(params.get("metadata[pack]") === "starter", "metadata.pack");
    assert(params.get("metadata[credits]") === "10", "metadata.credits from pack");
    assert(params.get("metadata[site]") === "dreamutopia", "metadata.site=dreamutopia");
    assert(params.get("line_items[0][price_data][unit_amount]") === "500", "inline price_data cents");
    assert(!body.includes("price_1"), "no pre-created Stripe price IDs");
    assert(!body.includes(SECRET_KEY) && !body.includes(WEBHOOK_SECRET), "checkout form does not embed secrets");

    fetchCalls.length = 0;
    const created = await createCheckoutSession({
      secretKey: SECRET_KEY,
      origin: "https://dreamutopia-clone.pages.dev",
      userId: 40,
      email: "buyer@example.com",
      pack: PACKS.plus,
    });
    assert(created.ok === true && created.id === "cs_mock_1", "createCheckoutSession uses mocked Stripe fetch");
    assert(fetchCalls.length === 1 && fetchCalls[0].url === "https://api.stripe.com/v1/checkout/sessions", "Stripe REST Checkout Sessions URL");
    const sent = String(fetchCalls[0].init.body);
    assert(sent.includes("metadata%5Bsite%5D=dreamutopia") || sent.includes("metadata[site]=dreamutopia"), "posted metadata.site");
    assert(sent.includes("mode=payment"), "posted mode=payment");
  }

  {
    const payload = JSON.stringify({ type: "checkout.session.completed" });
    const { header } = await signPayload(WEBHOOK_SECRET, payload);
    assert(await verifyStripeSignature(payload, header, WEBHOOK_SECRET), "valid HMAC-SHA256 signature passes");
    assert(!(await verifyStripeSignature(payload, header, "wrong_secret")), "wrong secret fails");
    assert(!(await verifyStripeSignature(payload + "x", header, WEBHOOK_SECRET)), "tampered payload fails");
    assert(!(await verifyStripeSignature(payload, "t=1,v1=deadbeef", WEBHOOK_SECRET)), "garbage v1 fails");
    const old = await signPayload(WEBHOOK_SECRET, payload, Math.floor(Date.now() / 1000) - 400);
    assert(!(await verifyStripeSignature(payload, old.header, WEBHOOK_SECRET)), "timestamp outside tolerance fails");
    const extra = await hmacSha256Hex("other", "nope");
    const { ts, header: good } = await signPayload(WEBHOOK_SECRET, payload);
    const rotated = `t=${ts},v1=${extra},${good.slice(good.indexOf("v1="))}`;
    assert(await verifyStripeSignature(payload, rotated, WEBHOOK_SECRET), "one matching v1 among several passes");
  }

  {
    const grant = checkoutGrantDecision({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_1",
          payment_status: "paid",
          metadata: { user_id: "40", pack: "starter", credits: "10", site: "dreamutopia" },
        },
      },
    });
    assert(grant.action === "grant" && grant.pack.id === "starter" && grant.userId === 40, "paid dreamutopia session grants starter pack");

    const other = checkoutGrantDecision({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_other",
          payment_status: "paid",
          metadata: { user_id: "40", pack: "starter", credits: "10", site: "taletok" },
        },
      },
    });
    assert(other.action === "ignore" && other.reason === "other_site", "other site on same Stripe account is ignored");

    const missingSite = checkoutGrantDecision({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_nosite",
          payment_status: "paid",
          metadata: { user_id: "40", pack: "starter" },
        },
      },
    });
    assert(missingSite.action === "ignore" && missingSite.reason === "other_site", "missing site metadata is ignored");

    const unpaid = checkoutGrantDecision({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_unpaid",
          payment_status: "unpaid",
          metadata: { user_id: "40", pack: "starter", site: "dreamutopia" },
        },
      },
    });
    assert(unpaid.action === "ignore" && unpaid.reason === "unpaid", "unpaid checkout.session.completed is ignored");

    const otherType = checkoutGrantDecision({ type: "invoice.paid", data: { object: {} } });
    assert(otherType.action === "ignore", "non-checkout events ignored");
  }

  {
    const db = memoryD1([
      { id: 40, credits: 10, first_purchase_at: null, referred_by: null },
    ]);
    const first = await applyPaidPack(db, { userId: 40, pack: PACKS.starter, stripeSessionId: "cs_dup" });
    assert(first.credits === 10 + 10 + 31, "first starter purchase adds pack + 31 bonus");
    assert(db.sessions.has("cs_dup"), "session id recorded in stripe_sessions");
    const second = await applyPaidPack(db, { userId: 40, pack: PACKS.starter, stripeSessionId: "cs_dup" });
    assert(second.credits === first.credits, "replay does not add credits again");
    assert(db.users.get(40).credits === first.credits, "user credits unchanged on replay");
    assert(db.events.filter((e) => e.user_id === 40).length === 1, "one credit_events row for the session");

    db.sessions.delete("cs_dup");
    const raced = await applyPaidPack(db, { userId: 40, pack: PACKS.starter, stripeSessionId: "cs_dup" });
    assert(raced.credits === first.credits, "UNIQUE on credit_events still idempotent if stripe_sessions row missing");
  }

  {
    fetchCalls.length = 0;
    const db = memoryD1([
      { id: 40, credits: 10, first_purchase_at: "already", referred_by: null },
    ]);
    const env = { DB: db, STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET };
    const payload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_live_1",
          payment_status: "paid",
          customer: "cus_mock",
          metadata: { user_id: "40", pack: "plus", credits: "50", site: "dreamutopia" },
        },
      },
    });
    const { header } = await signPayload(WEBHOOK_SECRET, payload);
    const req = new Request("https://dreamutopia-clone.pages.dev/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": header, "content-type": "application/json" },
      body: payload,
    });
    const granted = await jsonOf(await stripeWebhook(pagesCtx(env, req)));
    assert(granted.status === 200 && granted.body.ok === true, "signed paid dreamutopia webhook grants credits");
    assert(db.users.get(40).credits === 60, "plus pack 50 credits added (not first purchase)");
    assert(db.sessions.has("cs_live_1"), "webhook recorded stripe session id");

    const replayReq = new Request("https://dreamutopia-clone.pages.dev/api/stripe/webhook", {
      method: "POST",
      headers: { "stripe-signature": header, "content-type": "application/json" },
      body: payload,
    });
    const replay = await jsonOf(await stripeWebhookAlias(pagesCtx(env, replayReq)));
    assert(replay.status === 200 && replay.body.ok === true, "alias /api/stripe/webhook accepts replay");
    assert(db.users.get(40).credits === 60, "replay webhook is idempotent");

    const otherPayload = JSON.stringify({
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_foreign",
          payment_status: "paid",
          metadata: { user_id: "40", pack: "premium", credits: "500", site: "other-app" },
        },
      },
    });
    const otherSig = await signPayload(WEBHOOK_SECRET, otherPayload);
    const otherRes = await jsonOf(
      await stripeWebhook(
        pagesCtx(
          env,
          new Request("https://dreamutopia-clone.pages.dev/api/stripe/webhook", {
            method: "POST",
            headers: { "stripe-signature": otherSig.header },
            body: otherPayload,
          })
        )
      )
    );
    assert(otherRes.status === 200 && otherRes.body.ignored === "other_site", "webhook ignores other-site events");
    assert(db.users.get(40).credits === 60, "other-site event did not grant premium credits");
    assert(!db.sessions.has("cs_foreign"), "other-site session not recorded");

    const bad = await jsonOf(
      await stripeWebhook(
        pagesCtx(
          env,
          new Request("https://dreamutopia-clone.pages.dev/api/stripe/webhook", {
            method: "POST",
            headers: { "stripe-signature": "t=1,v1=nope" },
            body: payload,
          })
        )
      )
    );
    assert(bad.status === 400 && bad.body.error === "invalid_signature", "bad signature is 400");
    assert(fetchCalls.length === 0, "webhook path never calls Stripe or KIE");
  }
} finally {
  globalThis.fetch = origFetch;
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nStripe unit checks passed (${ok.length})`);
