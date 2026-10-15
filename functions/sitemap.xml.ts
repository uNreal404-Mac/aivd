import { exampleDetailPaths } from "../libs/examples";
import { CANONICAL_ORIGIN, PUBLIC_PATHS } from "../libs/site";
import type { Env } from "../libs/utils";

export const onRequestGet: PagesFunction<Env> = async () => {
  const paths = [...PUBLIC_PATHS, ...exampleDetailPaths()];
  const urls = paths.map(
    (path) =>
      `  <url><loc>${CANONICAL_ORIGIN}${path}</loc><changefreq>${path === "/" ? "daily" : "weekly"}</changefreq></url>`
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
