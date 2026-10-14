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

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nAll checks passed (${ok.length})`);
