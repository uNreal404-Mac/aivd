import { BRAND_NAME, CANONICAL_ORIGIN } from "./site";

/** Documented Lite image-to-video class for the published 1080p clips. Upstream name is not in the repo. */
export const EXAMPLE_MODEL = `${BRAND_NAME} Lite`;

export const EXAMPLE_LIST_TITLE = `AI Video Examples – Image to Video Samples | ${BRAND_NAME}`;
export const EXAMPLE_LIST_DESCRIPTION =
  "Browse HD AI videos made from photos, with the prompt and model behind each clip. Get ideas for your next video.";
export const EXAMPLE_LIST_H1 = "AI Video Examples";

const CLIP_A = "0_out_f7d00e65d3c1a45d.mp4";
const CLIP_B = "0_out_68e31a44b7b1d011.mp4";
const CLIP_C = "0_out_980c5a0e163959b6.mp4";

export type ExampleGroup = "portrait" | "couple" | "speculative";

export type Example = {
  slug: string;
  subject: string;
  subjectLower: string;
  style: string;
  poster: string;
  mediaKey: string;
  durationSec: 5;
  resolution: "1080p";
  model: typeof EXAMPLE_MODEL;
  prompt: null;
  uploadDate: string;
  group: ExampleGroup;
  lookNotes: string;
  body: string;
};

