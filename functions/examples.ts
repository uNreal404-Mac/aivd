import { examplesHtmlResponse, renderListHtml } from "../libs/examples";
import type { Env } from "../libs/utils";

/** Server-rendered /examples index — HTML in the first response. */
export const onRequestGet: PagesFunction<Env> = async () => {
  return examplesHtmlResponse(renderListHtml());
};

export const onRequestHead: PagesFunction<Env> = async () => {
  const res = examplesHtmlResponse(renderListHtml());
  return new Response(null, { status: res.status, headers: res.headers });
};
