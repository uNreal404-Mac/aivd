import { i18n } from "@/config/i18n-config";

/**
 * Which addresses search engines may list, shared by the sitemap, robots.txt
 * and the middleware's X-Robots-Tag, so the three never disagree.
 */

/** Signed-in, checkout and admin pages, without the locale prefix. */
export const PRIVATE_PATHS = [
  "/my-creations",
  "/credits",
  "/settings",
  "/account",
  "/checkout",
  "/admin",
  "/login",
  "/register",
] as const;

/** The locale prefixes as they appear in URLs: "" for the default language. */
export function localePrefixes(): string[] {
  return i18n.locales.map((locale) => (locale === i18n.defaultLocale ? "" : `/${locale}`));
}

/** robots.txt Disallow lines: every private path under every locale, plus the API. */
export function privateDisallowPaths(): string[] {
  return ["/api/", ...localePrefixes().flatMap((prefix) => PRIVATE_PATHS.map((path) => `${prefix}${path}`))];
}

/** Whether a request path is private, with or without a locale prefix. */
export function isPrivatePath(pathname: string): boolean {
  // Drop a leading locale segment: /zh/settings -> /settings.
  const segments = pathname.split("/");
  const hasLocale = (i18n.locales as readonly string[]).includes(segments[1] ?? "");
  const path = hasLocale ? `/${segments.slice(2).join("/")}` : pathname;
  return PRIVATE_PATHS.some((segment) => path === segment || path.startsWith(`${segment}/`));
}

/**
 * Search and AI crawlers named explicitly. A crawler that finds a group with
 * its own name ignores the "*" group, so each named group repeats the same
 * Disallow list; otherwise the private pages would be open to them.
 */
export const NAMED_CRAWLERS = [
  "Googlebot",
  "Bingbot",
  "OAI-SearchBot",
  "GPTBot",
  "ClaudeBot",
  "PerplexityBot",
  // Robots tokens rather than crawlers: allowing them lets Gemini and Apple's
  // AI features use the public pages.
  "Google-Extended",
  "Applebot-Extended",
] as const;

export type ChangeFrequency = "daily" | "weekly" | "monthly";

export interface PublicRoute {
  /** Path without the locale prefix; "/" for the homepage. */
  path: string;
  changeFrequency: ChangeFrequency;
  priority: number;
}

/**
 * Finished public pages offered in the sitemap. Model pages are added from
 * INDEXED_LANDING_SLUGS. Left out on purpose: old addresses that redirect,
 * /ai/video (the same studio as /text-to-video, canonical points there), and
 * pages waiting for a decision on whether their content is final (/image,
 * /ai/image, /effects, /gallery).
 */
export const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "/video", changeFrequency: "weekly", priority: 0.8 },
  { path: "/text-to-video", changeFrequency: "weekly", priority: 0.8 },
  { path: "/image-to-video", changeFrequency: "weekly", priority: 0.8 },
  { path: "/reference-to-video", changeFrequency: "weekly", priority: 0.8 },
  { path: "/audio", changeFrequency: "weekly", priority: 0.7 },
  { path: "/templates", changeFrequency: "weekly", priority: 0.7 },
  { path: "/creative-space", changeFrequency: "weekly", priority: 0.7 },
  { path: "/about", changeFrequency: "monthly", priority: 0.4 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.3 },
  { path: "/privacy", changeFrequency: "monthly", priority: 0.3 },
  { path: "/terms", changeFrequency: "monthly", priority: 0.3 },
  { path: "/refund-policy", changeFrequency: "monthly", priority: 0.3 },
];
