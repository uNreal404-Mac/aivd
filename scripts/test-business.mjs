/**
 * /api/business is retired (410). Inquiry validation helpers stay unit-tested.
 * Does not call KIE, Stripe, or any remote database.
 */
import { validateBusinessInquiry, FIELD_LIMITS } from "../libs/businessInquiry.ts";
import { onRequestGet, onRequestPost } from "../functions/api/business.ts";
import { onRequest as businessPage } from "../functions/business.ts";

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
    prepare() {
      return {
        bind() {
          return {
            async run() {
              throw new Error("retired /api/business must not write D1");
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
  assert(res.status === 410 && (data.code === "gone" || data.error === "gone"), "POST /api/business is 410");
  assert(db.rows.length === 0, "410 path does not write D1");
}

{
  const res = await onRequestGet({
    request: new Request("https://dreamutopia-clone.pages.dev/api/business"),
    env: { DB: mockD1(), SESSIONS: mockKv() },
  });
  const data = await res.json();
  assert(res.status === 410 && (data.code === "gone" || data.error === "gone"), "GET /api/business is 410");
}

{
  const res = await postInquiry({}, validBody());
  const data = await res.json();
  assert(res.status === 410, "missing DB binding still 410 (endpoint retired)");
  assert(data.code === "gone" || data.error === "gone", "retired endpoint code is gone");
}

{
  const res = await businessPage({
    request: new Request("https://dreamutopia-clone.pages.dev/business"),
    env: {},
  });
  assert(res.status === 301, "/business page is 301");
  assert(res.headers.get("Location") === "/workspace", "/business Location is /workspace");
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nBusiness unit checks passed (${ok.length})`);
