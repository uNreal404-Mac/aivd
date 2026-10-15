import { examplesHtmlResponse, renderDetailHtml } from "../../libs/examples";
import type { Env } from "../../libs/utils";

/** Server-rendered /examples/{slug} — 404 when the slug is not in the catalog. */
export const onRequestGet: PagesFunction<Env> = async ({ params }) => {
  const slug = String(params.slug || "");
  const html = renderDetailHtml(slug);
  if (!html) {
    return new Response("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  return examplesHtmlResponse(html);
};

export const onRequestHead: PagesFunction<Env> = async ({ params }) => {
  const slug = String(params.slug || "");
  const html = renderDetailHtml(slug);
  if (!html) return new Response(null, { status: 404 });
  const res = examplesHtmlResponse(html);
  return new Response(null, { status: res.status, headers: res.headers });
};
