#!/usr/bin/env node
/**
 * Mock D1 / KV checks for POST /api/business.
 * Does not call KIE, Stripe, or any remote database.
 */
import { validateBusinessInquiry, SUCCESS_MESSAGE, FIELD_LIMITS } from "../libs/businessInquiry.ts";
import { onRequestPost } from "../functions/api/business.ts";

const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

function mockKv(map = new Map()) {
  return {
    map,
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

function mockD1() {
  const rows = [];
  return {
    rows,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              const q = sql.replace(/\s+/g, " ").trim();
              if (/^INSERT INTO business_inquiries/.test(q)) {
                const id = rows.length + 1;
                rows.push({
                  id,
                  company: args[0],
                  contact: args[1],
                  industry: args[2],
                  need_type: args[3],
                  quantity: args[4],
                  budget: args[5],
                  notes: args[6],
                  created_at: "2026-10-15T00:00:00.000Z",
                });
                return { success: true, meta: { last_row_id: id, changes: 1 } };
              }
              throw new Error("mock D1: unhandled SQL " + q.slice(0, 80));
            },
          };
        },
      };
    },
  };
}

function validBody(extra = {}) {
  return {
    company: "示例贸易",
    contact: "ops@example.com",
    industry: "电商",
    needType: "商品展示",
    quantity: "30",
    budget: "¥2980 起",
    notes: "先看样片再报价",
    website: "",
    ...extra,
  };
}

async function postInquiry(env, body, headers = {}) {
  const request = new Request("https://dreamutopia-clone.pages.dev/api/business", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return onRequestPost({ request, env });
}

{
  const okEmail = validateBusinessInquiry(validBody());
  assert(okEmail.ok && !okEmail.spam && okEmail.value.company === "示例贸易", "accepts company + email");

  const okPhone = validateBusinessInquiry(validBody({ contact: "13800138000" }));
  assert(okPhone.ok && !okPhone.spam && okPhone.value.contact === "13800138000", "accepts phone contact");

  const okWechat = validateBusinessInquiry(validBody({ contact: "wx_brand_ops" }));
  assert(okWechat.ok && !okWechat.spam, "accepts wechat-style contact");

  const missingCompany = validateBusinessInquiry(validBody({ company: "  " }));
  assert(!missingCompany.ok && missingCompany.code === "company_required", "rejects empty company");

  const missingContact = validateBusinessInquiry(validBody({ contact: "" }));
  assert(!missingContact.ok && missingContact.code === "contact_required", "rejects empty contact");

  const badContact = validateBusinessInquiry(validBody({ contact: "???" }));
  assert(!badContact.ok && badContact.code === "contact_invalid", "rejects punctuation-only contact");

  const tooLong = validateBusinessInquiry(validBody({ notes: "x".repeat(FIELD_LIMITS.notes + 1) }));
  assert(!tooLong.ok && tooLong.code === "field_too_long", "rejects overlong notes");

  const spam = validateBusinessInquiry(validBody({ website: "https://spam.example" }));
  assert(spam.ok && spam.spam === true, "honeypot website is treated as spam");
}

{
  const db = mockD1();
  const env = { DB: db, SESSIONS: mockKv() };
  const res = await postInquiry(env, validBody());
  const data = await res.json();
  assert(res.status === 200 && data.ok === true, "POST valid inquiry returns 200 ok");
  assert(data.message === SUCCESS_MESSAGE, "success copy is 24-hour quote promise");
  assert(data.message === "我们会在 24 小时内联系您报价", "success message is exact Chinese copy");
  assert(db.rows.length === 1, "mock D1 received one insert");
  assert(db.rows[0].company === "示例贸易", "stored company");
  assert(db.rows[0].contact === "ops@example.com", "stored contact");
  assert(db.rows[0].need_type === "商品展示", "stored need_type");
  assert(db.rows[0].created_at, "row has created_at");
}

{
  const db = mockD1();
  const env = { DB: db, SESSIONS: mockKv() };
  const res = await postInquiry(env, validBody({ website: "http://bots.test" }));
  const data = await res.json();
  assert(res.status === 200 && data.ok === true, "honeypot still returns success");
  assert(data.message === SUCCESS_MESSAGE, "honeypot uses the same success copy");
  assert(db.rows.length === 0, "honeypot does not write D1");
}

{
  const env = { DB: mockD1(), SESSIONS: mockKv() };
  const res = await postInquiry(env, { company: "", contact: "a@b.com" });
  const data = await res.json();
  assert(res.status === 400 && data.code === "company_required", "missing company is 400");
}

{
  const env = { DB: mockD1(), SESSIONS: mockKv() };
  const res = await postInquiry(env, "not-json");
  const data = await res.json();
  assert(res.status === 400 && (data.error === "invalid json" || data.code === "invalid_json"), "invalid JSON is 400");
}

{
  const res = await postInquiry({}, validBody());
  const data = await res.json();
  assert(res.status === 503, "missing DB binding is 503");
  assert(String(data.error || data.message || "").includes("DB"), "503 mentions missing DB");
}

{
  const db = mockD1();
  const kv = mockKv();
  const env = { DB: db, SESSIONS: kv };
  let last;
  for (let i = 0; i < 6; i++) {
    last = await postInquiry(env, validBody({ company: `公司${i}` }), { "cf-connecting-ip": "203.0.113.9" });
  }
  const data = await last.json();
  assert(last.status === 429 && data.code === "rate_limited", "6th inquiry from same IP is rate limited");
  assert(db.rows.length === 5, "only first 5 inquiries are stored");
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nBusiness unit checks passed (${ok.length})`);
