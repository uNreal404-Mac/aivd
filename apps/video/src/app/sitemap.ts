import type { MetadataRoute } from "next";

import { i18n, localeConfig } from "@/config/i18n-config";
import { PUBLIC_ROUTES, type PublicRoute } from "@/config/indexing-paths";
import { HELP_SLUGS } from "@/lib/help-articles";
import { isNoIndexEnvironment } from "@/lib/indexing";
import { INDEXED_LANDING_SLUGS } from "@/lib/model-landing";
import { getLocaleUrl } from "@/lib/seo";

// Built per request: Workers have neither the source tree nor git, so the
// list is written out (config/indexing-paths) and the environment is read at
// run time, never baked in at build time.
export const dynamic = "force-dynamic";

/** Every language version of a page, plus x-default, as hreflang links. */
function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of i18n.locales) {
    languages[localeConfig[locale].hreflang] = getLocaleUrl(path, locale);
  }
  languages["x-default"] = getLocaleUrl(path, i18n.defaultLocale);
  return languages;
}

export default function sitemap(): MetadataRoute.Sitemap {
  if (isNoIndexEnvironment()) {
    return [];
  }

  // Only live models: pages for models that cannot generate yet are noindex.
  const modelRoutes: PublicRoute[] = INDEXED_LANDING_SLUGS.map((slug) => ({
    path: `/models/${slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  // The help centre: its index and one page per question.
  const helpRoutes: PublicRoute[] = [
    { path: "/help", changeFrequency: "monthly", priority: 0.6 },
    ...HELP_SLUGS.map((slug): PublicRoute => ({ path: `/help/${slug}`, changeFrequency: "monthly", priority: 0.5 })),
  ];

  return [...PUBLIC_ROUTES, ...modelRoutes, ...helpRoutes].flatMap((route) => {
    const languages = languageAlternates(route.path);
    return i18n.locales.map((locale) => ({
      url: getLocaleUrl(route.path, locale),
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages },
    }));
  });
}