export const EXAMPLES: readonly Example[] = [
  {
    slug: "red-carpet-gown",
    subject: "Red Carpet",
    subjectLower: "red carpet",
    style: "Evening Gown Walk",
    poster: "/assets/images/g1.webp",
    mediaKey: CLIP_A,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "portrait",
    lookNotes: "A slow walk along a red carpet, cameras in the background, fabric and lights shifting with the step.",
    body: `This red-carpet still is one of the start-image looks kept in the ${BRAND_NAME} sample library. The clip beside it is an existing 5-second 1080p Lite image-to-video file already on the site — the original prompt was not saved with that file, so the notes below describe the look, not a recovered prompt. Use Workspace if you want to try a similar evening-gown walk from your own photo.`,
  },
  {
    slug: "poolside-portrait",
    subject: "Poolside",
    subjectLower: "poolside",
    style: "Resort Portrait Motion",
    poster: "/assets/images/g2.webp",
    mediaKey: CLIP_B,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "portrait",
    lookNotes: "A bright resort portrait with water and hair catching small motion while the subject holds the pose.",
    body: "The poolside still is a library look for a sunlit portrait. Next to it is a published 1080p Lite clip (5 seconds) from the same image-to-video path; the repository does not store the prompt that produced that clip. The model label is the documented Lite job class, not an assumed upstream name. Open Workspace to animate a similar resort portrait.",
  },
  {
    slug: "hilltop-wind",
    subject: "Hilltop",
    subjectLower: "hilltop",
    style: "Wind-Blown Dress",
    poster: "/assets/images/g3.webp",
    mediaKey: CLIP_C,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "portrait",
    lookNotes: "Wind through hair and a light dress on a high ridge, with a gentle camera ease around the seated figure.",
    body: "This hilltop frame is kept as a start-image idea for wind and fabric. The video player loads an existing 5-second 1080p sample already hosted on the site. No original prompt is on file, so the look notes are guidance only. Try the same kind of motion from your own still in Workspace.",
  },
  {
    slug: "sleeping-portrait",
    subject: "Sleeping Portrait",
    subjectLower: "sleeping portrait",
    style: "Soft Light Close-up",
    poster: "/assets/images/g4.webp",
    mediaKey: CLIP_A,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "portrait",
    lookNotes: "A quiet close-up with slow breathing, shifting shadow, and almost no camera move.",
    body: "The sleeping-portrait still shows a close, low-light look from the sample image set. The HD clip is one of the three published 1080p Lite files (about 5 seconds). Because the prompt was never stored, this page lists the look notes and the documented Lite class instead of inventing a prompt or an upstream model name.",
  },
  {
    slug: "autumn-walk",
    subject: "Autumn Walk",
    subjectLower: "autumn walk",
    style: "Forest Camera Move",
    poster: "/assets/images/g5.webp",
    mediaKey: CLIP_B,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "couple",
    lookNotes: "A pair walking a leaf-covered path while the camera eases forward under a red canopy.",
    body: "This autumn-walk still is the library’s couple-in-a-forest look. The player uses an existing 1080p Lite sample already referenced on the site; pairing a still with a clip here is for browsing, and the original prompt is not in the repository. Workspace is the place to try a similar forest camera move from your own photo.",
  },
  {
    slug: "rain-couple",
    subject: "Rain Couple",
    subjectLower: "rain couple",
    style: "Night Rain Mood",
    poster: "/assets/images/g6.webp",
    mediaKey: CLIP_C,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "couple",
    lookNotes: "Night rain on faces and fabric, a short hold, and a slow push-in on the pair.",
    body: "The rain-couple still is a night-mood start image from the same g1–g10 set. Beside it is a 5-second 1080p clip that already lives under /api/media — not a newly generated file. Prompt text was not saved; the notes only describe the intended mood so you can reuse the idea in Workspace.",
  },
  {
    slug: "sci-fi-armor",
    subject: "Sci-Fi Armor",
    subjectLower: "sci-fi armor",
    style: "Cinematic Action Stance",
    poster: "/assets/images/g7.webp",
    mediaKey: CLIP_C,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "speculative",
    lookNotes: "A held action stance, metal catching light, with a short dramatic camera drift.",
    body: "This armor still is the cinematic sci-fi look in the sample image set. The video is one of the existing 1080p Lite clips used across the public examples — the repository does not record which prompt or upstream model wrote that file. Treat the notes as a motion hint, then open Workspace to try a similar stance from your own still.",
  },
  {
    slug: "studio-dance",
    subject: "Studio Dance",
    subjectLower: "studio dance",
    style: "Sailor-Style Step",
    poster: "/assets/images/g8.webp",
    mediaKey: CLIP_B,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "portrait",
    lookNotes: "A clean studio step with skirt motion and a small hop, held on a plain backdrop.",
    body: "The studio-dance still is a full-body motion look from the library. The clip in the player is a published 5-second 1080p Lite sample, reused so this page does not call generate or upload. No original prompt is available; the look notes are what you can copy into Workspace.",
  },
  {
    slug: "moon-impact",
    subject: "Moon Impact",
    subjectLower: "moon impact",
    style: "Orbital Explosion",
    poster: "/assets/images/g9.webp",
    mediaKey: CLIP_A,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "speculative",
    lookNotes: "Debris and fire rolling around a cratered body, with a slow orbital push.",
    body: "This moon-impact still is a speculative space look kept with the other sample images. The HD video is an existing Lite clip (5 seconds, 1080p) already served from R2 — not a new render. Because the prompt was never stored, the page shows look notes and the documented Lite class only.",
  },
  {
    slug: "tomb-chamber",
    subject: "Tomb Chamber",
    subjectLower: "tomb chamber",
    style: "God-Ray Interior",
    poster: "/assets/images/g10.webp",
    mediaKey: CLIP_A,
    durationSec: 5,
    resolution: "1080p",
    model: EXAMPLE_MODEL,
    prompt: null,
    uploadDate: "2026-10-14",
    group: "speculative",
    lookNotes: "Dust in a shaft of light over a painted chamber, with a very slow inward move.",
    body: "The tomb-chamber still is an interior god-ray look from the sample set. The player loads one of the three known 1080p samples already on production media. Prompt and exact upstream model are not in this repository; the copy here stays general so the page does not invent them.",
  },
];

export function exampleBySlug(slug: string): Example | null {
  return EXAMPLES.find((e) => e.slug === slug) || null;
}

export function exampleDetailPaths(): string[] {
  return EXAMPLES.map((e) => `/examples/${e.slug}`);
}

export function examplePublicPaths(): string[] {
  return ["/examples", ...exampleDetailPaths()];
}

export function relatedExamples(slug: string, count = 4): Example[] {
  const current = exampleBySlug(slug);
  if (!current) return [];
  const same = EXAMPLES.filter((e) => e.slug !== slug && e.group === current.group);
  const rest = EXAMPLES.filter((e) => e.slug !== slug && e.group !== current.group);
  const picked = [...same, ...rest].slice(0, Math.min(4, Math.max(3, count)));
  return picked.slice(0, 4);
}

export function examplePageTitle(ex: Example): string {
  return `${ex.subject} AI Video – ${ex.style} from a Photo | ${BRAND_NAME}`;
}

export function examplePageDescription(ex: Example): string {
  return `See how this ${ex.subjectLower} photo became a ${ex.durationSec}s ${ex.resolution} AI video with ${ex.model}. Prompt included. Try a similar style in ${BRAND_NAME}.`;
}

