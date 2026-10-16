#!/usr/bin/env node
// Compare src/messages/en.json and zh.json: keys missing in zh, keys only in zh,
// and keys whose zh value is identical to en (likely untranslated).
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "messages");
const load = (name) => JSON.parse(readFileSync(join(dir, name), "utf8"));

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

// Values that are legitimately the same in both languages.
const SAME_OK = /^([\d\s.,:%$+\-/×x()]*|[A-Z0-9][\w.\- ]{0,24}|\{[^}]+\}|https?:\/\/\S+|\S+@\S+)$/;

const en = flatten(load("en.json"));
const zh = flatten(load("zh.json"));
const missing = Object.keys(en).filter((k) => !(k in zh));
const extra = Object.keys(zh).filter((k) => !(k in en));
const same = Object.keys(en).filter(
  (k) => k in zh && typeof en[k] === "string" && zh[k] === en[k] && !SAME_OK.test(en[k]),
);

const json = process.argv.includes("--json");
if (json) {
  console.log(JSON.stringify({ missing, extra, same }, null, 2));
} else {
  console.log(`en keys: ${Object.keys(en).length}, zh keys: ${Object.keys(zh).length}`);
  console.log(`\nMissing in zh (${missing.length}):`);
  for (const k of missing) console.log(`  ${k} = ${JSON.stringify(en[k])}`);
  console.log(`\nOnly in zh (${extra.length}):`);
  for (const k of extra) console.log(`  ${k}`);
  console.log(`\nSame as en, likely untranslated (${same.length}):`);
  for (const k of same) console.log(`  ${k} = ${JSON.stringify(en[k])}`);
}
