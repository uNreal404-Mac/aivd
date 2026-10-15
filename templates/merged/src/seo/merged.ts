/**
 * Merged SEO helpers.
 * Base helpers: ../seo/mkfast-seo.ts + mkfast-sitemap.ts
 * Sitemap/robots patterns: seo-site-build-sitemap.ts + seo-site-robots.ts
 */

export type SeoMeta = {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  noIndex?: boolean;
  locale?: string;
  alternates?: Array<{ hrefLang: string; href: string }>;
};

export type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

export function buildSeoMeta(input: SeoMeta): SeoMeta {
  return {
    title: input.title,
    description: input.description,
    canonical: input.canonical,
    ogImage: input.ogImage,
    noIndex: input.noIndex ?? false,
    locale: input.locale ?? "en",
    alternates: input.alternates ?? [],
  };
}

export function renderRobotsTxt(opts: {
  sitemapUrl: string;
  disallow?: string[];
}): string {
  const disallow = (opts.disallow ?? ["/admin", "/api", "/settings"]).map((p) => `Disallow: ${p}`);
  return ["User-agent: *", "Allow: /", ...disallow, `Sitemap: ${opts.sitemapUrl}`, ""].join("\n");
}

export function renderSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries
    .map((e) => {
      const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
      if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
      if (e.changefreq) parts.push(`    <changefreq>${e.changefreq}</changefreq>`);
      if (typeof e.priority === "number") parts.push(`    <priority>${e.priority}</priority>`);
      return `  <url>\n${parts.join("\n")}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Default public marketing routes for the fused template. */
export const defaultPublicRoutes: SitemapEntry[] = [
  { loc: "/", changefreq: "weekly", priority: 1 },
  { loc: "/pricing", changefreq: "weekly", priority: 0.9 },
  { loc: "/blog", changefreq: "daily", priority: 0.7 },
];
