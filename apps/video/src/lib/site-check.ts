/**
 * The pre-launch check for indexable pages: what a search engine reads in a
 * page's HTML, and the rules each page has to meet before it goes live.
 * `scripts/site-check.ts` fetches the pages and prints the report; the rules
 * live here so they can be tested without a network.
 */

export type PageFacts = {
  title: string | null;
  description: string | null;
  canonical: string | null;
  robots: string | null;
  lang: string | null;
  hreflangs: string[];
  h1: string[];
  words: number;
  cjkChars: number;
  imagesWithoutAlt: number;
  links: string[];
  /** Structured data blocks that are not valid JSON, or that carry "undefined" or an empty URL. */
  badJsonLd: number;
};

export type Issue = { level: "error" | "warning"; message: string };

export type CheckContext = {
  /** Path of the page as listed, e.g. "/zh/pricing". */
  path: string;
  /** "en" or "zh": the language the page is in. */
  language: "en" | "zh";
  /** Homepages need more text than inner pages. */
  home: boolean;
  /** hreflang codes every listed page must link to, e.g. ["en", "zh-CN", "x-default"]. */
  hreflangs: string[];
  /** The preview site is noindex on purpose and adds " Preview" to titles. */
  preview: boolean;
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

function decode(text: string): string {
  return text
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, code: string) => {
      const key = code.toLowerCase();
      if (key in ENTITIES) return ENTITIES[key];
      if (key.startsWith("#x")) return String.fromCodePoint(Number.parseInt(key.slice(2), 16));
      if (key.startsWith("#")) return String.fromCodePoint(Number.parseInt(key.slice(1), 10));
      return match;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/** The value of one attribute in a tag, or null. */
function attribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!match) return null;
  return decode(match[2] ?? match[3] ?? match[4] ?? "");
}

function tags(html: string, name: string): string[] {
  return html.match(new RegExp(`<${name}\\b[^>]*>`, "gi")) ?? [];
}

/** What a crawler reads in a page: head tags, headings, visible text, links. */
export function pageFacts(html: string): PageFacts {
  // Next.js streams metadata, so <title>, the description, canonical and
  // hreflang links can arrive inside <body>; React moves them into <head> in
  // the browser. Read them anywhere, skipping <svg> (which has its own
  // <title>) and scripts.
  const head = html.replace(/<(script|style|svg|noscript|template)\b[\s\S]*?<\/\1>/gi, " ");
  const metas = tags(head, "meta");
  const linkTags = tags(head, "link");
  const meta = (name: string) => {
    const tag = metas.find((item) => attribute(item, "name")?.toLowerCase() === name);
    return tag ? attribute(tag, "content") : null;
  };
  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] ?? "";

  // Visible text: drop scripts (the RSC payload lives there), styles and
  // other non-text elements, then the tags themselves.
  const body = (html.split(/<body\b[^>]*>/i)[1] ?? html)
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const h1 = [...body.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => decode(match[1].replace(/<[^>]+>/g, " ")));
  const text = decode(body.replace(/<[^>]+>/g, " "));
  const cjkChars = (text.match(/[㐀-鿿]/g) ?? []).length;
  const words = (text.replace(/[㐀-鿿]/g, " ").match(/[A-Za-z0-9][A-Za-z0-9'’-]*/g) ?? []).length;

  const badJsonLd = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)].filter((match) => {
    try {
      JSON.parse(match[1]);
    } catch {
      return true;
    }
    return /undefined|"(url|item|@id)":""/.test(match[1]);
  }).length;

  return {
    badJsonLd,
    title: titleMatch ? decode(titleMatch[1]) : null,
    description: meta("description"),
    canonical: (() => {
      const tag = linkTags.find((item) => attribute(item, "rel")?.toLowerCase() === "canonical");
      return tag ? attribute(tag, "href") : null;
    })(),
    robots: meta("robots"),
    lang: attribute(htmlTag, "lang"),
    hreflangs: linkTags
      .filter((item) => attribute(item, "rel")?.toLowerCase() === "alternate" && attribute(item, "hreflang"))
      .map((item) => attribute(item, "hreflang") as string),
    h1,
    words,
    cjkChars,
    imagesWithoutAlt: tags(body, "img").filter((tag) => attribute(tag, "alt") === null).length,
    links: tags(body, "a")
      .map((tag) => attribute(tag, "href"))
      .filter((href): href is string => Boolean(href)),
  };
}

