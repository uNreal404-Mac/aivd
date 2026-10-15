#!/usr/bin/env node
/**
 * Static product checks — no network, no secrets.
 * Run: node scripts/check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const ok = [];

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}
function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}
function mustContain(rel, needle, label) {
  const src = read(rel);
  if (!src.includes(needle)) fail.push(`${label || rel}: missing ${JSON.stringify(needle)}`);
  else ok.push(`${label || rel}: has ${JSON.stringify(needle)}`);
}
function mustNotContain(rel, needle, label) {
  const src = read(rel);
  if (src.includes(needle)) fail.push(`${label || rel}: must not contain ${JSON.stringify(needle)}`);
  else ok.push(`${label || rel}: omits ${JSON.stringify(needle)}`);
}

for (const rel of [
  "functions/api/history.ts",
  "functions/api/jobs.ts",
  "functions/api/creations.ts",
  "functions/api/generations.ts",
]) {
  if (!exists(rel)) fail.push(`missing ${rel} (real file, not a rewrite)`);
  else ok.push(`real file on branch: ${rel}`);
}
mustContain("functions/api/history.ts", 'from "./generate"', "history reuses GET generate");
mustContain("functions/api/jobs.ts", 'from "./generate"', "jobs reuses GET generate");
mustContain("functions/api/creations.ts", 'from "./generate"', "creations reuses GET generate");
mustContain("functions/api/history.ts", "onRequestGet", "history alias GET");
mustContain("functions/api/history.ts", "onRequestHead", "history alias HEAD");
mustContain("functions/api/jobs.ts", "onRequestGet", "jobs alias GET");
mustContain("functions/api/jobs.ts", "onRequestHead", "jobs alias HEAD");
mustContain("functions/api/creations.ts", "onRequestGet", "creations alias GET");
mustContain("functions/api/creations.ts", "onRequestHead", "creations alias HEAD");
mustContain("functions/api/generate.ts", "worker_exception", "POST catch is JSON worker_exception not 1101");
mustContain("functions/api/generate.ts", "generateReady", "history / kie-missing include generateReady");
mustContain("functions/api/generate.ts", "insufficient_credits", "structured insufficient_credits");
mustContain("functions/api/generate.ts", "kie_insufficient_balance", "provider wallet is not user credits");
mustContain("libs/utils.ts", "function workerExceptionJson", "failsafe JSON 500 helper");
mustContain("libs/utils.ts", "function asHead", "HEAD helper");
mustContain("libs/rateLimit.ts", "Math.max(60", "KV expirationTtl min 60s (else 1101)");
{
  const post = read("functions/api/generate.ts");
  const start = post.indexOf("export const onRequestPost");
  const end = post.indexOf("async function handleGeneratePost");
  const fn = start >= 0 && end > start ? post.slice(start, end) : "";
  if (!fn.includes("try {") || !fn.includes("worker_exception")) {
    fail.push("onRequestPost must wrap the whole handler in try/catch → worker_exception JSON");
  } else ok.push("onRequestPost whole-handler try/catch → worker_exception");
  if (fn.includes("throw ")) fail.push("onRequestPost catch must not rethrow (1101)");
  else ok.push("onRequestPost catch does not rethrow");
  const hStart = post.indexOf("async function handleGeneratePost");
  const hEnd = post.indexOf("async function guestRequestError");
  const handle = hStart >= 0 && hEnd > hStart ? post.slice(hStart, hEnd) : "";
  const guestAt = handle.indexOf("guestRequestError");
  const rlAt = handle.indexOf("takeRateLimit");
  if (guestAt < 0 || rlAt < 0 || guestAt > rlAt) {
    fail.push("handleGeneratePost must run guestRequestError before takeRateLimit");
  } else ok.push("guest 4xx runs before KV rate limit (stable no-image JSON)");
  const earlyGuest = handle.indexOf("guestImageRequiredResponse");
  if (earlyGuest < 0 || (rlAt >= 0 && earlyGuest > rlAt)) {
    fail.push("guest no-image 400 must run before takeRateLimit");
  } else ok.push("guest no-image 400 before KV");
}
mustContain("functions/api/_middleware.ts", "worker_exception", "API middleware never 1101");

mustContain("out/assets/js/du.js", "function alertDialog", "P0 auth AlertDialog");
mustContain("out/assets/js/du.js", "showGateDialog", "gated Medium/Pro/image dialog");
mustContain("out/assets/js/du.js", "mapApiError", "human API error map");
mustContain("out/assets/js/du.js", "kie_insufficient_balance", "human provider-balance copy");
mustContain("out/index.html", "No public creations yet", "gallery empty heading");
mustContain("out/index.html", "gallery-empty", "gallery empty placeholder");
mustContain("out/index.html", "gen-sticky", "sticky mobile Generate");
mustContain("out/workspace.html", "gen-sticky", "workspace sticky Generate");
mustContain("out/workspace.html", "preview-skeleton", "generate preview skeleton");
mustContain("out/pricing.html", "支付即将开放", "honest payments-coming-soon note");
mustNotContain("out/pricing.html", "Stripe is not configured yet", "no operator Stripe copy for visitors");
mustContain("out/assets/js/i18n.js", "gallery.empty", "gallery empty i18n");
mustContain("out/assets/js/i18n.js", "price.soon", "payments coming soon i18n");

const CANON = "https://dreamutopia-clone.pages.dev";
const PUBLIC_PAGES = [
  { rel: "out/index.html", path: "/", title: "DreamUtopia — Free AI Image & Video Generator" },
  { rel: "out/pricing.html", path: "/pricing", title: "Pricing Plans | DreamUtopia AI" },
  { rel: "out/workspace.html", path: "/workspace", title: "Workspace — DreamUtopia" },
  { rel: "out/auth.html", path: "/auth", title: "Sign in — DreamUtopia" },
  { rel: "out/privacy.html", path: "/privacy", title: "Privacy Policy — DreamUtopia" },
  { rel: "out/terms.html", path: "/terms", title: "Terms of Service — DreamUtopia" },
  { rel: "out/image-to-video.html", path: "/image-to-video", title: "Image to Video AI — Turn a still into a clip | DreamUtopia" },
  { rel: "out/photo-to-video.html", path: "/photo-to-video", title: "Photo to Video AI — Animate a camera photo | DreamUtopia" },
  { rel: "out/free-ai-video.html", path: "/free-ai-video", title: "Free AI Video Generator — 2 Lite clips, no signup | DreamUtopia" },
  { rel: "out/business.html", path: "/business", title: "AI 短视频代做｜企业定制 1080p 商品视频，单条 ¥299 起" },
];
{
  const titles = new Set();
  const descs = new Set();
  for (const page of PUBLIC_PAGES) {
    const src = read(page.rel);
    const title = (src.match(/<title>([^<]+)<\/title>/) || [])[1];
    const desc = (src.match(/<meta name="description" content="([^"]+)"/) || [])[1];
    if (!title) fail.push(`${page.rel}: missing <title>`);
    else if (titles.has(title)) fail.push(`${page.rel}: duplicate title ${JSON.stringify(title)}`);
    else {
      titles.add(title);
      ok.push(`${page.rel}: unique title`);
    }
    if (title && title !== page.title) fail.push(`${page.rel}: unexpected title ${JSON.stringify(title)}`);
    if (!desc) fail.push(`${page.rel}: missing meta description`);
    else if (descs.has(desc)) fail.push(`${page.rel}: duplicate description`);
    else {
      descs.add(desc);
      ok.push(`${page.rel}: unique description`);
    }
    const canon = `${CANON}${page.path}`;
    if (!src.includes(`rel="canonical" href="${canon}"`)) fail.push(`${page.rel}: missing canonical ${canon}`);
    else ok.push(`${page.rel}: canonical ${canon}`);
    if (!src.includes(`property="og:title"`) || !src.includes(`property="og:description"`) || !src.includes(`property="og:url"`) || !src.includes(`property="og:image"`)) {
      fail.push(`${page.rel}: missing Open Graph tags`);
    } else ok.push(`${page.rel}: Open Graph tags`);
    if (!src.includes(`name="twitter:card"`) || !src.includes(`name="twitter:title"`) || !src.includes(`name="twitter:description"`)) {
      fail.push(`${page.rel}: missing Twitter card tags`);
    } else ok.push(`${page.rel}: Twitter card tags`);
    if (!src.includes('type="application/ld+json"')) fail.push(`${page.rel}: missing JSON-LD`);
    else ok.push(`${page.rel}: JSON-LD`);
  }
}
mustContain("out/index.html", '"@type":"Organization"', "home JSON-LD Organization");
mustContain("out/index.html", '"@type":"WebSite"', "home JSON-LD WebSite");
mustContain("out/pricing.html", '"@type":"SoftwareApplication"', "pricing JSON-LD SoftwareApplication");
mustContain("out/pricing.html", '"@type":"Product"', "pricing JSON-LD Product");
mustContain("out/pricing.html", '"@type":"Offer"', "pricing JSON-LD Offer");
mustContain("out/pricing.html", '"price":"0"', "pricing Offer is free (checkout not live)");
mustContain("out/assets/js/seo.js", CANON, "seo.js pins production origin");
mustContain("libs/site.ts", CANON, "shared canonical origin");
mustContain("libs/site.ts", "PUBLIC_PATHS", "shared public path list");
if (!exists("out/sitemap.xml")) fail.push("missing out/sitemap.xml");
else ok.push("out/sitemap.xml exists");
if (!exists("out/robots.txt")) fail.push("missing out/robots.txt");
else ok.push("out/robots.txt exists");
if (!exists("functions/sitemap.xml.ts")) fail.push("missing functions/sitemap.xml.ts");
else ok.push("functions/sitemap.xml.ts exists");
if (!exists("functions/robots.txt.ts")) fail.push("missing functions/robots.txt.ts");
else ok.push("functions/robots.txt.ts exists");
for (const page of PUBLIC_PAGES) {
  mustContain("out/sitemap.xml", `${CANON}${page.path}`, `sitemap lists ${page.path}`);
  mustContain("functions/sitemap.xml.ts", "PUBLIC_PATHS", "function sitemap uses PUBLIC_PATHS");
}
mustContain("out/robots.txt", `Sitemap: ${CANON}/sitemap.xml`, "robots points at production sitemap");
mustContain("out/robots.txt", "Disallow: /api/", "robots disallows API");
mustContain("functions/robots.txt.ts", "CANONICAL_ORIGIN", "function robots uses canonical origin");

mustContain("out/pricing.html", 'id="rules"', "pricing rules section");
mustContain("out/pricing.html", "Watermark", "pricing watermark rule");
mustContain("out/pricing.html", "Refund policy", "pricing refund rule");
mustContain("out/pricing.html", "Credit expiration", "pricing expiration rule");
mustContain("out/pricing.html", "do not expire", "honest credits do not expire");
mustContain("out/assets/js/i18n.js", "price.rules.mark.h", "pricing rules i18n");
mustContain("out/pricing.html", "$5", "starter price unchanged");
mustContain("out/pricing.html", "$25", "plus price unchanged");
mustContain("out/pricing.html", "$90", "pro price unchanged");
mustContain("out/pricing.html", "$200", "premium price unchanged");
mustContain("out/pricing.html", "10 credits", "starter credits unchanged");
mustContain("out/pricing.html", "50 credits", "plus credits unchanged");
mustContain("out/pricing.html", "200 credits", "pro credits unchanged");
mustContain("out/pricing.html", "500 credits", "premium credits unchanged");

mustContain("out/workspace.html", 'id="historyEmpty" hidden', "history empty starts hidden (not enabled while parent is display:none)");
mustContain("out/workspace.html", "function setHistoryEmptyVisible", "empty state only enabled on History tab");
mustContain("out/workspace.html", "function historyTabActive", "empty visibility gated on History tab");

mustContain("libs/account.ts", "export async function mergeGuestJobs", "guest jobs migrate on register/login");
mustContain("functions/api/auth/register.ts", "mergeGuestJobs", "register copies this guest cookie's jobs");
mustContain("functions/api/auth/login.ts", "mergeGuestJobs", "login copies this guest cookie's jobs");
mustContain("functions/api/auth/me.ts", "mergedJobs", "me reports how many guest jobs were copied");
mustContain("out/auth.html", 'credentials: "same-origin"', "auth fetch sends HttpOnly du_guest cookie");
mustContain("out/workspace.html", 'id="guestPersistNotice"', "workspace guest persist notice");
mustContain("out/assets/js/i18n.js", "ws.guest.persist", "guest persist notice i18n");
mustContain("out/assets/js/i18n.js", "Your creations are saved only in this browser until you sign up.", "guest persist English copy");
mustContain("libs/stripe.ts", "metadata[user_id]", "checkout metadata.user_id");
mustContain("libs/stripe.ts", "metadata[pack]", "checkout metadata.pack");
mustContain("libs/stripe.ts", "metadata[credits]", "checkout metadata.credits");
mustContain("libs/stripe.ts", "metadata[site]", "checkout metadata.site");
mustContain("libs/stripe.ts", 'PAYMENT_SITE', "site slug imported for Stripe metadata");
mustContain("libs/site.ts", 'export const PAYMENT_SITE = "dreamutopia"', "PAYMENT_SITE is dreamutopia");
mustContain("libs/stripe.ts", "/workspace?checkout=success", "success_url is /workspace");
mustContain("libs/stripe.ts", "/workspace?checkout=cancel", "cancel_url is /workspace");
mustContain("libs/stripe.ts", 'params.set("mode", "payment")', "Checkout Session mode=payment");
mustContain("libs/stripe.ts", "price_data", "inline price_data (no pre-created price IDs)");
mustContain("libs/stripe.ts", "hmacSha256Hex", "webhook HMAC-SHA256 via Web Crypto");
mustContain("libs/stripe.ts", "toleranceSec", "Stripe timestamp tolerance");
mustContain("libs/stripe.ts", "payment_status", "grant requires payment_status");
mustContain("libs/stripe.ts", 'reason: "other_site"', "foreign-site Stripe events ignored");
mustContain("functions/api/checkout.ts", "env.STRIPE_SECRET_KEY", "checkout reads STRIPE_SECRET_KEY from env");
mustContain("functions/api/webhooks/stripe.ts", "env.STRIPE_WEBHOOK_SECRET", "webhook reads STRIPE_WEBHOOK_SECRET from env");
mustContain("functions/api/webhooks/stripe.ts", "checkoutGrantDecision", "webhook uses site/payment filters");
mustContain("functions/api/stripe/webhook.ts", 'from "../webhooks/stripe"', "POST /api/stripe/webhook alias");
mustContain("libs/account.ts", "INSERT INTO stripe_sessions", "idempotent grant records stripe session id");
mustContain("migrations/005_stripe_sessions.sql", "CREATE TABLE IF NOT EXISTS stripe_sessions", "D1 stripe_sessions migration");
mustContain("migrations/005_stripe_sessions.sql", "session_id TEXT PRIMARY KEY", "stripe_sessions unique session id");
mustContain("migrations/005_stripe_sessions.sql", "npx wrangler d1 execute dreamutopia-db --remote --file=migrations/005_stripe_sessions.sql", "migration command documented");
mustContain("schema.sql", "CREATE TABLE IF NOT EXISTS stripe_sessions", "fresh schema includes stripe_sessions");
mustContain("out/pricing.html", 'fetch("/api/checkout"', "pricing Select calls /api/checkout");
mustContain("out/pricing.html", 'method: "POST"', "logged-in Select POSTs checkout");
mustContain("out/pricing.html", "packAuthHref", "guests register first with pack param");
mustContain("out/pricing.html", "/auth?mode=register&pack=", "guest Select keeps pack query");
mustNotContain("libs/stripe.ts", "console.log", "stripe lib never logs (keys)");
mustNotContain("functions/api/checkout.ts", "console.log", "checkout never logs");
mustNotContain("functions/api/webhooks/stripe.ts", "console.log", "webhook never logs");
mustNotContain("libs/stripe.ts", "sk_live", "no hardcoded live Stripe secret");
mustNotContain("libs/stripe.ts", "sk_test", "no hardcoded test Stripe secret");
mustNotContain("libs/stripe.ts", "whsec_", "no hardcoded webhook secret");
mustNotContain("functions/api/checkout.ts", "sk_live", "checkout has no hardcoded Stripe key");
mustNotContain("functions/api/webhooks/stripe.ts", "whsec_", "webhook has no hardcoded signing secret");
if (!exists("scripts/test-stripe.mjs")) fail.push("missing scripts/test-stripe.mjs");
else ok.push("scripts/test-stripe.mjs exists");
if (!exists("migrations/005_stripe_sessions.sql")) fail.push("missing migrations/005_stripe_sessions.sql");
else ok.push("migrations/005_stripe_sessions.sql exists");

mustContain("libs/kie.ts", "nano-banana-2-lite", "image-lite uses official KIE lite model");
mustContain("libs/kie.ts", "export function buildImageTaskSpec", "image payload is unit-testable");
mustContain("libs/kie.ts", "export function mapKieTaskOutcome", "KIE state mapping is unit-testable");
mustContain("functions/api/generate.ts", 'tier: model === "pro" ? "pro" : "lite"', "generate passes image tier");
mustNotContain("libs/costs.ts", "lite: 2", "image lite cost stays 1");
mustContain("libs/costs.ts", "lite: 1", "image lite cost unchanged");
mustContain("libs/costs.ts", "pro: 2", "image pro cost unchanged");
mustContain("libs/costs.ts", "lite: 3", "video lite cost unchanged");
if (!exists("scripts/test-p1.mjs")) fail.push("missing scripts/test-p1.mjs");
else ok.push("scripts/test-p1.mjs exists");

mustContain("out/business.html", "<h1 data-i18n=\"biz.h1\">企业 AI 短视频定制</h1>", "business H1 is 企业 AI 短视频定制");
mustContain("out/business.html", 'localStorage.setItem("du_lang", "zh")', "business defaults to zh when no saved lang");
mustContain("out/business.html", "人工交付，先报价", "business human-delivery badge");
mustContain("out/business.html", "免费查看行业样片，先报价再制作", "business sample copy");
mustContain("out/business.html", "24 小时内报价", "business 24h quote");
mustContain("out/business.html", "我们会在 24 小时内联系您报价", "business success copy");
mustContain("out/business.html", "单条 ¥299 起", "business single starting price");
mustContain("out/business.html", "30 条月包 ¥2980 起", "business monthly pack starting price");
mustContain("out/business.html", "参考价，最终以报价为准", "business reference-price note");
mustContain("out/business.html", "0_out_f7d00e65d3c1a45d.mp4", "reuses existing 1080p sample A");
mustContain("out/business.html", "0_out_68e31a44b7b1d011.mp4", "reuses existing 1080p sample B");
mustContain("out/business.html", "0_out_980c5a0e163959b6.mp4", "reuses existing 1080p sample C");
mustContain("out/business.html", 'name="website"', "business honeypot field");
mustNotContain("out/business.html", "免费样片", "do not call samples 免费样片");
mustNotContain("out/business.html", "¥799", "no single-clip upper price");
mustNotContain("out/business.html", "¥4980", "no monthly-pack upper price");
mustNotContain("out/business.html", "/api/checkout", "business has no checkout");
mustNotContain("out/business.html", "Stripe", "business has no Stripe");
mustNotContain("out/business.html", "立即支付", "business has no pay CTA");
mustContain("out/assets/js/i18n.js", "biz.form.ok", "business i18n");
mustContain("migrations/007_business_inquiries.sql", "CREATE TABLE IF NOT EXISTS business_inquiries", "D1 business_inquiries migration");
mustContain("migrations/007_business_inquiries.sql", "created_at", "business_inquiries has created_at");
mustContain("schema.sql", "CREATE TABLE IF NOT EXISTS business_inquiries", "fresh schema includes business_inquiries");
mustContain("functions/api/business.ts", "validateBusinessInquiry", "business API validates");
mustContain("functions/api/business.ts", "insertBusinessInquiry", "business API writes D1");
mustContain("libs/site.ts", '"/business"', "PUBLIC_PATHS includes /business");
if (!exists("scripts/test-business.mjs")) fail.push("missing scripts/test-business.mjs");
else ok.push("scripts/test-business.mjs exists");

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nAll checks passed (${ok.length})`);

const unit = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    path.join(root, "scripts/register-ts-bare.mjs"),
    path.join(root, "scripts/test-p1.mjs"),
  ],
  { encoding: "utf8", cwd: root }
);
process.stdout.write(unit.stdout || "");
process.stderr.write(unit.stderr || "");
if (unit.status !== 0) {
  console.log("FAIL scripts/test-p1.mjs");
  process.exit(unit.status || 1);
}

const stripeUnit = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    path.join(root, "scripts/register-ts-bare.mjs"),
    path.join(root, "scripts/test-stripe.mjs"),
  ],
  { encoding: "utf8", cwd: root }
);
process.stdout.write(stripeUnit.stdout || "");
process.stderr.write(stripeUnit.stderr || "");
if (stripeUnit.status !== 0) {
  console.log("FAIL scripts/test-stripe.mjs");
  process.exit(stripeUnit.status || 1);
}

const bizUnit = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    path.join(root, "scripts/register-ts-bare.mjs"),
    path.join(root, "scripts/test-business.mjs"),
  ],
  { encoding: "utf8", cwd: root }
);
process.stdout.write(bizUnit.stdout || "");
process.stderr.write(bizUnit.stderr || "");
if (bizUnit.status !== 0) {
  console.log("FAIL scripts/test-business.mjs");
  process.exit(bizUnit.status || 1);
}
