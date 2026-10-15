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
mustContain("out/workspace.html", 'id="wsH1"', "workspace H1 id");
mustContain("out/workspace.html", "Create AI Videos from Images", "workspace H1 copy");
mustContain("out/workspace.html", 'id="composerDock"', "left parameter panel");
mustContain("out/workspace.html", 'class="panel-scroll"', "left panel scrolls above pinned Generate");
mustContain("out/workspace.html", 'class="chip-dock"', "model/duration/aspect/resolution chips stay pinned");
mustContain("out/workspace.html", 'class="ws-stage"', "left params + right history stage");
mustContain("out/workspace.html", 'id="presetCard"', "preset look card");
mustContain("out/workspace.html", 'id="genCost"', "Generate button shows credit cost");
mustContain("out/workspace.html", 'id="resolutionRow"', "resolution chip selector");
mustContain("out/workspace.html", "DU.alertDialog", "Generate asks login when logged out");
mustContain("out/workspace.html", 'data-i18n="ws.tab.history"', "right canvas History tab");
mustContain("out/workspace.html", 'data-i18n="ws.tab.how"', "right canvas How it works tab");
mustContain("out/assets/js/i18n.js", '"ws.tab.history": "History"', "History tab English copy");
{
  const src = read("out/workspace.html");
  const start = src.indexOf("async function generate()");
  const end = src.indexOf("function resetGenBtn()");
  const body = start >= 0 && end > start ? src.slice(start, end) : "";
  const closedAt = body.indexOf("generationIsClosed");
  const tokenAt = body.indexOf("if (!token)");
  const loginAt = body.indexOf("DU.alertDialog");
  if (closedAt < 0 || tokenAt < 0 || loginAt < 0 || !(closedAt < tokenAt && tokenAt < loginAt)) {
    fail.push("generate() must show 暂未开放 when closed, then login wall when logged out");
  } else ok.push("generate() closed-first then login dialog for guests");
}
mustContain("out/workspace.html", 'id="audioRow"', "audio chip selector");
mustContain("out/workspace.html", 'id="durationRow"', "duration chip selector");
mustContain("out/workspace.html", 'id="aspectRow"', "aspect chip selector");
mustContain("out/workspace.html", 'id="lastUploadArea"', "end-frame card");
mustContain("out/workspace.html", "Start frame", "start-frame card label");
mustContain("out/workspace.html", "End frame", "end-frame card label");
mustContain("out/workspace.html", "function generationIsClosed", "Generate stays closed when flag is off");
mustContain("out/workspace.html", "function pickAudio", "audio chip maps to existing Pro model");
mustContain("out/workspace.html", "lastFrameOn", "last-frame payload still Medium/Pro only");
mustNotContain("out/workspace.html", 'href="/business"', "workspace Generate does not fall back to /business");
mustNotContain("out/workspace.html", "/api/media?", "server HTML has no user-work media URLs");
mustNotContain("out/workspace.html", 'name="robots"', "static /workspace HTML has no robots noindex");
mustContain("out/index.html", 'property="og:title" content="AI Image & Video Generator | DreamUtopia"', "home og:title drops Free");
mustContain("out/index.html", 'name="twitter:title" content="AI Image & Video Generator | DreamUtopia"', "home twitter:title drops Free");
mustContain("out/assets/js/seo.js", 'meta("property", "og:title", title, true)', "seo.js keeps authored og:title");
mustContain("libs/workspaceSeo.ts", "applyWorkspaceHtmlSeo", "workspace HTML SEO helper");
mustContain("libs/workspaceSeo.ts", "HTMLRewriter", "workspace SEO uses HTMLRewriter on Pages");
mustContain("libs/workspaceSeo.ts", "rewriteWorkspaceHtmlResponse", "workspace SEO response rewriter");
mustContain("functions/_middleware.ts", "rewriteWorkspaceHtmlResponse", "Pages middleware rewrites /workspace HTML");
mustContain("out/_routes.json", '"/workspace"', "Functions include /workspace so SEO middleware runs");
mustContain("out/_routes.json", '"/workspace.html"', "Functions include /workspace.html alias");
mustContain("out/_routes.json", '"/workspace/"', "Functions include /workspace/ alias");
mustContain("functions/api/upload-ticket.ts", "isGenerationEnabled", "upload-ticket honors GENERATION_ENABLED");
mustContain("functions/api/upload-ticket.ts", "generationDisabledResponse", "upload-ticket returns 503 when closed");
mustContain("out/pricing.html", "支付即将开放", "honest payments-coming-soon note");
mustContain("out/pricing.html", 'id="checkoutNote"', "pricing top checkout banner");
mustContain("out/pricing.html", 'class="checkout-note show"', "coming-soon banner visible before JS");
mustNotContain("out/pricing.html", "Stripe is not configured yet", "no operator Stripe copy for visitors");
mustContain("out/assets/js/i18n.js", "gallery.empty", "gallery empty i18n");
mustContain("out/assets/js/i18n.js", "price.soon", "payments coming soon i18n");

