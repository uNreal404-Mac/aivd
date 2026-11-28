import { i18n } from "@/config/i18n-config";

/**
 * The site path of a page in a language.
 *
 * English, the default language, has no prefix (`/pricing`); every other
 * language does (`/zh/pricing`). `/en/pricing` also answers, but only by
 * redirecting to `/pricing`, so a link written that way costs every visitor
 * and every crawler an extra hop and points away from the canonical address.
 * Build links with this instead of gluing `/${locale}` onto a path.
 *
 * `#section` links are returned as they are.
 */
export function localizedHref(lang: string, href: string): string {
  if (href.startsWith("#")) return href;
  const prefix = lang === i18n.defaultLocale ? "" : `/${lang}`;
  if (href === "" || href === "/") return prefix || "/";
  // The home page with a hash or a query: /zh#pricing, not /zh/#pricing.
  if (prefix && (href.startsWith("/#") || href.startsWith("/?"))) return `${prefix}${href.slice(1)}`;
  return `${prefix}${href}`;
}

/** Preserve the current tool and its settings across a language change. A
 * one-time generation command belongs only to the navigation that created it. */
export function languageSwitchSuffix(search: string, hash: string): string {
  const query = new URLSearchParams(search);
  query.delete("autostart");
  const value = query.toString();
  return (value ? `?${value}` : "") + hash;
}
