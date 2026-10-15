import type { Env } from "../libs/utils";
import { isWorkspacePath, rewriteWorkspaceHtmlResponse } from "../libs/workspaceSeo";

/**
 * Pages Function middleware — HTML only, via HTMLRewriter on the real asset.
 * /workspace with no query is indexable.
 * /workspace?tab=… (any params) is noindex, canonical still /workspace.
 * These paths must be listed in out/_routes.json include, or Pages serves the
 * static HTML and this file never runs (that is why #32 did not take effect).
 * Does not rewrite /api/* or other pages (/business 301 lives in functions/business.ts).
 */
export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  if (!isWorkspacePath(url.pathname)) {
    return context.next();
  }

  const res = await context.next();
  const method = context.request.method;
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