const CANON = "https://dreamutopia-clone.pages.dev";
const BRAND = (read("libs/site.ts").match(/export const BRAND_NAME = "([^"]+)"/) || [])[1] || "";
if (!BRAND) fail.push("libs/site.ts must export BRAND_NAME");
else ok.push(`BRAND_NAME is ${JSON.stringify(BRAND)}`);
mustContain("libs/examples.ts", "BRAND_NAME", "examples pages read BRAND_NAME");
mustNotContain("libs/examples.ts", "DreamUtopia", "examples.ts does not hardcode DreamUtopia");
const PUBLIC_PAGES = [
  { rel: "out/index.html", path: "/", title: "DreamUtopia — Free AI Image & Video Generator" },
  { rel: "out/pricing.html", path: "/pricing", title: "Pricing Plans | DreamUtopia AI" },
  { rel: "out/workspace.html", path: "/workspace", title: "AI Video Generator – Turn Photos into Videos | DreamUtopia" },
  { rel: "out/auth.html", path: "/auth", title: "Sign in — DreamUtopia" },
  { rel: "out/privacy.html", path: "/privacy", title: "Privacy Policy — DreamUtopia" },
  { rel: "out/terms.html", path: "/terms", title: "Terms of Service — DreamUtopia" },
  { rel: "out/image-to-video.html", path: "/image-to-video", title: "Image to Video AI — Turn a still into a clip | DreamUtopia" },
  { rel: "out/photo-to-video.html", path: "/photo-to-video", title: "Photo to Video AI — Animate a camera photo | DreamUtopia" },
  { rel: "out/free-ai-video.html", path: "/free-ai-video", title: "Free AI Video Generator — 2 Lite clips, no signup | DreamUtopia" },
  { rel: "out/examples.html", path: "/examples", title: `AI Video Examples – Image to Video Samples | ${BRAND}` },
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
mustContain("functions/sitemap.xml.ts", "exampleDetailPaths", "function sitemap lists /examples/{slug}");
mustContain("out/index.html", 'href="/examples"', "home links to /examples");
mustContain("out/workspace.html", 'href="/examples"', "workspace links to /examples");
mustNotContain("out/examples.html", "href=\"/business\"", "examples list has no /business");
mustContain("out/_routes.json", '"/examples/*"', "Pages Functions include /examples/* so slug routes run");
{
  const routes = JSON.parse(read("out/_routes.json"));
  const include = routes.include || [];
  const hasExact = include.includes("/examples") || include.includes("/examples/");
  const hasSplat = include.includes("/examples/*");
  if (hasExact && hasSplat) {
    fail.push("wrangler rejects overlapping /examples and /examples/* — keep splat only; list is static HTML");
  } else ok.push("examples routes do not overlap a splat with an exact /examples rule");
  if (!hasSplat) fail.push("include must contain /examples/* so /examples/{slug} Functions run");
  else ok.push("/examples/* is on the Functions whitelist");
}
{
  const listDesc = (read("out/examples.html").match(/<meta name="description" content="([^"]+)"/) || [])[1] || "";
  if (/free|instant/i.test(listDesc)) fail.push("examples list description must not contain free/instant");
  else ok.push("examples list description omits free/instant");
  if (!exists("out/examples")) fail.push("missing out/examples/ detail HTML");
  else {
    const files = fs.readdirSync(path.join(root, "out/examples")).filter((f) => f.endsWith(".html"));
    if (files.length < 3) fail.push("out/examples/ must contain at least 3 sample pages");
    else ok.push(`out/examples/ has ${files.length} sample pages`);
    for (const file of files) {
      const rel = `out/examples/${file}`;
      const slug = file.replace(/\.html$/, "");
      const src = read(rel);
      const title = (src.match(/<title>([^<]+)<\/title>/) || [])[1] || "";
      const desc = (src.match(/<meta name="description" content="([^"]+)"/) || [])[1] || "";
      const h1 = (src.match(/<h1>([^<]+)<\/h1>/) || [])[1] || "";
      const titleRe = new RegExp(` AI Video – .+ from a Photo \\| ${BRAND.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
      const descRe = new RegExp(
        `^See how this .+ photo became a 5s 1080p AI video with .+\\. Prompt included\\. Try a similar style in ${BRAND.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.$`
      );
      if (!titleRe.test(title)) fail.push(`${rel}: title must follow {Subject} AI Video – {Style} from a Photo | ${BRAND}`);
      else ok.push(`${rel}: title pattern`);
      if (!descRe.test(desc)) {
        fail.push(`${rel}: description must follow the specified template`);
      } else ok.push(`${rel}: description template`);
      if (!/ AI Video$/.test(h1)) fail.push(`${rel}: H1 must be {Subject} AI Video`);
      else ok.push(`${rel}: H1 pattern`);
      if (/free|instant/i.test(desc)) fail.push(`${rel}: description must not contain free/instant`);
      else ok.push(`${rel}: description omits free/instant`);
      if (!src.includes('"@type":"VideoObject"')) fail.push(`${rel}: missing VideoObject JSON-LD`);
      else ok.push(`${rel}: VideoObject JSON-LD`);
      if (!src.includes(`rel="canonical" href="${CANON}/examples/${slug}"`)) fail.push(`${rel}: missing self canonical`);
      else ok.push(`${rel}: self canonical`);
      if (!src.includes('href="/workspace"')) fail.push(`${rel}: missing Workspace button`);
      else ok.push(`${rel}: Workspace button`);
      mustContain("out/sitemap.xml", `${CANON}/examples/${slug}`, `sitemap lists /examples/${slug}`);
    }
  }
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
mustContain("out/workspace.html", 'class="history-grid"', "History canvas is a grid/waterfall");
mustContain("out/workspace.html", 'id="historyFilter"', "History has a simple kind filter");
mustContain("out/workspace.html", 'data-filter="video"', "History can filter videos");
mustContain("out/workspace.html", 'data-filter="image"', "History can filter images");
mustContain("out/workspace.html", 'id="historyDetail"', "History detail modal");
mustContain("out/workspace.html", 'id="historyDetailPrompt"', "detail shows prompt");
mustContain("out/workspace.html", 'id="historyDetailModel"', "detail shows model");
mustContain("out/workspace.html", 'id="historyDetailDuration"', "detail shows duration");
mustContain("out/workspace.html", 'id="historyDetailAspect"', "detail shows aspect");
mustContain("out/workspace.html", 'id="historyDetailResolution"', "detail shows resolution");
mustContain("out/workspace.html", 'id="historyDetailCredits"', "detail shows credits used");
mustContain("out/workspace.html", 'id="historyDetailCreated"', "detail shows created time");
mustContain("out/workspace.html", "function refillFromGeneration", "regenerate fills left-rail params");
mustContain("out/workspace.html", "function copyHistoryPrompt", "copy prompt from own work");
mustContain("out/workspace.html", "bindHistoryHoverPreview", "video hover preview");
mustContain("out/workspace.html", "filterOwnWorks", "own-work filter helper");
mustContain("out/workspace.html", 'api("/history")', "works load from /api/history");
mustContain("out/workspace.html", 'api("/generations")', "works fall back to /api/generations");
mustContain("out/workspace.html", "DU.downloadResult", "gallery download reuses DU.downloadResult");
mustNotContain("out/workspace.html", "Featured Creators", "History is not a community feed");
mustContain("out/assets/js/i18n.js", '"ws.history.regen": "Regenerate"', "regenerate English copy");
mustContain("out/assets/js/i18n.js", '"ws.history.copy": "Copy prompt"', "copy prompt English copy");
mustContain("libs/historyGallery.ts", "filterOwnWorks", "history gallery helpers for mock tests");
mustContain("libs/historyGallery.ts", "creditCostForItem", "credit display derived client-side");

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
mustContain("out/assets/js/du.js", "const PAYMENTS_ENABLED = false", "PAYMENTS_ENABLED defaults off");
mustContain("out/assets/js/du.js", "PAYMENTS_ENABLED: PAYMENTS_ENABLED", "shared payments flag exported on DU");
mustContain("out/pricing.html", "DU.PAYMENTS_ENABLED", "pricing gates Stripe CTAs on PAYMENTS_ENABLED");
mustContain("out/pricing.html", "applyComingSoon", "pricing defaults to 支付即将开放 path");
mustContain("out/pricing.html", 'fetch("/api/checkout"', "live path can still POST /api/checkout when flag is on");
mustContain("out/pricing.html", 'method: "POST"', "live path POSTs checkout when payments are enabled");
mustContain("out/pricing.html", "packAuthHref", "guests register first with pack param");
mustContain("out/pricing.html", "/auth?mode=register&pack=", "guest Select keeps pack query");
mustContain("out/workspace.html", "DU.PAYMENTS_ENABLED", "workspace Buy with Stripe honors payments flag");
mustContain("out/auth.html", 'setAttribute("content", document.title)', "auth og:title tracks document.title");
{
  const src = read("out/pricing.html");
  const start = src.indexOf("(async function init()");
  const end = src.indexOf("})();", start);
  const init = start >= 0 && end > start ? src.slice(start, end) : "";
  const flagAt = init.indexOf("PAYMENTS_ENABLED");
  const probeAt = init.indexOf("checkoutAvailable");
  const soonAt = init.indexOf("applyComingSoon");
  if (flagAt < 0 || soonAt < 0) {
    fail.push("pricing init must check PAYMENTS_ENABLED and apply coming-soon copy");
  } else ok.push("pricing init checks PAYMENTS_ENABLED and applyComingSoon");
  if (probeAt >= 0 && flagAt > probeAt) {
    fail.push("pricing must honor PAYMENTS_ENABLED before probing /api/checkout");
  } else ok.push("pricing does not probe /api/checkout while payments are off");
}
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

mustContain("libs/generation.ts", 'env.GENERATION_ENABLED === "true"', "only exact true opens generation");
mustContain("libs/generation.ts", "暂未开放", "closed generate message is 暂未开放");
mustContain("libs/generation.ts", "WORKSPACE_PATH", "marketing CTAs go to /workspace");
mustContain("libs/generation.ts", '"/workspace"', "workspace path is /workspace");
mustNotContain("libs/generation.ts", '"/business"', "generation lib has no /business CTA");
mustNotContain("libs/generation.ts", "企业定制询价", "generation lib has no quote CTA");
mustContain("functions/api/generate.ts", "isGenerationEnabled", "generate POST honors GENERATION_ENABLED");
mustContain("functions/api/generate.ts", "generationDisabledResponse", "generate POST returns 503 when closed");
mustContain("functions/api/upload.ts", "isGenerationEnabled", "upload honors GENERATION_ENABLED");
{
  const src = read("functions/api/upload.ts");
  const getStart = src.indexOf("export const onRequestGet");
  const postStart = src.indexOf("export const onRequestPost");
  const getFn = getStart >= 0 && postStart > getStart ? src.slice(getStart, postStart) : "";
  const postFn = postStart >= 0 ? src.slice(postStart) : "";
  if (!getFn.includes("isGenerationEnabled") || !getFn.includes("generationDisabledResponse")) {
    fail.push("GET /api/upload must return 503 when generation is off");
  } else ok.push("GET /api/upload checks GENERATION_ENABLED before probing");
  if (!postFn.includes("isGenerationEnabled") || !postFn.includes("generationDisabledResponse")) {
    fail.push("POST /api/upload must return 503 when generation is off");
  } else ok.push("POST /api/upload checks GENERATION_ENABLED before R2/KIE");
}
mustContain("functions/api/health.ts", "generationEnabled", "health exposes generationEnabled");
mustContain("functions/api/health.ts", "guestTrials: generationEnabled", "health guestTrials follows generation kill switch");
mustContain(
  "functions/api/health.ts",
  "Generation disabled (GENERATION_ENABLED off) — demo only, no free tries",
  "health message when generation is off"
);
mustContain("wrangler.toml", 'GENERATION_ENABLED = "false"', "Pages var defaults generation off");
mustContain("out/assets/js/du.js", "applyGenerationCtas", "shared CTA switch helper");
mustNotContain("out/assets/js/du.js", "/business", "du.js has no /business");
mustNotContain("out/assets/js/du.js", 'kind === "quote"', "quote CTA branch removed from du.js");
mustNotContain("out/assets/js/i18n.js", "nav.business", "i18n has no nav.business");
mustNotContain("out/assets/js/i18n.js", "cta.quote", "i18n has no cta.quote");
mustContain("out/assets/js/i18n.js", "cta.samples", "查看样片 i18n");
mustContain("out/assets/js/i18n.js", "gen.closed", "暂未开放 i18n");
mustContain("out/index.html", 'data-gen-cta="samples"', "home generate CTAs are switchable");
mustContain("out/index.html", 'href="/workspace"', "home CTAs link to /workspace");
mustNotContain("out/index.html", 'href="/business"', "home has no /business links");
mustNotContain("out/index.html", 'location.href = "/business"', "home generate does not send users to /business");
mustContain("out/index.html", 'location.href = "/workspace"', "closed home generate goes to /workspace");
mustNotContain("out/workspace.html", 'href="/business"', "workspace footer has no /business");
mustContain("out/image-to-video.html", 'href="/workspace"', "image-to-video CTA goes to /workspace");
mustNotContain("out/image-to-video.html", 'href="/business"', "image-to-video has no /business");
mustContain("out/photo-to-video.html", 'href="/workspace"', "photo-to-video CTA goes to /workspace");
mustNotContain("out/photo-to-video.html", 'href="/business"', "photo-to-video has no /business");
mustContain("out/free-ai-video.html", 'href="/workspace"', "free-ai-video CTA goes to /workspace");
mustNotContain("out/free-ai-video.html", 'href="/business"', "free-ai-video has no /business");
mustNotContain("out/sitemap.xml", "/business", "sitemap omits /business");
mustContain("out/workspace.html", 'DU.t("gen.closed"', "workspace shows 暂未开放 when closed");
mustContain("out/assets/js/du.js", `const BRAND_NAME = "${BRAND}"`, "du.js BRAND_NAME matches libs/site.ts");
mustContain("out/assets/js/du.js", "BRAND_NAME: BRAND_NAME", "DU exports BRAND_NAME");
{
  const duBrand = (read("out/assets/js/du.js").match(/const BRAND_NAME = "([^"]+)"/) || [])[1] || "";
  if (!BRAND || duBrand !== BRAND) fail.push(`frontend DU.BRAND_NAME ${JSON.stringify(duBrand)} must equal libs/site.ts ${JSON.stringify(BRAND)}`);
  else ok.push("DU.BRAND_NAME and libs/site.ts BRAND_NAME are the same source value");
}
mustContain("out/assets/js/demo.js", "演示样片 / Demo sample", "demo badge copy");
mustContain("out/assets/js/demo.js", "function runGenerate", "demo generate helper");
mustContain("out/workspace.html", 'src="/assets/js/demo.js"', "workspace loads demo.js");
mustContain("out/workspace.html", 'id="demoSampleBadge"', "workspace result badge");
mustContain("out/workspace.html", "Try demo", "visible Try demo entry");
mustContain("out/workspace.html", "function generateDemoFlow", "demo generate does not use live generate");
mustContain("out/workspace.html", "demoActive()", "workspace branches on demo mode");
mustContain("out/index.html", 'href="/workspace?demo=1"', "home has Try demo entry");
mustContain("out/robots.txt", "Disallow: /demo", "robots disallows /demo");
mustContain("functions/robots.txt.ts", "Disallow: /demo", "function robots disallows /demo");
mustContain("wrangler.toml", 'GENERATION_ENABLED = "false"', "demo work does not turn generation on");
{
  const demoSrc = read("out/assets/js/demo.js");
  const flowStart = read("out/workspace.html").indexOf("async function generateDemoFlow()");
  const flowEnd = read("out/workspace.html").indexOf("async function generate()");
  const flow = flowStart >= 0 && flowEnd > flowStart ? read("out/workspace.html").slice(flowStart, flowEnd) : "";
  if (flow.includes("/api/generate") || flow.includes("/api/upload") || flow.includes("upload-ticket")) {
    fail.push("generateDemoFlow must not mention /api/generate, /api/upload, or upload-ticket");
  } else ok.push("generateDemoFlow has no generate/upload API URLs");
  const genStart = read("out/workspace.html").indexOf("async function generate()");
  const genEnd = read("out/workspace.html").indexOf("function resetGenBtn()");
  const gen = genStart >= 0 && genEnd > genStart ? read("out/workspace.html").slice(genStart, genEnd) : "";
  const demoAt = gen.indexOf("demoActive()");
  const closedAt = gen.indexOf("generationIsClosed");
  if (demoAt < 0 || closedAt < 0 || demoAt > closedAt) {
    fail.push("generate() must take the demo path before the 暂未开放 closed gate");
  } else ok.push("generate() demo path runs before closed 暂未开放 gate");
  const copyRe = /"(demo\.[^"]+)":\s*"([^"]*)"/g;
  let m;
  let i18nCopy = 0;
  const i18nSrc = read("out/assets/js/i18n.js");
  while ((m = copyRe.exec(i18nSrc))) {
    i18nCopy += 1;
    const val = m[2];
    if (/clone/i.test(val) || val.includes("暂未开放")) {
      fail.push(`demo i18n ${m[1]} must not contain clone or 暂未开放`);
    }
  }
  if (i18nCopy < 8) fail.push("expected demo.* i18n keys");
  else ok.push("demo i18n keys omit clone and 暂未开放");
  if (!demoSrc.includes("TODO:")) fail.push("demo sample list must mark TODO placeholders");
  else ok.push("demo sample list has TODO placeholders");
}
{
  const metas = [
    ["out/index.html", "Start free — no account needed", "home"],
    ["out/image-to-video.html", "Two free Lite clips per device", "image-to-video"],
    ["out/photo-to-video.html", "Two free Lite tries", "photo-to-video"],
    ["out/free-ai-video.html", "two Lite image-to-video clips per device with no account", "free-ai-video"],
  ];
  for (const [rel, needle, label] of metas) {
    const src = read(rel);
    const desc = src.match(/<meta name="description" content="([^"]+)"/);
    if (!desc) fail.push(`${label} missing meta description`);
    else if (desc[1].includes(needle)) fail.push(`${label} meta description still promises ${JSON.stringify(needle)}`);
    else ok.push(`${label} meta description no longer promises ${JSON.stringify(needle)}`);
    if (!src.includes("Public generation is not open yet")) {
      fail.push(`${label} meta should say public generation is not open yet`);
    } else ok.push(`${label} meta says generation is not open yet`);
  }
}
{
  const post = read("functions/api/generate.ts");
  const start = post.indexOf("export const onRequestPost");
  const end = post.indexOf("async function handleGeneratePost");
  const fn = start >= 0 && end > start ? post.slice(start, end) : "";
  const flagAt = fn.indexOf("isGenerationEnabled");
  const handleAt = fn.indexOf("handleGeneratePost");
  if (flagAt < 0 || handleAt < 0 || flagAt > handleAt) {
    fail.push("onRequestPost must return 503 before handleGeneratePost when generation is off");
  } else ok.push("onRequestPost checks GENERATION_ENABLED before handleGeneratePost");
}
if (!exists("scripts/test-generation-gate.mjs")) fail.push("missing scripts/test-generation-gate.mjs");
else ok.push("scripts/test-generation-gate.mjs exists");

mustContain("out/_redirects", "/business /workspace 301", "legacy /business 301s to /workspace");
mustContain("out/_redirects", "/business.html /workspace 301", "legacy /business.html 301s to /workspace");
mustContain("out/_routes.json", '"/business"', "Pages Functions include /business so the 301 function runs");
mustContain("functions/business.ts", "301", "/business function returns 301");
mustContain("functions/business.ts", "/workspace", "/business redirects to /workspace");
if (exists("out/business.html")) fail.push("out/business.html must be removed so /business cannot serve the quote page");
else ok.push("out/business.html removed");
mustContain("functions/api/business.ts", "410", "POST/GET /api/business is 410");
mustNotContain("functions/api/business.ts", "insertBusinessInquiry", "business API no longer writes inquiries");
mustNotContain("libs/site.ts", '"/business"', "PUBLIC_PATHS omits /business");
mustContain("migrations/007_business_inquiries.sql", "CREATE TABLE IF NOT EXISTS business_inquiries", "D1 business_inquiries migration kept");
mustContain("schema.sql", "CREATE TABLE IF NOT EXISTS business_inquiries", "fresh schema still includes business_inquiries");
if (!exists("scripts/test-business.mjs")) fail.push("missing scripts/test-business.mjs");
else ok.push("scripts/test-business.mjs exists");
if (!exists("workers/feishu-bot/wrangler.toml")) fail.push("feishu bot worker must stay in the repo");
else ok.push("feishu bot worker left in place");
if (!exists("workers/feishu-bot/src/config.mjs")) fail.push("feishu bot must keep a copy-friendly src/config.mjs");
else ok.push("feishu bot has src/config.mjs");
if (!exists("workers/feishu-bot/TEMPLATE.md")) fail.push("feishu bot must document copy steps in TEMPLATE.md");
else ok.push("feishu bot has TEMPLATE.md");
mustContain("workers/feishu-bot/src/config.mjs", "github-issue-comments", "progress command is config-driven");
mustContain("workers/feishu-bot/src/config.mjs", "github-create-issue", "request command is config-driven");
mustContain("workers/feishu-bot/README.md", "GITHUB_TOKEN", "bot README names GITHUB_TOKEN");
mustContain("workers/feishu-bot/README.md", "GITHUB_WEBHOOK_SECRET", "bot README names GITHUB_WEBHOOK_SECRET");
mustContain("workers/feishu-bot/README.md", "im:message:send_as_bot", "bot README lists send_as_bot");
mustNotContain("workers/feishu-bot/wrangler.toml", "crons", "feishu bot must not add Cron Triggers");
{
  const botSrcDir = path.join(root, "workers/feishu-bot/src");
  for (const name of fs.readdirSync(botSrcDir).filter((file) => file.endsWith(".mjs"))) {
    const rel = `workers/feishu-bot/src/${name}`;
    mustNotContain(rel, "/api/generate", `${rel} must not call /api/generate`);
    mustNotContain(rel, "/api/upload", `${rel} must not call /api/upload`);
    mustNotContain(rel, "GENERATION_ENABLED", `${rel} must not touch GENERATION_ENABLED`);
    mustNotContain(rel, "kie.ai", `${rel} must not call KIE`);
  }
}

if (!exists("scripts/feishu-notify.mjs")) fail.push("missing scripts/feishu-notify.mjs");
else ok.push("scripts/feishu-notify.mjs exists");
if (!exists("scripts/test-feishu-notify.mjs")) fail.push("missing scripts/test-feishu-notify.mjs");
else ok.push("scripts/test-feishu-notify.mjs exists");
if (!exists(".github/workflows/feishu-notify.yml")) fail.push("missing .github/workflows/feishu-notify.yml");
else ok.push(".github/workflows/feishu-notify.yml exists");
mustContain(".github/workflows/feishu-notify.yml", "secrets.FEISHU_WEBHOOK_URL", "workflow reads webhook URL from Actions secret");
mustContain(".github/workflows/feishu-notify.yml", "secrets.FEISHU_WEBHOOK_SECRET", "workflow reads optional signing secret");
mustContain(".github/workflows/feishu-notify.yml", "scripts/feishu-notify.mjs deploy", "workflow posts deploy cards via the shared script");
mustContain("scripts/feishu-notify.mjs", "FEISHU_WEBHOOK_URL", "notify script reads webhook from env");
mustContain("scripts/feishu-notify.mjs", "createHmac", "notify script supports Feishu HMAC-SHA256 sign");
mustContain("README.md", "FEISHU_WEBHOOK_URL", "root README documents webhook secret name");
mustContain("README.md", "FEISHU_WEBHOOK_SECRET", "root README documents optional signing secret");
mustNotContain("scripts/feishu-notify.mjs", "open.feishu.cn/open-apis/bot/v2/hook/", "notify script has no hardcoded webhook URL");

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

const genUnit = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    path.join(root, "scripts/register-ts-bare.mjs"),
    path.join(root, "scripts/test-generation-gate.mjs"),
  ],
  { encoding: "utf8", cwd: root }
);
process.stdout.write(genUnit.stdout || "");
process.stderr.write(genUnit.stderr || "");
if (genUnit.status !== 0) {
  console.log("FAIL scripts/test-generation-gate.mjs");
  process.exit(genUnit.status || 1);
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

const wsSeoUnit = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    path.join(root, "scripts/register-ts-bare.mjs"),
    path.join(root, "scripts/test-workspace-seo.mjs"),
  ],
  { encoding: "utf8", cwd: root }
);
process.stdout.write(wsSeoUnit.stdout || "");
process.stderr.write(wsSeoUnit.stderr || "");
if (wsSeoUnit.status !== 0) {
  console.log("FAIL scripts/test-workspace-seo.mjs");
  process.exit(wsSeoUnit.status || 1);
}

const histGalleryUnit = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    path.join(root, "scripts/register-ts-bare.mjs"),
    path.join(root, "scripts/test-history-gallery.mjs"),
  ],
  { encoding: "utf8", cwd: root }
);
process.stdout.write(histGalleryUnit.stdout || "");
process.stderr.write(histGalleryUnit.stderr || "");
if (histGalleryUnit.status !== 0) {
  console.log("FAIL scripts/test-history-gallery.mjs");
  process.exit(histGalleryUnit.status || 1);
}

const demoUnit = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    path.join(root, "scripts/register-ts-bare.mjs"),
    path.join(root, "scripts/test-demo-mode.mjs"),
  ],
  { encoding: "utf8", cwd: root }
);
process.stdout.write(demoUnit.stdout || "");
process.stderr.write(demoUnit.stderr || "");
if (demoUnit.status !== 0) {
  console.log("FAIL scripts/test-demo-mode.mjs");
  process.exit(demoUnit.status || 1);
}

const examplesUnit = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--import",
    path.join(root, "scripts/register-ts-bare.mjs"),
    path.join(root, "scripts/test-examples.mjs"),
  ],
  { encoding: "utf8", cwd: root }
);
process.stdout.write(examplesUnit.stdout || "");
process.stderr.write(examplesUnit.stderr || "");
if (examplesUnit.status !== 0) {
  console.log("FAIL scripts/test-examples.mjs");
  process.exit(examplesUnit.status || 1);
}

const feishuNotifyUnit = spawnSync(process.execPath, [path.join(root, "scripts/test-feishu-notify.mjs")], {
  encoding: "utf8",
  cwd: root,
});
process.stdout.write(feishuNotifyUnit.stdout || "");
process.stderr.write(feishuNotifyUnit.stderr || "");
if (feishuNotifyUnit.status !== 0) {
  console.log("FAIL scripts/test-feishu-notify.mjs");
  process.exit(feishuNotifyUnit.status || 1);
}

const feishuBotTests = fs
  .readdirSync(path.join(root, "workers/feishu-bot/test"))
  .filter((name) => name.endsWith(".test.mjs"))
  .map((name) => path.join(root, "workers/feishu-bot/test", name));
const feishuBotUnit = spawnSync(process.execPath, ["--test", ...feishuBotTests], {
  encoding: "utf8",
  cwd: path.join(root, "workers/feishu-bot"),
});
process.stdout.write(feishuBotUnit.stdout || "");
process.stderr.write(feishuBotUnit.stderr || "");
if (feishuBotUnit.status !== 0) {
  console.log("FAIL workers/feishu-bot tests");
  process.exit(feishuBotUnit.status || 1);
}