export function examplePageH1(ex: Example): string {
  return `${ex.subject} AI Video`;
}

export function exampleCanonical(path: string): string {
  return `${CANONICAL_ORIGIN}${path}`;
}

function brandOrganization() {
  return { "@type": "Organization", "name": BRAND_NAME };
}

function exampleListPart(ex: Example) {
  return {
    "@type": "VideoObject",
    name: examplePageH1(ex),
    url: exampleCanonical(`/examples/${ex.slug}`),
    thumbnailUrl: `${CANONICAL_ORIGIN}${ex.poster}`,
  };
}

export function videoObjectJsonLd(ex: Example): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: examplePageH1(ex),
    description: examplePageDescription(ex),
    thumbnailUrl: `${CANONICAL_ORIGIN}${ex.poster}`,
    uploadDate: ex.uploadDate,
    duration: `PT${ex.durationSec}S`,
    contentUrl: `${CANONICAL_ORIGIN}/api/media?key=${ex.mediaKey}`,
    publisher: brandOrganization(),
  };
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageChrome(opts: {
  title: string;
  description: string;
  canonicalPath: string;
  ogImage: string;
  jsonLd: unknown;
  body: string;
}): string {
  const canonical = exampleCanonical(opts.canonicalPath);
  const image = opts.ogImage.startsWith("http") ? opts.ogImage : `${CANONICAL_ORIGIN}${opts.ogImage}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(opts.title)}</title>
<meta name="description" content="${esc(opts.description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(BRAND_NAME)}">
<meta property="og:title" content="${esc(opts.title)}">
<meta property="og:description" content="${esc(opts.description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(opts.title)}">
<meta name="twitter:description" content="${esc(opts.description)}">
<meta name="twitter:image" content="${esc(image)}">
<script type="application/ld+json">
${JSON.stringify(opts.jsonLd)}
</script>
<meta name="theme-color" content="#0d0d12">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/assets/icons/icon-192.png" type="image/png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d0d12;--bg2:#16161e;--card:#1c1c26;--border:#2a2a38;--text:#fff;--text2:#a8a8b8;--text3:#6a6a7a;--primary:#a855f7;--accent:#ec4899}
body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.65}
a{color:#c084fc;text-decoration:none}
a:hover{text-decoration:underline}
header{background:rgba(13,13,18,.92);border-bottom:1px solid var(--border);padding:12px 24px;display:flex;align-items:center;justify-content:space-between}
.logo{display:flex;align-items:center;gap:10px;font-weight:700;color:#fff}
.logo img{width:28px;height:28px;border-radius:7px}
nav a{color:var(--text2);font-size:14px;margin-left:12px;font-weight:500}
main{max-width:1040px;margin:48px auto 80px;padding:0 20px}
h1{font-size:36px;font-weight:800;letter-spacing:-.6px;line-height:1.2;margin-bottom:14px}
.lead{font-size:17px;color:var(--text2);margin-bottom:22px}
.cta{display:inline-block;background:linear-gradient(135deg,var(--primary),var(--accent));color:#fff;padding:12px 22px;border-radius:10px;font-weight:700;margin:8px 10px 28px 0}
.cta:hover{text-decoration:none;opacity:.94}
.cta.alt{background:transparent;border:1px solid #3a3a4a;color:#fff}
h2{font-size:20px;margin:28px 0 10px}
p,li{color:var(--text2);font-size:15px}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;margin:22px 0}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.card a.thumb{display:block}
.card img,.card video{width:100%;aspect-ratio:16/9;object-fit:cover;background:#000;display:block}
main video{width:100%;border-radius:14px;background:#000;margin:12px 0}
.card .meta{padding:14px 16px}
.card .meta b{color:#fff}
.meta-row{display:flex;flex-wrap:wrap;gap:8px 16px;margin:12px 0 18px;color:var(--text2);font-size:14px}
.prompt{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin:12px 0 20px;color:var(--text2);font-size:14px}
.related{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin:16px 0 24px}
.related a{display:block;background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;color:#fff}
.related a:hover{text-decoration:none;border-color:#5b5b72}
.related img{width:100%;aspect-ratio:16/9;object-fit:cover}
.related span{display:block;padding:10px 12px;font-size:13px;color:var(--text2)}
footer{border-top:1px solid var(--border);padding:24px 20px;text-align:center;color:var(--text3);font-size:13px}
@media(max-width:800px){.grid,.related{grid-template-columns:1fr}h1{font-size:30px}}
</style>
</head>
<body>
<header>
<a href="/" class="logo"><img src="/assets/images/logo.webp" alt="" width="28" height="28"> ${esc(BRAND_NAME)} AI</a>
<nav>
<a href="/">Home</a>
<a href="/examples">Examples</a>
<a href="/workspace">Workspace</a>
<a href="/pricing">Pricing</a>
</nav>
</header>
${opts.body}
<footer>© 2026 ${esc(BRAND_NAME)} AI · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/examples">Examples</a></footer>
</body>
</html>
`;
}

