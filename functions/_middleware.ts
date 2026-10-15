import type { Env } from "../libs/utils";
import { isPartnersPath, rewritePartnersHtmlResponse } from "../libs/partners";
import { isWorkspacePath, rewriteWorkspaceHtmlResponse } from "../libs/workspaceSeo";

/**
 * Pages Function middleware — HTML only.
 * /partners is always noindex (+ X-Robots-Tag).
 * /workspace with no query is indexable.
 * /workspace?tab=… (any params) is noindex, canonical still /workspace.
 * These paths must be listed in out/_routes.json include, or Pages serves the
 * static HTML and this file never runs (that is why #32 did not take effect).
 * Do not add overlapping splat rules (/partners/* next to /partners/, or
 * /examples plus /examples/*). Does not rewrite /api/* or /business.
 */
async function rewriteHtml(
  context: EventContext<Env, string, unknown>,
  rewrite: (response: Response) => Promise<Response>
): Promise<Response> {
  const res = await context.next();
  const method = context.request.method;
  if (method !== "GET" && method !== "HEAD") return res;
  if (res.status !== 200) return res;
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (ct && !ct.includes("text/html")) return res;

  try {
    const rewritten = await rewrite(res);
    if (method === "HEAD") {
      return new Response(null, { status: 200, headers: rewritten.headers });
    }
    return rewritten;
  } catch {
    return res;
  }
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  if (isPartnersPath(url.pathname)) {
    return rewriteHtml(context, (res) => rewritePartnersHtmlResponse(res));
  }
  if (!isWorkspacePath(url.pathname)) {
    return context.next();
  }
  return rewriteHtml(context, (res) => rewriteWorkspaceHtmlResponse(res, context.request.url));
};
