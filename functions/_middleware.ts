import type { Env } from "../libs/utils";
import { applyWorkspaceHtmlSeo, isWorkspacePath } from "../libs/workspaceSeo";

/**
 * Pages Function middleware — HTML only.
 * /workspace with no query is indexable.
 * /workspace?tab=… (any params) is noindex, canonical still /workspace.
 * Does not touch /api/*, /business, or other static pages.
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

  let html = "";
  try {
    html = await res.text();
  } catch {
    return res;
  }
  try {
    const applied = applyWorkspaceHtmlSeo(html, context.request.url);
    const headers = new Headers(res.headers);
    for (const [key, value] of Object.entries(applied.headers)) {
      headers.set(key, value);
    }
    if (!applied.noindex) headers.delete("x-robots-tag");

    if (method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    return new Response(applied.html, { status: 200, headers });
  } catch {
    return new Response(html, { status: res.status, headers: res.headers });
  }
};