/** "/zh/pricing/" and "https://host/zh/pricing" both become "/zh/pricing". */
export function normalizePath(href: string): string {
  let path = href;
  try {
    path = new URL(href, "https://placeholder.invalid").pathname;
  } catch {
    // Keep the raw value; it is reported as it was found.
  }
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

/** Title without the preview site's suffix (" Preview", " 预览站"). */
function cleanTitle(title: string, preview: boolean): string {
  return preview ? title.replace(/\s*(Preview|预览站)$/, "").trim() : title;
}

/**
 * How wide text shows in a search result, in Latin letters: a Chinese
 * character takes about two. Google cuts titles near 60 and descriptions near
 * 160 of these, in either language.
 */
export function displayWidth(text: string): number {
  const cjk = (text.match(/[㐀-鿿　-〿＀-￯]/g) ?? []).length;
  return text.length + cjk;
}

const STOPWORDS = new Set(["with", "from", "your", "into", "that", "this", "free", "best", "online", "aivd"]);

function keywords(text: string): Set<string> {
  return new Set((text.toLowerCase().match(/[a-z0-9]{3,}|[㐀-鿿]{2,}/g) ?? []).filter((word) => !STOPWORDS.has(word)));
}

/** Title and description widths (see displayWidth), and how much text a page needs per language. */
export const LIMITS = {
  title: [10, 60],
  description: [50, 160],
  en: { homeWords: 800, pageWords: 600 },
  zh: { homeWords: 1500, pageWords: 1000 },
} as const;

/** Pages with no length target: they answer no search. */
export const NO_LENGTH_TARGET = ["/about", "/privacy", "/terms", "/refund-policy", "/contact"];

/** Every rule a listed page has to meet, as errors (block launch) and warnings. */
export function checkPage(facts: PageFacts, context: CheckContext): Issue[] {
  const issues: Issue[] = [];
  const error = (message: string) => issues.push({ level: "error", message });
  const warn = (message: string) => issues.push({ level: "warning", message });
  const limits = LIMITS[context.language];

  if (!facts.title) error("no <title>");
  else {
    const title = cleanTitle(facts.title, context.preview);
    const [min, max] = LIMITS.title;
    const width = displayWidth(title);
    if (width < min || width > max) warn(`title is ${width} wide (aim for ${min}–${max}; a Chinese character counts 2): "${title}"`);
  }

  if (!facts.description) error("no meta description");
  else {
    const [min, max] = LIMITS.description;
    const width = displayWidth(facts.description);
    if (width < min || width > max) warn(`description is ${width} wide (aim for ${min}–${max})`);
  }

  if (!facts.canonical) error("no canonical link");
  else if (normalizePath(facts.canonical) !== normalizePath(context.path)) error(`canonical points to ${normalizePath(facts.canonical)}, not to this page`);

  if (facts.h1.length === 0) error("no H1");
  else if (facts.h1.length > 1) error(`${facts.h1.length} H1s (one per page): ${facts.h1.map((text) => `"${text.slice(0, 40)}"`).join(", ")}`);
  else if (facts.h1[0].length === 0) error("the H1 is empty");

  if (!facts.lang) error("no lang on <html>");

  if (!context.preview && facts.robots?.toLowerCase().includes("noindex")) error("marked noindex but listed in the sitemap");

  const missing = context.hreflangs.filter((code) => !facts.hreflangs.includes(code));
  if (missing.length) error(`no hreflang link for ${missing.join(", ")}`);

  // About, legal and contact pages answer no search, so their length is not a target.
  const bare = normalizePath(context.path).replace(/^\/zh(?=\/|$)/, "") || "/";
  // Help pages answer one question in a few paragraphs on purpose, like the
  // help-centre articles AI search cites; padding them would bury the answer.
  if (!NO_LENGTH_TARGET.includes(bare) && bare !== "/help" && !bare.startsWith("/help/")) {
    const amount = context.language === "zh" ? facts.cjkChars : facts.words;
    const needed = context.home ? limits.homeWords : limits.pageWords;
    const unit = context.language === "zh" ? "characters" : "words";
    if (amount < needed) warn(`${amount} ${unit} of text (aim for ${needed}+)`);
  }

  if (facts.badJsonLd > 0) error(`${facts.badJsonLd} structured data block(s) that are broken or carry "undefined" or an empty URL`);

  if (facts.imagesWithoutAlt > 0) warn(`${facts.imagesWithoutAlt} image(s) without alt`);

  if (facts.title && facts.h1.length === 1) {
    const shared = [...keywords(cleanTitle(facts.title, context.preview))].filter((word) => keywords(facts.h1[0]).has(word));
    if (shared.length === 0) warn(`title and H1 share no keyword ("${facts.h1[0].slice(0, 50)}")`);
  }

  return issues;
}
