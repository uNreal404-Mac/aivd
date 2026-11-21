/**
 * Pre-launch check: fetch every page the sitemap lists and report what would
 * hurt it in search: no or several H1s, a canonical pointing elsewhere,
 * missing hreflang, noindex, thin text, overlong titles, broken internal links.
 *
 *   pnpm check:site https://aivd-preview.pages.dev --preview
 *   pnpm check:site https://aivd.ai
 *   pnpm check:site http://localhost:3000 --only=/text-to-video,/image-to-video
 *
 * The page list comes from the same config as the sitemap (the preview's
 * sitemap is empty on purpose). `--preview` accepts the preview site's
 * noindex and " Preview" title suffix. Exits 1 when any page has an error.
 */
import { i18n, localeConfig } from "@/config/i18n-config";
import { PUBLIC_ROUTES } from "@/config/indexing-paths";
import { HELP_SLUGS } from "@/lib/help-articles";
import { INDEXED_LANDING_SLUGS } from "@/lib/model-landing";
import { checkPage, normalizePath, pageFacts, type Issue } from "@/lib/site-check";

const args = process.argv.slice(2);
const base = (args.find((arg) => /^https?:\/\//.test(arg)) ?? "https://aivd-preview.pages.dev").replace(/\/+$/, "");
const preview = args.includes("--preview") || /preview|localhost|127\.0\.0\.1/.test(base);
const host = new URL(base).host;
// A local dev server compiles each route on its first request, and parallel
// first requests can corrupt its manifests (every page then answers 500), so
// it gets one request at a time.
const local = /localhost|127\.0\.0\.1/.test(base);
const parallel = local ? 1 : 4;
const linkParallel = local ? 1 : 6;

const routes = [
  ...PUBLIC_ROUTES.map((route) => route.path),
  ...INDEXED_LANDING_SLUGS.map((slug) => `/models/${slug}`),
  "/help",
  ...HELP_SLUGS.map((slug) => `/help/${slug}`),
];
const hreflangs = [...i18n.locales.map((locale) => localeConfig[locale].hreflang), "x-default"];
// --only=/a,/b keeps the pages whose path contains one of these.
const only = args.find((arg) => arg.startsWith("--only="))?.slice("--only=".length).split(",").filter(Boolean) ?? [];
const pages = routes.flatMap((path) =>
  i18n.locales.map((locale) => {
    const prefix = locale === i18n.defaultLocale ? "" : `/${locale}`;
    return { path: path === "/" ? prefix || "/" : `${prefix}${path}`, language: locale === "zh" ? ("zh" as const) : ("en" as const), home: path === "/" };
  }),
).filter((page) => only.length === 0 || only.some((part) => page.path.includes(part)));

async function fetchPage(path: string): Promise<{ status: number; html: string; location: string | null }> {
  const response = await fetch(`${base}${path}`, { redirect: "manual", headers: { "user-agent": "aivd-site-check" } });
  return { status: response.status, html: response.status === 200 ? await response.text() : "", location: response.headers.get("location") };
}

async function inBatches<T, R>(items: T[], size: number, run: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let index = 0; index < items.length; index += size) out.push(...(await Promise.all(items.slice(index, index + size).map(run))));
  return out;
}

// tsx runs this file as CommonJS, which has no top-level await.
async function main(): Promise<number> {
  const links = new Map<string, string>(); // link path -> first page that has it
  let errorCount = 0;
  let warningCount = 0;

  console.log(`Checking ${pages.length} pages on ${base}${preview ? " (preview: noindex and the title suffix are expected)" : ""}\n`);

  const results = await inBatches(pages, parallel, async (page) => {
    try {
      const { status, html, location } = await fetchPage(page.path);
      if (status !== 200) {
        return { page, issues: [{ level: "error", message: `HTTP ${status}${location ? ` → ${location}` : ""}` }] as Issue[] };
      }
      const facts = pageFacts(html);
      for (const href of facts.links) {
        if (/^(mailto:|tel:|#|javascript:)/i.test(href)) continue;
        let url: URL;
        try {
          url = new URL(href, `${base}${page.path}`);
        } catch {
          continue;
        }
        if (url.host !== host || url.pathname.startsWith("/api/") || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) continue;
        const key = normalizePath(url.pathname);
        if (!links.has(key)) links.set(key, page.path);
      }
      return { page, issues: checkPage(facts, { path: page.path, language: page.language, home: page.home, hreflangs, preview }) };
    } catch (error) {
      return { page, issues: [{ level: "error", message: `could not fetch: ${String(error).slice(0, 120)}` }] as Issue[] };
    }
  });

  for (const { page, issues } of results) {
    const errors = issues.filter((issue) => issue.level === "error");
    const warnings = issues.filter((issue) => issue.level === "warning");
    errorCount += errors.length;
    warningCount += warnings.length;
    const mark = errors.length ? "✗" : warnings.length ? "!" : "✓";
    console.log(`${mark} ${page.path}`);
    for (const issue of [...errors, ...warnings]) console.log(`    ${issue.level === "error" ? "error  " : "warning"}  ${issue.message}`);
  }

  // Internal links: each one should answer 200 directly, not through a redirect.
  const linkPaths = [...links.keys()].slice(0, 400);
  const linkResults = await inBatches(linkPaths, linkParallel, async (path) => {
    try {
      const { status, location } = await fetchPage(path);
      return { path, status, location };
    } catch {
      return { path, status: 0, location: null };
    }
  });
  const broken = linkResults.filter((item) => item.status >= 400 || item.status === 0);
  const redirected = linkResults.filter((item) => item.status >= 300 && item.status < 400);
  console.log(`\nInternal links: ${linkResults.length} checked, ${broken.length} broken, ${redirected.length} through a redirect`);
  for (const item of broken) console.log(`    error    ${item.path} → HTTP ${item.status} (linked from ${links.get(item.path)})`);
  for (const item of redirected) console.log(`    warning  ${item.path} → ${item.status} ${item.location ?? ""} (linked from ${links.get(item.path)})`);
  errorCount += broken.length;
  warningCount += redirected.length;

  console.log(`\n${errorCount} error(s), ${warningCount} warning(s) across ${pages.length} pages.`);
  return errorCount > 0 ? 1 : 0;
}

main().then((code) => process.exit(code));
