// Use Playwright's npx tool cache. Neither the app dependencies nor its lockfile are updated.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { parseArgs } = require("node:util");
const { values } = parseArgs({ options: {
  base: { type: "string", default: "http://127.0.0.1:3000" },
  lang: { type: "string", default: "zh" },
  pages: { type: "string", default: "home,pricing,generator" },
  out: { type: "string" }, channel: { type: "string" },
  "tool-prefix": { type: "string" }, help: { type: "boolean" },
} });
if (values.help) {
  console.log("npm run shots -- --base http://127.0.0.1:3000 [--lang zh|en] [--pages home,pricing,generator] [--out DIRECTORY] [--channel chrome] [--tool-prefix EXTERNAL_NPX_CACHE_PROJECT]");
  process.exit(0);
}
const base = new URL(values.base);
if (!["localhost","127.0.0.1","[::1]"].includes(base.hostname) || !["http:","https:"].includes(base.protocol) || base.username || base.password) throw Error("Use an anonymous local preview URL.");
if (!["en","zh"].includes(values.lang)) throw Error("Use en or zh.");
const pages = [...new Set(values.pages.split(","))];
if (pages.some(page => !["home","pricing","generator"].includes(page))) throw Error("Unknown page.");
const stamp = new Date().toISOString().replace(/[:.]/g,"-");
const out = values.out ? path.resolve(values.out) : path.resolve(__dirname, "../../../.design/artifacts/shots", stamp);
fs.mkdirSync(out, { recursive:true });
if (fs.readdirSync(out).length) throw Error("Choose a new or empty output directory to preserve earlier screenshots.");
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "aidv-shots-"));
try {
  fs.copyFileSync(path.join(__dirname,"design-shots","capture.cjs"), path.join(scratch,"capture.spec.cjs"));
  const jobs = { base: base.origin, lang: values.lang, pages, out };
  fs.writeFileSync(path.join(scratch,"jobs.json"),JSON.stringify(jobs));
  fs.writeFileSync(path.join(scratch,"playwright.config.cjs"),"module.exports = "+JSON.stringify({
    testDir:scratch,testMatch:"capture.spec.cjs",fullyParallel:false,workers:1,timeout:120000,
    outputDir:path.join(scratch,"run"),use:{headless:true,channel:values.channel,locale:values.lang==="zh"?"zh-CN":"en-US",reducedMotion:"reduce"}
  }));
  const prefix = values["tool-prefix"];
  const args = prefix ? ["--offline","--prefix",path.resolve(prefix),"playwright"] : ["--yes","playwright@1.64.1"];
  const res=spawnSync(process.platform==="win32"?"npx.cmd":"npx",[...args,"test","--config",path.join(scratch,"playwright.config.cjs"),"--reporter=line"],{stdio:"inherit",cwd:scratch});
  if (res.error) throw res.error;
  if (res.status !== 0) process.exitCode = res.status ?? 1;
  console.log("Shots:",out);
} finally { fs.rmSync(scratch,{recursive:true,force:true}); }
