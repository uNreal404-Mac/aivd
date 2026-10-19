import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest, NextResponse } from "next/server";
import { isNoIndexEnvironment } from "@/lib/indexing";

const intlMiddleware = createMiddleware(routing);

/**
 * Legacy dashboard redirects
 * Maps old dashboard routes to new routes
 */
const legacyRedirects: Record<string, string> = {
  "/dashboard": "/text-to-video",
  "/dashboard/videos": "/my-creations",
  "/dashboard/billing": "/credits",
  "/dashboard/settings": "/settings",
};

/**
 * Private paths that should never be indexed by search engines,
 * regardless of environment.
 */
const PRIVATE_PATH_SEGMENTS = [
  "/my-creations",
  "/credits",
  "/settings",
  "/admin",
  "/login",
  "/register",
];

/**
 * Determine whether a pathname targets a private route, ignoring an
 * optional leading locale prefix (e.g. /zh/settings -> /settings).
 */
function isPrivatePath(pathname: string): boolean {
  let path = pathname;

  for (const locale of routing.locales) {
    if (path === `/${locale}` || path.startsWith(`/${locale}/`)) {
      path = path.slice(locale.length + 1);
      break;
    }
  }

  if (path === "") {
    path = "/";
  }

  return PRIVATE_PATH_SEGMENTS.some(
    (segment) => path === segment || path.startsWith(`${segment}/`)
  );
}

/**
 * Next-intl middleware with legacy dashboard redirects
 *
 * This middleware handles:
 * - Legacy dashboard route redirects
 * - Locale detection from cookie/headers
 * - URL locale prefix management
 * - Redirects to correct locale
 *
 * URL structure:
 * - English (default): /about, /pricing
 * - Other locales: /zh/about, /ko/pricing
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for legacy dashboard routes (without locale prefix)
  for (const [from, to] of Object.entries(legacyRedirects)) {
    if (pathname === from || pathname.startsWith(from + "/")) {
      // Preserve the rest of the path if any
      const rest = pathname.slice(from.length);
      const url = request.nextUrl.clone();
      url.pathname = to + rest;
      return NextResponse.redirect(url);
    }
  }

  // Check for legacy dashboard routes (with locale prefix)
  // e.g., /en/dashboard -> /en/image-to-video
  for (const locale of routing.locales) {
    for (const [from, to] of Object.entries(legacyRedirects)) {
      const localeFrom = `/${locale}${from}`;
      if (pathname === localeFrom || pathname.startsWith(localeFrom + "/")) {
        const rest = pathname.slice(localeFrom.length);
        const url = request.nextUrl.clone();
        url.pathname = `/${locale}${to}${rest}`;
        return NextResponse.redirect(url);
      }
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    "x-aidv-original-path",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const response = intlMiddleware(
    new NextRequest(request, { headers: requestHeaders }),
  );

  // Add security headers
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains"
  );

  // Prevent indexing in no-index environments and on private routes
  if (isNoIndexEnvironment() || isPrivatePath(pathname)) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  // Basic CSP to start with (adjust as needed for scripts/styles)
  // response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' https:;")

  return response;
}

export const config = {
  // Match all pathnames except for
  // - API routes (handled separately by their route handlers)
  // - _next (Next.js internals)
  // - static files (images, fonts, etc.)
  matcher: [
    // Match all pathnames except those starting with api, _next, or having a file extension
    "/((?!api|_next|.*\\..*).*)",
    // Match root pathname
    "/",
  ],
};
