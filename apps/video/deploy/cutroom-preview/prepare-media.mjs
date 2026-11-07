// Run after generating the static Pages package, including its workbench fallback.
// Usage: node deploy/cutroom-preview/prepare-media.mjs PATH_TO_HOME_ONLY
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const bundleArg = process.argv[2];
if (!bundleArg) throw new Error("Expected a prepared home-only Pages bundle directory");
const bundle = path.resolve(bundleArg);
const source = await readFile(new URL("../../src/components/hf/cutroom-films.ts", import.meta.url), "utf8");
const template = await readFile(new URL("worker.mjs", import.meta.url), "utf8");
const previous = await readFile(path.join(bundle, "_worker.js"), "utf8");
const assetList = previous.match(/const assets = new Set\((\[[^\n]+\])\);/);
if (!assetList) throw new Error("The prepared Pages asset manifest is missing");
const logicalPaths = new Set([...source.matchAll(/\bvideo:\s*"(\/home\/[\w.-]+\.mp4)"/g)].map(match => match[1]));
if (!logicalPaths.size) throw new Error("No films found in cutroom-films.ts");
const assetPaths = JSON.parse(assetList[1]).filter(url => !logicalPaths.has(url));
const movieManifest = [];
await mkdir(path.join(bundle, "cutroom-bytes"), { recursive: true });
for (const url of logicalPaths) {
  const internal = "/cutroom-bytes/" + path.posix.basename(url, ".mp4") + ".bin";
  const to = path.join(bundle, internal);
  try {
    await rename(path.join(bundle, url), to);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const bytes = await readFile(to);
  const hash = createHash("sha256").update(bytes).digest("hex");
  movieManifest.push([url, { source: internal, etag: '"' + hash + '"', size: bytes.length }]);
}
const worker = template
  .replace("/* @assetPaths */ []", JSON.stringify(assetPaths))
  .replace("/* @movieManifest */ []", JSON.stringify(movieManifest));
await writeFile(path.join(bundle, "_worker.js"), worker);
await writeFile(path.join(bundle, "_routes.json"), JSON.stringify({ version: 1, include: ["/*"], exclude: [] }) + "\n");
console.log(`Prepared ${movieManifest.length} range-aware films in ${bundle}`);
