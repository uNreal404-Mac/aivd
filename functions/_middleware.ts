import type { Env } from "../libs/utils";
import { isPartnersPath, rewritePartnersHtmlResponse } from "../libs/partners";
import { isWorkspacePath, rewriteWorkspaceHtmlResponse } from "../libs/workspaceSeo";

/**
 * Pages Function middleware — HTML only.
 * /partners is always noindex (+ X-Robots-Tag), including pretty-URL 308s.
 * /workspace with no query is indexable.
 * /workspace?tab=… (any params) is noindex, canonical still /workspace.
 * These paths must be listed in out/_routes.json include, or Pages serves the
 * static HTML and this file never runs (that is why #32 did not take effect).
 * Do not add overlapping splat rules (/partners/* next to /partners/, or
 * /examples plus /examples/*). Does not rewrite /api/* or /business.
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const method = context.request.method;

  if (isPartnersPath(url.pathname)) {
    const res = await context.next();
    if (method !== "GET" && method !== "HEAD") return res;
    if (res.status !== 200) {
      const headers = new Headers(res.headers);
      headers.set("x-robots-tag", "noindex");
      return new Response(res.body, { status: res.status, headers });
    }
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct && !ct.includes("text/html")) {
      const headers = new Headers(res.headers);
      headers.set("x-robots-tag", "noindex");
      return new Response(res.body, { status: res.status, headers });
    }
    try {
      const rewritten = await rewritePartnersHtmlResponse(res);
      if (method === "HEAD") {
        return new Response(null, { status: 200, headers: rewritten.headers });
      }
      return rewritten;
    } catch {
      const headers = new Headers(res.headers);
      headers.set("x-robots-tag", "noindex");
      return new Response(res.body, { status: res.status, headers });
    }
  }

  if (!isWorkspacePath(url.pathname)) {
    return context.next();
  }

  const res = await context.next();
  if (method !== "GET" && method !== "HEAD") return res;
  if (res.status !== 200) return res;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct && !ct.includes("text/html")) return res;

  try {
    const rewritten = await rewriteWorkspaceHtmlResponse(res, context.request.url);
    if (method === "HEAD") {
      return new Response(null, { status: 200, headers: rewritten.headers });
    }
    return rewritten;
  } catch {
    return res;
  }
};
