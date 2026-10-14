#!/usr/bin/env node
/**
 * Static product checks — no network, no secrets.
 * Run: node scripts/check.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nAll checks passed (${ok.length})`);
