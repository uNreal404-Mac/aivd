/** Canonical public origin — sitemap, OG, and SEO pages share this. */
export const SITE_ORIGIN = "https://dreamutopia-clone.pages.dev";

export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${SITE_ORIGIN}${p}`;
}
