import { examplesHtmlResponse, renderListHtml } from "../libs/examples";
import type { Env } from "../libs/utils";

/**
 * Server-rendered /examples index — HTML in the first response.
 * Wrangler rejects overlapping `/examples` and `/examples/*` include rules,
 * so the list is also written to out/examples.html (same renderer).
 */
export const onRequestGet: PagesFunction<Env> = async () => {
  return examplesHtmlResponse(renderListHtml());
};

export const onRequestHead: PagesFunction<Env> = async () => {
  const res = examplesHtmlResponse(renderListHtml());
  return new Response(null, { status: res.status, headers: res.headers });
};