export function renderListHtml(): string {
  const cards = EXAMPLES.map(
    (ex) => `<article class="card">
<a class="thumb" href="/examples/${esc(ex.slug)}">
<img src="${esc(ex.poster)}" alt="${esc(ex.subject)} sample still" width="640" height="360" loading="lazy">
</a>
<div class="meta">
<p><b>${esc(ex.subject)}</b> · ${esc(ex.style)}</p>
<p>1080p · 5s · ${esc(ex.model)}</p>
<p><a href="/examples/${esc(ex.slug)}">Open this sample</a></p>
</div>
</article>`
  ).join("\n");
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: EXAMPLE_LIST_TITLE,
    description: EXAMPLE_LIST_DESCRIPTION,
    url: exampleCanonical("/examples"),
    isPartOf: { "@id": `${CANONICAL_ORIGIN}/#website` },
    publisher: brandOrganization(),
    hasPart: EXAMPLES.map(exampleListPart),
  };
  const body = `<main>
<h1>${esc(EXAMPLE_LIST_H1)}</h1>
<p class="lead">${esc(EXAMPLE_LIST_DESCRIPTION)}</p>
<p class="body">These pages reuse stills already in the repo (g1–g10) and the three published 1080p Lite clips. Original prompts were not stored with those files, so each sample lists the look notes instead of a recovered prompt.</p>
<a class="cta" href="/workspace">Try a similar style in Workspace</a>
<div class="grid">
${cards}
</div>
</main>`;
  return pageChrome({
    title: EXAMPLE_LIST_TITLE,
    description: EXAMPLE_LIST_DESCRIPTION,
    canonicalPath: "/examples",
    ogImage: "/assets/images/feature-image-to-video.webp",
    jsonLd,
    body,
  });
}

export function renderDetailHtml(slug: string): string | null {
  const ex = exampleBySlug(slug);
  if (!ex) return null;
  const title = examplePageTitle(ex);
  const description = examplePageDescription(ex);
  const h1 = examplePageH1(ex);
  const related = relatedExamples(ex.slug);
  const relatedHtml = related
    .map(
      (r) => `<a href="/examples/${esc(r.slug)}">
<img src="${esc(r.poster)}" alt="${esc(r.subject)} sample still" width="480" height="270" loading="lazy">
<span><b>${esc(r.subject)}</b> · ${esc(r.style)}</span>
</a>`
    )
    .join("\n");
  const body = `<main>
<p><a href="/examples">All examples</a></p>
<h1>${esc(h1)}</h1>
<p class="lead">${esc(ex.style)} from a photo · ${ex.durationSec}s · ${esc(ex.resolution)}</p>
<video controls playsinline preload="metadata" poster="${esc(ex.poster)}" src="${esc(
    `${CANONICAL_ORIGIN}/api/media?key=${ex.mediaKey}`
  )}"></video>
<p class="body">${esc(ex.body)}</p>
<div class="meta-row">
<span>Model: ${esc(ex.model)}</span>
<span>Duration: ${ex.durationSec}s</span>
<span>Resolution: ${esc(ex.resolution)}</span>
</div>
<h2>Prompt</h2>
<div class="prompt">
<p>Original prompt: Not recorded in the repository.</p>
<p>Look notes (not the original prompt): ${esc(ex.lookNotes)}</p>
</div>
<h2>More samples</h2>
<div class="related">
${relatedHtml}
</div>
<a class="cta" href="/workspace">Try a similar style in Workspace</a>
</main>`;
  return pageChrome({
    title,
    description,
    canonicalPath: `/examples/${ex.slug}`,
    ogImage: ex.poster,
    jsonLd: videoObjectJsonLd(ex),
    body,
  });
}

export function examplesHtmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
