import { i18n, localeConfig, type Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (trimmed === "" || trimmed === "/") {
    return "";
  }
  const normalized = trimmed.replace(/^\/+/, "").replace(/\/+$/, "");
  return `/${normalized}`;
}

export function getLocaleUrl(pathname: string, locale: Locale): string {
  const normalizedPath = normalizePathname(pathname);
  const prefix = locale === i18n.defaultLocale ? "" : `/${locale}`;
  return `${siteConfig.url}${prefix}${normalizedPath}`;
}

export function buildAlternates(pathname: string, locale: Locale) {
  const languages = Object.fromEntries(
    i18n.locales.map((loc) => [localeConfig[loc].hreflang, getLocaleUrl(pathname, loc)])
  );
  languages["x-default"] = getLocaleUrl(pathname, i18n.defaultLocale);

  return {
    canonical: getLocaleUrl(pathname, locale),
    languages,
  };
}

export function resolveOgImage(fallback?: string): string | undefined {
  const ogImage = siteConfig.ogImage || fallback;
  return ogImage || undefined;
}

/** Open Graph locale tags (en_US / zh_CN) for a page, with the other language as alternate. */
export function openGraphLocale(locale: string): { locale: string; alternateLocale: string[] } {
  const toOg = (loc: string) => (loc.toLowerCase().startsWith("zh") ? "zh_CN" : "en_US");
  const current = toOg(locale);
  const others = [...new Set(i18n.locales.map(toOg))].filter((tag) => tag !== current);
  return { locale: current, alternateLocale: others };
}

/**
 * The site-wide share image. A page that sets its own openGraph replaces the
 * layout's openGraph as a whole, images included, so such pages add this.
 */
export function defaultShareImages(alt = siteConfig.name) {
  const url = resolveOgImage();
  return url ? [{ url, width: 1200, height: 630, alt }] : [];
}
