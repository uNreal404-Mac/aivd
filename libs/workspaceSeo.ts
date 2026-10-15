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

/**
 * Server-side HTML policy for /workspace:
 * - no query → indexable, canonical is /workspace, no robots noindex
 * - any query (e.g. ?tab=history) → noindex (+ X-Robots-Tag), canonical still /workspace
 * - never emit user work /api/media URLs
 */
export function applyWorkspaceHtmlSeo(html: string, requestUrl: string): WorkspaceHtmlSeo {
  const noindex = workspaceRequestIsParameterized(requestUrl);
  let out = stripUserWorkUrls(html);
  out = upsertLinkRel(out, "canonical", WORKSPACE_CANONICAL);
  out = upsertMetaProperty(out, "og:url", WORKSPACE_CANONICAL);
  if (noindex) {
    out = upsertMetaName(out, "robots", ROBOTS_NOINDEX);
  } else {
    out = removeMetaName(out, "robots");
  }
  const headers: Record<string, string> = {
    "content-type": "text/html; charset=utf-8",
  };
  if (noindex) headers["x-robots-tag"] = ROBOTS_NOINDEX;
  return { html: out, noindex, canonical: WORKSPACE_CANONICAL, headers };
}
