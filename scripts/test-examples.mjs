/**
 * /examples public sample pages — mocks only.
 * Never calls KIE, /api/generate, or /api/upload.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND_NAME, CANONICAL_ORIGIN } from "../libs/site.ts";
import {
  EXAMPLES,
  EXAMPLE_LIST_DESCRIPTION,
  EXAMPLE_LIST_TITLE,
  exampleBySlug,
  examplePageDescription,
  examplePageH1,
  examplePageTitle,
  examplePublicPaths,
  relatedExamples,
  renderDetailHtml,
  renderListHtml,
  videoObjectJsonLd,
} from "../libs/examples.ts";
import { onRequestGet as listGet } from "../functions/examples.ts";
import { onRequestGet as detailGet } from "../functions/examples/[slug].ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fail = [];
const ok = [];

function assert(cond, label) {
  if (cond) ok.push(label);
  else fail.push(label);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function pagesCtx(request, params = {}) {
  return {
    env: {},
    request,
    waitUntil() {},
    params,
    data: {},
    functionPath: "",
    next: async () => new Response("next"),
  };
}

const KNOWN_CLIPS = [
  "0_out_f7d00e65d3c1a45d.mp4",
  "0_out_68e31a44b7b1d011.mp4",
  "0_out_980c5a0e163959b6.mp4",
];

{
  const src = read("libs/examples.ts");
  assert(src.includes("BRAND_NAME"), "examples renderer imports BRAND_NAME");
  assert(!src.includes("DreamUtopia"), "examples.ts does not hardcode the brand string");
  assert(read("libs/site.ts").includes('export const BRAND_NAME = "'), "BRAND_NAME lives in libs/site.ts");
}

{
  assert(EXAMPLES.length >= 3, "catalog has at least 3 samples");
  const slugs = EXAMPLES.map((e) => e.slug);
  assert(slugs.every((s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)), "slugs are lowercase hyphenated English");
  assert(new Set(slugs).size === slugs.length, "slugs are unique");
  for (const ex of EXAMPLES) {
    assert(ex.poster.startsWith("/assets/images/") && ex.poster.endsWith(".webp"), `${ex.slug} uses an in-repo webp poster`);
    assert(KNOWN_CLIPS.includes(ex.mediaKey), `${ex.slug} reuses a known 1080p sample clip`);
    assert(ex.durationSec === 5, `${ex.slug} duration is the measured 5s`);
    assert(ex.resolution === "1080p", `${ex.slug} resolution is the measured 1080p`);
    assert(ex.prompt == null, `${ex.slug} does not invent an original prompt`);
    assert(!/kling|seedance|higgsfield/i.test(ex.model), `${ex.slug} does not invent an upstream model name`);
    assert(ex.model === `${BRAND_NAME} Lite`, `${ex.slug} model is the documented Lite job class`);
  }
  assert(!EXAMPLES.some((e) => e.mediaKey === "44_out_26d311aa3bacb00a.mp4"), "skips the non-1080p QA clip");
}

{
  assert(EXAMPLE_LIST_TITLE === `AI Video Examples – Image to Video Samples | ${BRAND_NAME}`, "list title is the specified English string");
  assert(
    EXAMPLE_LIST_DESCRIPTION ===
      "Browse HD AI videos made from photos, with the prompt and model behind each clip. Get ideas for your next video.",
    "list description is the specified English string"
  );
  assert(!/free|instant/i.test(EXAMPLE_LIST_DESCRIPTION), "list description omits free/instant");
}

{
  for (const ex of EXAMPLES) {
    const title = examplePageTitle(ex);
    const desc = examplePageDescription(ex);
    const h1 = examplePageH1(ex);
    assert(title === `${ex.subject} AI Video – ${ex.style} from a Photo | ${BRAND_NAME}`, `${ex.slug} title follows the specified pattern`);
    assert(
      desc ===
        `See how this ${ex.subjectLower} photo became a ${ex.durationSec}s ${ex.resolution} AI video with ${ex.model}. Prompt included. Try a similar style in ${BRAND_NAME}.`,
      `${ex.slug} description follows the specified pattern`
    );
    assert(h1 === `${ex.subject} AI Video`, `${ex.slug} H1 is {Subject} AI Video`);
    assert(!/free|instant/i.test(title + desc + h1), `${ex.slug} SEO strings omit free/instant`);
  }
}

{
  const paths = examplePublicPaths();
  assert(paths[0] === "/examples" || paths.includes("/examples"), "example paths include the list");
  for (const ex of EXAMPLES) {
    assert(paths.includes(`/examples/${ex.slug}`), `example paths include /examples/${ex.slug}`);
  }
}

{
  for (const ex of EXAMPLES) {
    const related = relatedExamples(ex.slug);
    assert(related.length >= 3 && related.length <= 4, `${ex.slug} has 3–4 related samples`);
    assert(related.every((r) => r.slug !== ex.slug), `${ex.slug} related list excludes self`);
    assert(new Set(related.map((r) => r.slug)).size === related.length, `${ex.slug} related slugs are unique`);
  }
}

{
  for (const ex of EXAMPLES) {
    const obj = videoObjectJsonLd(ex);
    assert(obj["@type"] === "VideoObject", `${ex.slug} JSON-LD is VideoObject`);
    assert(typeof obj.name === "string" && obj.name.length > 0, `${ex.slug} VideoObject.name`);
    assert(typeof obj.description === "string" && obj.description.length > 0, `${ex.slug} VideoObject.description`);
    assert(obj.thumbnailUrl === `${CANONICAL_ORIGIN}${ex.poster}`, `${ex.slug} VideoObject.thumbnailUrl`);
    assert(obj.uploadDate, `${ex.slug} VideoObject.uploadDate`);
    assert(obj.duration === "PT5S", `${ex.slug} VideoObject.duration is PT5S`);
    assert(obj.contentUrl === `${CANONICAL_ORIGIN}/api/media?key=${ex.mediaKey}`, `${ex.slug} VideoObject.contentUrl`);
    assert(obj.publisher && obj.publisher.name === BRAND_NAME, `${ex.slug} VideoObject.publisher is BRAND_NAME`);
  }
}

{
  const html = renderListHtml();
  assert(html.includes(`<title>${EXAMPLE_LIST_TITLE}</title>`), "list HTML has the specified title");
  assert(html.includes(`content="${EXAMPLE_LIST_DESCRIPTION}"`), "list HTML has the specified description");
  assert(html.includes(`rel="canonical" href="${CANONICAL_ORIGIN}/examples"`), "list HTML self-canonical");
  assert(html.includes('type="application/ld+json"'), "list HTML has JSON-LD");
  assert(!/free|instant/i.test((html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || ""), "list meta omits free/instant");
  for (const ex of EXAMPLES) {
    assert(html.includes(`/examples/${ex.slug}`), `list links to /examples/${ex.slug}`);
  }
  assert(html.includes('href="/workspace"'), "list links to /workspace");
  assert(!html.includes('href="/business"'), "list has no /business");
  assert(html.includes(`property="og:site_name" content="${BRAND_NAME}"`), "list OG site_name uses BRAND_NAME");
  assert(html.includes(`"name":"${BRAND_NAME}"`) || html.includes(`"name": "${BRAND_NAME}"`), "list JSON-LD publisher uses BRAND_NAME");
}

{
  for (const ex of EXAMPLES) {
    const html = renderDetailHtml(ex.slug);
    assert(html.includes(`<title>${examplePageTitle(ex)}</title>`), `${ex.slug} detail title`);
    assert(html.includes(`<h1>${examplePageH1(ex)}</h1>`), `${ex.slug} detail H1`);
    assert(html.includes(`rel="canonical" href="${CANONICAL_ORIGIN}/examples/${ex.slug}"`), `${ex.slug} self-canonical`);
    assert(html.includes('"@type":"VideoObject"'), `${ex.slug} has VideoObject JSON-LD`);
    assert(html.includes(ex.mediaKey), `${ex.slug} embeds the known clip`);
    assert(html.includes(ex.model), `${ex.slug} shows the model`);
    assert(html.includes("5s") && html.includes("1080p"), `${ex.slug} shows duration and resolution`);
    assert(/not recorded|not stored|not saved/i.test(html), `${ex.slug} does not invent a prompt`);
    const sentences = (html.match(/<p class="body">[\s\S]*?<\/p>/g) || []).join(" ");
    assert((sentences.match(/[.!?](\s|$)/g) || []).length >= 2, `${ex.slug} has 2–3 original sentences`);
    const related = relatedExamples(ex.slug);
    for (const r of related) {
      assert(html.includes(`href="/examples/${r.slug}"`), `${ex.slug} links to related ${r.slug}`);
    }
    assert(html.includes(`property="og:site_name" content="${BRAND_NAME}"`), `${ex.slug} OG site_name uses BRAND_NAME`);
    assert(/href="\/workspace"/.test(html), `${ex.slug} has a Workspace button`);
    assert(!html.includes('href="/business"'), `${ex.slug} has no /business`);
    const desc = (html.match(/<meta name="description" content="([^"]+)"/) || [])[1] || "";
    assert(!/free|instant/i.test(desc), `${ex.slug} meta omits free/instant`);
  }
  assert(renderDetailHtml("not-a-real-slug") === null, "unknown slug renders null");
}

{
  const listHtml = renderListHtml();
  const staticList = read("out/examples.html");
  assert(staticList === listHtml, "out/examples.html matches the server renderer");
  for (const ex of EXAMPLES) {
    const staticDetail = read(`out/examples/${ex.slug}.html`);
    assert(staticDetail === renderDetailHtml(ex.slug), `out/examples/${ex.slug}.html matches the server renderer`);
  }
}

{
  const res = await listGet(pagesCtx(new Request("https://dreamutopia-clone.pages.dev/examples")));
  const body = await res.text();
  assert(res.status === 200, "GET /examples Function is 200");
  assert((res.headers.get("content-type") || "").includes("text/html"), "GET /examples is HTML");
  assert(body.includes(`<title>${EXAMPLE_LIST_TITLE}</title>`), "Function list is server HTML");
  assert(body.includes(`rel="canonical" href="${CANONICAL_ORIGIN}/examples"`), "Function list canonical");
}

{
  const first = EXAMPLES[0];
  const res = await detailGet(
    pagesCtx(new Request(`https://dreamutopia-clone.pages.dev/examples/${first.slug}`), { slug: first.slug })
  );
  const body = await res.text();
  assert(res.status === 200, "GET /examples/{slug} Function is 200");
  assert(body.includes('"@type":"VideoObject"'), "Function detail includes VideoObject");
  assert(body.includes(`rel="canonical" href="${CANONICAL_ORIGIN}/examples/${first.slug}"`), "Function detail self-canonical");
}

{
  const res = await detailGet(
    pagesCtx(new Request("https://dreamutopia-clone.pages.dev/examples/missing-clip"), { slug: "missing-clip" })
  );
  assert(res.status === 404, "unknown /examples/{slug} is 404");
}

{
  assert(exampleBySlug(EXAMPLES[0].slug)?.slug === EXAMPLES[0].slug, "exampleBySlug finds a known slug");
  assert(exampleBySlug("nope") == null, "exampleBySlug returns null for unknown slugs");
}

if (fail.length) {
  for (const f of fail) console.log("FAIL", f);
  process.exit(1);
}
for (const o of ok) console.log("ok ", o);
console.log(`\nExamples checks passed (${ok.length})`);
