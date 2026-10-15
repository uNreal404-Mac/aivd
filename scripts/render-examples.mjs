/**
 * Write static /examples HTML from the same renderer the Functions use.
 * Run: node --experimental-strip-types --import ./scripts/register-ts-bare.mjs scripts/render-examples.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { EXAMPLES, examplePublicPaths, renderDetailHtml, renderListHtml } from "../libs/examples.ts";
import { CANONICAL_ORIGIN } from "../libs/site.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "out/examples");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(root, "out/examples.html"), renderListHtml());
for (const ex of EXAMPLES) {
  const html = renderDetailHtml(ex.slug);
  if (!html) throw new Error(`missing html for ${ex.slug}`);
  fs.writeFileSync(path.join(outDir, `${ex.slug}.html`), html);
}

const sitemapPath = path.join(root, "out/sitemap.xml");
let xml = fs.readFileSync(sitemapPath, "utf8");
for (const p of examplePublicPaths()) {
  const loc = `  <url><loc>${CANONICAL_ORIGIN}${p}</loc><changefreq>weekly</changefreq></url>`;
  if (!xml.includes(`${CANONICAL_ORIGIN}${p}`)) {
    xml = xml.replace("</urlset>", `${loc}\n</urlset>`);
  }
}
fs.writeFileSync(sitemapPath, xml);
console.log(`wrote ${EXAMPLES.length + 1} example pages`);
