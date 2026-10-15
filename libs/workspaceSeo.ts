import { CANONICAL_ORIGIN } from "./site";

/** Public, indexable workspace URL — never includes query strings. */
export const WORKSPACE_PATH = "/workspace";
export const WORKSPACE_CANONICAL = `${CANONICAL_ORIGIN}${WORKSPACE_PATH}`;
export const WORKSPACE_TITLE = "AI Video Generator – Turn Photos into Videos | DreamUtopia";
export const WORKSPACE_DESCRIPTION =
  "Upload an image, pick a model and motion style, and generate an AI video in minutes. Preview and download your results in HD.";
export const WORKSPACE_H1 = "Create AI Videos from Images";

const ROBOTS_NOINDEX = "noindex";
const USER_WORK_ATTR_RE = /\s(?:src|href)=["'][^"']*\/api\/media[^"']*["']/gi;
const USER_WORK_ABS_RE = /https?:\/\/[^"' \s<>]*\/api\/media[^"' \s<>]*/gi;

export function isWorkspacePath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  return path === WORKSPACE_PATH || path === `${WORKSPACE_PATH}.html`;
}

/** Any query string (tab, mode, pack, checkout, …) is a parameterized workspace URL. */
export function workspaceRequestIsParameterized(requestUrl: string): boolean {
  const url = new URL(requestUrl, CANONICAL_ORIGIN);
  return [...url.searchParams.keys()].length > 0;
}

/** User creations load only on the client. Strip media URLs from HTML the crawler sees. */
export function stripUserWorkUrls(html: string): string {
  return html.replace(USER_WORK_ATTR_RE, "").replace(USER_WORK_ABS_RE, "");
}

function upsertLinkRel(html: string, rel: string, href: string): string {
  const re = new RegExp(`<link\\s+rel=["']${rel}["'][^>]*>`, "i");
  const tag = `<link rel="${rel}" href="${href}">`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/title>/i, `</title>\n${tag}`);
}

function upsertMetaName(html: string, name: string, content: string): string {
  const re = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, "i");
  const tag = `<meta name="${name}" content="${content}">`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/title>/i, `</title>\n${tag}`);
}

function removeMetaName(html: string, name: string): string {
  return html.replace(new RegExp(`\\s*<meta\\s+name=["']${name}["'][^>]*>`, "gi"), "");
}

function upsertMetaProperty(html: string, property: string, content: string): string {
  const re = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, "i");
  const tag = `<meta property="${property}" content="${content}">`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/title>/i, `</title>\n${tag}`);
}

export type WorkspaceHtmlSeo = {
  html: string;
  noindex: boolean;
  canonical: string;
  headers: Record<string, string>;
};

/** Paths that must be in out/_routes.json include so Functions middleware actually runs. */
export const WORKSPACE_FUNCTION_ROUTES = ["/workspace", "/workspace/", "/workspace.html"] as const;

type HtmlRewriterElement = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  remove(): void;
  onEndTag(handler: (end: { before: (content: string, opts: { html: boolean }) => void }) => void): void;
};

type HtmlRewriterLike = {
  on(selector: string, handlers: { element?: (el: HtmlRewriterElement) => void }): HtmlRewriterLike;
  transform(response: Response): Response;
};

function htmlRewriterCtor(): (new () => HtmlRewriterLike) | null {
  const ctor = (globalThis as { HTMLRewriter?: new () => HtmlRewriterLike }).HTMLRewriter;
  return typeof ctor === "function" ? ctor : null;
}

export function workspaceSeoFlags(requestUrl: string): { noindex: boolean; headers: Record<string, string> } {
  const noindex = workspaceRequestIsParameterized(requestUrl);
  const headers: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
  };
  if (noindex) headers["x-robots-tag"] = ROBOTS_NOINDEX;
  return { noindex, headers };
}

