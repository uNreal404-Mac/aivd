/**
 * Frontend demo mode — mocks only.
 * Asserts zero calls to /api/generate and /api/upload, badge copy, and banned strings.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { applyWorkspaceHtmlSeo } from "../libs/workspaceSeo.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const demo = require("../out/assets/js/demo.js");

const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

const workspace = fs.readFileSync(path.join(root, "out/workspace.html"), "utf8");
const du = fs.readFileSync(path.join(root, "out/assets/js/du.js"), "utf8");
const i18n = fs.readFileSync(path.join(root, "out/assets/js/i18n.js"), "utf8");
const wrangler = fs.readFileSync(path.join(root, "wrangler.toml"), "utf8");
const demoSrc = fs.readFileSync(path.join(root, "out/assets/js/demo.js"), "utf8");

{
  assert(du.includes('const BRAND_NAME = "DreamUtopia"'), "brand lives in one DU.BRAND_NAME constant");
  assert(du.includes("BRAND_NAME: BRAND_NAME"), "DU exports BRAND_NAME");
  assert(wrangler.includes('GENERATION_ENABLED = "false"'), "GENERATION_ENABLED stays false");
  assert(!wrangler.includes('GENERATION_ENABLED = "true"'), "GENERATION_ENABLED is not true");
}

{
  const loc = { search: "?demo=1", pathname: "/workspace", href: "https://example.test/workspace?demo=1" };
  const store = new Map();
  const session = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  };
  assert(demo.isDemoMode(loc, session) === true, "?demo=1 enters demo mode");
  assert(session.getItem(demo.STORAGE_FLAG) === "1", "?demo=1 persists the demo flag");
  assert(demo.isDemoMode({ search: "?demo=0", pathname: "/workspace" }, session) === false, "?demo=0 exits demo mode");
  assert(demo.isDemoMode({ search: "", pathname: "/demo" }, session) === true, "/demo is demo mode");
}

{
  assert(demo.blockedUrl("https://host/api/generate") === true, "blocks /api/generate");
  assert(demo.blockedUrl("/api/generate?id=1") === true, "blocks /api/generate poll");
  assert(demo.blockedUrl("/api/upload") === true, "blocks /api/upload");
  assert(demo.blockedUrl("/api/upload-ticket?key=x") === true, "blocks /api/upload-ticket");
  assert(demo.blockedUrl("https://api.kie.ai/api/v1/jobs") === true, "blocks KIE");
  assert(demo.blockedUrl("/api/health") === false, "does not block /api/health");
  assert(demo.blockedPath("/generate") === true, "DU.api /generate is blocked");
  assert(demo.blockedPath("/upload") === true, "DU.api /upload is blocked");
}

{
  const calls = [];
  const origFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    throw new Error("network must not run in demo generate: " + input);
  };
  try {
    const item = await demo.runGenerate({
      kind: "video",
      prompt: "a city street at dusk",
      model: "lite",
      durationSec: 5,
      persist: false,
      wait: () => Promise.resolve(),
    });
    assert(calls.length === 0, "runGenerate makes zero fetch calls");
    assert(!calls.some((u) => /\/api\/generate|\/api\/upload/.test(u)), "runGenerate never hits /api/generate or /api/upload");
    assert(item && item.demo === true && item.resultUrl, "runGenerate returns a demo sample");
    assert(item.resultUrl.indexOf("/assets/demo/") === 0, "sample src is a static demo clip");
    assert(String(item.title || "").trim().length > 0, "demo result has a plain title");
    assert(!/TODO/i.test(item.title), "demo result title is not a placeholder");
    assert(demo.badgeHtml().includes("演示样片 / Demo sample"), "badge HTML renders 演示样片 / Demo sample");
    assert(item.status === "done", "demo result status is done");
  } finally {
    globalThis.fetch = origFetch;
  }
}

{
  assert(demo.samplesFor("image").length === 0, "untitled image stills are hidden");
  const image = await demo.runGenerate({
    kind: "image",
    prompt: "product still",
    persist: false,
    wait: () => Promise.resolve(),
  });
  assert(image.kind === "video", "image demo falls back to a titled clip we generated");
  assert(String(image.title || "").trim().length > 0, "image-mode demo still has a plain title");
  assert(image.resultUrl.indexOf("/assets/demo/") === 0 && image.resultUrl.endsWith(".mp4"), "image-mode demo uses our published clip");
}

{
  const store = {
    data: "",
    getItem() {
      return this.data || null;
    },
    setItem(_k, v) {
      this.data = String(v);
    },
  };
  const first = await demo.runGenerate({
    kind: "video",
    prompt: "saved sample",
    persist: true,
    store,
    wait: () => Promise.resolve(),
  });
  const list = demo.loadHistory(store);
  assert(list.length === 1 && list[0].id === first.id, "demo history stores the sample locally");
}

{
  const banned = ["clone", "暂未开放"];
  const copy = demo.visibleCopy();
  for (const row of copy) {
    const lower = String(row).toLowerCase();
    for (const needle of banned) {
      assert(!lower.includes(needle.toLowerCase()), `demo visible copy omits ${JSON.stringify(needle)}: ${JSON.stringify(row)}`);
    }
    assert(!/TODO/i.test(String(row)), `rendered demo copy omits TODO: ${JSON.stringify(row)}`);
  }
  assert(copy.some((row) => /Product motion/i.test(String(row))), "visible copy includes Product motion");
  assert(copy.some((row) => /Scene camera move/i.test(String(row))), "visible copy includes Scene camera move");
  assert(copy.some((row) => /Brand mood/i.test(String(row))), "visible copy includes Brand mood");
  const demoI18n = [];
  const re = /"demo\.[^"]+":\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(i18n))) demoI18n.push(m[1]);
  assert(demoI18n.length >= 8, "demo i18n keys exist");
  for (const row of demoI18n) {
    const lower = row.toLowerCase();
    assert(!lower.includes("clone"), `demo i18n omits clone: ${JSON.stringify(row)}`);
    assert(!row.includes("暂未开放"), `demo i18n omits 暂未开放: ${JSON.stringify(row)}`);
  }
  assert(i18n.includes('"demo.badge": "演示样片 / Demo sample"'), "i18n badge is 演示样片 / Demo sample");
}

{
  assert(workspace.includes('src="/assets/js/demo.js"'), "workspace loads demo.js");
  assert(workspace.includes('id="demoSampleBadge"'), "result badge node exists");
  assert(workspace.includes("演示样片 / Demo sample"), "badge copy is in the workspace HTML");
  assert(workspace.includes('data-i18n="demo.try"') && workspace.includes("Try demo"), "visible Try demo entry");
  assert(workspace.includes("function generateDemoFlow"), "demo generate path is a dedicated function");
  const genStart = workspace.indexOf("async function generate()");
  const genEnd = workspace.indexOf("function resetGenBtn()");
  const gen = genStart >= 0 && genEnd > genStart ? workspace.slice(genStart, genEnd) : "";
  const demoAt = gen.indexOf("demoActive()");
  const closedAt = gen.indexOf("generationIsClosed");
  const apiAt = gen.indexOf('api("/generate"');
  assert(demoAt >= 0 && demoAt < closedAt, "generate() takes the demo path before the closed gate");
  assert(apiAt > closedAt, "live /api/generate stays behind the demo intercept and closed gate");
  const init = workspace.slice(workspace.indexOf("(async function init()"));
  const demoSkip = init.indexOf("if (!inDemo)");
  const uploadAt = init.indexOf('fetch("/api/upload")');
  assert(demoSkip >= 0 && uploadAt > demoSkip, "init only probes /api/upload when not in demo");
  const demoFlow = workspace.slice(
    workspace.indexOf("async function generateDemoFlow()"),
    workspace.indexOf("async function generate()")
  );
  assert(!demoFlow.includes("/api/generate"), "generateDemoFlow has no /api/generate");
  assert(!demoFlow.includes("/api/upload"), "generateDemoFlow has no /api/upload");
  assert(!demoFlow.includes("upload-ticket"), "generateDemoFlow has no upload-ticket");
  assert(!demoFlow.includes("kie.ai"), "generateDemoFlow has no KIE URL");
}

{
  assert(!demoSrc.includes("kie.ai"), "demo.js has no KIE host");
  assert(!/TODO/i.test(demoSrc), "demo.js has no TODO comments or copy");
  assert(!/TODO/i.test(du), "du.js has no TODO");
  assert(!/TODO/i.test(workspace), "workspace HTML/JS has no TODO");
  const keys = [
    "0_out_f7d00e65d3c1a45d.mp4",
    "0_out_68e31a44b7b1d011.mp4",
    "0_out_980c5a0e163959b6.mp4",
  ];
  for (const key of keys) {
    assert(fs.existsSync(path.join(root, "out/assets/demo", key)), `published clip ${key} is a static demo asset`);
  }
  assert(!fs.existsSync(path.join(root, "out/assets/demo/sample-general.mp4")), "Ken Burns placeholder general clip removed");
  assert(!fs.existsSync(path.join(root, "out/assets/demo/sample-cinematic.mp4")), "Ken Burns placeholder cinematic clip removed");
  assert(!fs.existsSync(path.join(root, "out/assets/demo/sample-vertical.mp4")), "Ken Burns placeholder vertical clip removed");
  for (const row of demo.DEMO_SAMPLES) {
    assert(String(row.title || "").trim().length > 0, `sample ${row.id} has a plain title`);
    assert(String(row.src || "").indexOf("/assets/demo/") === 0, `sample ${row.id} is our clip`);
  }
}

{
  const seo = applyWorkspaceHtmlSeo(workspace, "https://dreamutopia-clone.pages.dev/workspace?demo=1");
  assert(seo.noindex === true, "?demo=1 is noindex");
  assert(/<meta name="robots" content="noindex">/i.test(seo.html), "?demo=1 HTML has robots noindex");
  assert(seo.headers["x-robots-tag"] === "noindex", "?demo=1 sends X-Robots-Tag: noindex");
  const demoPage = fs.readFileSync(path.join(root, "out/demo.html"), "utf8");
  assert(/name="robots" content="noindex/.test(demoPage), "/demo static HTML is noindex");
}

{
  assert(typeof demo.DISPLAY_COST_LITE === "number" && demo.DISPLAY_COST_LITE === 3, "demo display cost matches video Lite (3)");
  assert(typeof demo.generateCostLabel === "function", "generateCostLabel is exported");
  if (typeof demo.generateCostLabel === "function") {
    const en = demo.generateCostLabel(3, function (_k, fallback) { return fallback; });
    assert(/Generate · 3 credits/.test(en), "English generate label includes credit cost");
    const zh = demo.generateCostLabel(3, function (key, fallback) {
      if (key === "ws.gen.cost") return "生成 · 消耗 {n} 积分";
      return fallback;
    });
    assert(/生成 · 消耗 3 积分/.test(zh), "Chinese generate label includes 消耗积分");
  }
  assert(i18n.includes('"ws.gen.cost": "Generate · {n} credits"'), "English i18n generate cost template");
  assert(i18n.includes('"ws.gen.cost": "生成 · 消耗 {n} 积分"'), "Chinese i18n generate cost template");
  assert(workspace.includes("generateCostLabel"), "workspace fills Generate label from generateCostLabel");
  const resetStart = workspace.indexOf("function resetGenBtn()");
  const resetEnd = workspace.indexOf("function itemKind(");
  const reset = resetStart >= 0 && resetEnd > resetStart ? workspace.slice(resetStart, resetEnd) : "";
  assert(reset.includes("applyGenerateLabel") || reset.includes("generateCostLabel"), "resetGenBtn writes cost into the Generate label");
}

{
  assert(workspace.includes('id="genParamChips"'), "Generate sticky shows parameter chips");
  assert(workspace.includes('id="genChipDuration"'), "duration chip on Generate sticky");
  assert(workspace.includes('id="genChipAspect"'), "aspect chip on Generate sticky");
  assert(workspace.includes('id="genChipResolution"'), "resolution chip on Generate sticky");
  assert(workspace.includes("function syncGenParamChips"), "chips stay in sync with current UI values");
  assert(typeof demo.paramChipValues === "function", "paramChipValues is exported");
  if (typeof demo.paramChipValues === "function") {
    const chips = demo.paramChipValues({ durationSec: 5, aspectRatio: "16:9", resolution: "1080p" });
    assert(chips.duration === "5s" && chips.aspect === "16:9" && chips.resolution === "1080p", "default chips are 5s / 16:9 / 1080p");
  }
  const chipAt = workspace.indexOf('id="genParamChips"');
  const htmlChips = chipAt >= 0 ? workspace.slice(chipAt, chipAt + 900) : "";
  assert(/5s/.test(htmlChips) && /16:9/.test(htmlChips) && /1080p/.test(htmlChips), "sticky chips render site defaults in HTML");
}

{
  assert(typeof demo.isOwnDemoClip === "function", "isOwnDemoClip is exported");
  assert(typeof demo.shareableClipUrl === "function", "shareableClipUrl is exported");
  if (typeof demo.isOwnDemoClip === "function") {
    assert(demo.isOwnDemoClip("/assets/demo/0_out_f7d00e65d3c1a45d.mp4") === true, "our sample mp4 is allowed");
    assert(demo.isOwnDemoClip("https://higgsfield.ai/clip.mp4") === false, "competitor URLs are not download/copy targets");
    assert(demo.isOwnDemoClip("/api/media?key=user-work.mp4") === false, "user-work media URLs are not demo clips");
  }
  if (typeof demo.shareableClipUrl === "function") {
    const share = demo.shareableClipUrl("/assets/demo/0_out_f7d00e65d3c1a45d.mp4", "https://dreamutopia-clone.pages.dev");
    assert(share === "https://dreamutopia-clone.pages.dev/assets/demo/0_out_f7d00e65d3c1a45d.mp4", "Copy link uses our sample mp4 URL");
    assert(demo.shareableClipUrl("https://cdn.higgsfield.ai/x.mp4", "https://dreamutopia-clone.pages.dev") === "", "Copy link refuses competitor assets");
  }
  assert(workspace.includes('id="genCopyLink"'), "result card has Copy link");
  assert(workspace.includes('data-act="copy-link"'), "history demo cards have Copy link");
  assert(workspace.includes('id="historyDetailCopyLink"'), "detail modal has Copy link");
  assert(i18n.includes('"ws.result.copy": "Copy link"'), "English Copy link i18n");
  assert(i18n.includes('"ws.result.copy": "复制链接"'), "Chinese Copy link i18n");
  const cardFn = workspace.slice(workspace.indexOf("function historyCardHtml"), workspace.indexOf("function renderHistoryGrid"));
  assert(cardFn.includes('data-act="download"'), "history cards still have Download");
  assert(cardFn.includes('data-act="copy-link"'), "history cards add Copy link");
  assert(!/exportIg|tiktok/i.test(workspace), "no aspect-ratio re-encode / social export");
  assert(!/Featured Creators/.test(workspace), "no public waterfall gallery");
  assert(workspace.includes("async function copyResultLink"), "Copy link helper exists");
  const copyAt = workspace.indexOf("async function copyResultLink");
  const copyFn = copyAt >= 0 ? workspace.slice(copyAt, copyAt + 900) : "";
  assert(copyFn.includes("shareableClipUrl") || copyFn.includes("isOwnDemoClip"), "Copy link only shares our sample clips");
  const demoFlow = workspace.slice(
    workspace.indexOf("async function generateDemoFlow()"),
    workspace.indexOf("async function generate()")
  );
  assert(!demoFlow.includes("/api/credits"), "demo generate does not hit /api/credits");
  assert(!demoFlow.includes("userCredits"), "demo generate does not deduct credits");
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nDemo mode checks passed (${ok.length})`);
