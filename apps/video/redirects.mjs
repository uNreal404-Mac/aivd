// @ts-check

// Old addresses and their one canonical replacement. Each is answered with a
// 301 straight from the routing layer, in one hop, for the unprefixed English
// path and the /zh path. Exact matches only: /explore must not catch the
// sample pictures under public/explore/.
const LEGACY_PATHS = [
  ["/seedance-1-5", "/models/seedance-1-5-pro"],
  ["/sora-2", "/models/sora-2"],
  ["/veo-3-1", "/models/veo-3-1"],
  ["/wan-2-6", "/models/wan-2-6"],
  ["/privacy-policy", "/privacy"],
  ["/terms-of-service", "/terms"],
  ["/explore", "/templates"],
];

/** Locales that carry a URL prefix (every one but the default, English). */
const PREFIXED_LOCALES = ["zh"];

export function legacyRedirects() {
  return [
    ...LEGACY_PATHS.flatMap(([from, to]) => [
      { source: from, destination: to, statusCode: 301 },
      ...PREFIXED_LOCALES.map((locale) => ({
        source: `/${locale}${from}`,
        destination: `/${locale}${to}`,
        statusCode: 301,
      })),
    ]),
    // English has no prefix, so /en/... is a duplicate of the unprefixed page.
    { source: "/en", destination: "/", statusCode: 301 },
    { source: "/en/:path*", destination: "/:path*", statusCode: 301 },
  ];
}