function applySeoHeaders(headers: Headers, noindex: boolean): void {
  headers.set("content-type", "text/html; charset=utf-8");
  if (noindex) headers.set("x-robots-tag", ROBOTS_NOINDEX);
  else headers.delete("x-robots-tag");
}

function rewriteWithHtmlRewriter(response: Response, noindex: boolean): Response {
  const Rewriter = htmlRewriterCtor();
  if (!Rewriter) throw new Error("HTMLRewriter is not available");

  const robotsSeen = { value: false };
  const canonicalSeen = { value: false };
  const ogUrlSeen = { value: false };

  return new Rewriter()
    .on("meta", {
      element(el) {
        const name = (el.getAttribute("name") || "").toLowerCase();
        const property = (el.getAttribute("property") || "").toLowerCase();
        if (name === "robots") {
          robotsSeen.value = true;
          if (noindex) el.setAttribute("content", ROBOTS_NOINDEX);
          else el.remove();
        }
        if (property === "og:url") {
          ogUrlSeen.value = true;
          el.setAttribute("content", WORKSPACE_CANONICAL);
        }
      },
    })
    .on("link", {
      element(el) {
        if ((el.getAttribute("rel") || "").toLowerCase() !== "canonical") return;
        canonicalSeen.value = true;
        el.setAttribute("href", WORKSPACE_CANONICAL);
      },
    })
    .on("*", {
      element(el) {
        for (const attr of ["src", "href"]) {
          const value = el.getAttribute(attr);
          if (value && /\/api\/media/i.test(value)) el.removeAttribute(attr);
        }
      },
    })
    .on("head", {
      element(el) {
        el.onEndTag((end) => {
          if (noindex && !robotsSeen.value) {
            end.before(`<meta name="robots" content="${ROBOTS_NOINDEX}">`, { html: true });
          }
          if (!canonicalSeen.value) {
            end.before(`<link rel="canonical" href="${WORKSPACE_CANONICAL}">`, { html: true });
          }
          if (!ogUrlSeen.value) {
            end.before(`<meta property="og:url" content="${WORKSPACE_CANONICAL}">`, { html: true });
          }
        });
      },
    })
    .transform(response);
}

/**
 * Pages-runtime rewrite. Uses HTMLRewriter on workerd; Node unit tests fall back
 * to the string helper so they still cover meta + X-Robots-Tag.
 */
export async function rewriteWorkspaceHtmlResponse(response: Response, requestUrl: string): Promise<Response> {
  const { noindex } = workspaceSeoFlags(requestUrl);
  const headers = new Headers(response.headers);
  applySeoHeaders(headers, noindex);
  const status = response.status;

  if (htmlRewriterCtor()) {
    return rewriteWithHtmlRewriter(new Response(response.body, { status, headers }), noindex);
  }

  const html = await response.text();
  const applied = applyWorkspaceHtmlSeo(html, requestUrl);
  const out = new Headers(headers);
  for (const [key, value] of Object.entries(applied.headers)) out.set(key, value);
  if (!applied.noindex) out.delete("x-robots-tag");
  return new Response(applied.html, { status, headers: out });
}

/**
 * Server-side HTML policy for /workspace:
 * - no query → indexable, canonical is /workspace, no robots noindex
 * - any query (e.g. ?tab=history) → noindex (+ X-Robots-Tag), canonical still /workspace
 * - never emit user work /api/media URLs
 */
export function applyWorkspaceHtmlSeo(html: string, requestUrl: string): WorkspaceHtmlSeo {
  const { noindex, headers } = workspaceSeoFlags(requestUrl);
  let out = stripUserWorkUrls(html);
  out = upsertLinkRel(out, "canonical", WORKSPACE_CANONICAL);
  out = upsertMetaProperty(out, "og:url", WORKSPACE_CANONICAL);
  if (noindex) {
    out = upsertMetaName(out, "robots", ROBOTS_NOINDEX);
  } else {
    out = removeMetaName(out, "robots");
  }
  return { html: out, noindex, canonical: WORKSPACE_CANONICAL, headers };
}
