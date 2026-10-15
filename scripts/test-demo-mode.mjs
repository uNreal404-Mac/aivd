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
    assert(item.resultUrl.indexOf("/assets/demo/") === 0 || item.resultUrl.indexOf("/assets/images/") === 0, "sample src is a static asset");
    assert(demo.badgeHtml().includes("演示样片 / Demo sample"), "badge HTML renders 演示样片 / Demo sample");
    assert(item.status === "done", "demo result status is done");
  } finally {
    globalThis.fetch = origFetch;
  }
}

{
  const image = await demo.runGenerate({
    kind: "image",
    prompt: "product still",
    persist: false,
    wait: () => Promise.resolve(),
  });
  assert(image.kind === "image", "image demo returns an image sample");
  assert(/\.(webp|png|jpe?g)(\?|$)/i.test(image.resultUrl), "image sample is an existing still");
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
  }
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
  assert(demoSrc.includes("TODO:"), "sample list marks TODO placeholders for real 1080p clips");
  assert(fs.existsSync(path.join(root, "out/assets/demo/sample-general.mp4")), "general sample mp4 exists");
  assert(fs.existsSync(path.join(root, "out/assets/demo/sample-cinematic.mp4")), "cinematic sample mp4 exists");
  assert(fs.existsSync(path.join(root, "out/assets/demo/sample-vertical.mp4")), "vertical sample mp4 exists");
}

{
  const seo = applyWorkspaceHtmlSeo(workspace, "https://dreamutopia-clone.pages.dev/workspace?demo=1");
  assert(seo.noindex === true, "?demo=1 is noindex");
  assert(/<meta name="robots" content="noindex">/i.test(seo.html), "?demo=1 HTML has robots noindex");
  assert(seo.headers["x-robots-tag"] === "noindex", "?demo=1 sends X-Robots-Tag: noindex");
  const demoPage = fs.readFileSync(path.join(root, "out/demo.html"), "utf8");
  assert(/name="robots" content="noindex/.test(demoPage), "/demo static HTML is noindex");
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nDemo mode checks passed (${ok.length})`);
