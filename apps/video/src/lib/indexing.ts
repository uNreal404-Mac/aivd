/**
 * SEO indexing controls
 * Determines whether the current environment should be excluded from search indexing.
 */

export function isNoIndexEnvironment(): boolean {
  // Read from a local reference with a dynamic key lookup so Next.js does not
  // statically inline `process.env.NEXT_PUBLIC_*` values at build time. This
  // keeps preview-deploy noindex detection working with runtime-only vars.
  const env = process.env;
  const read = (k: string) => env[k];

  return (
    read("NEXT_PUBLIC_NOINDEX") === "true" ||
    read("NOINDEX") === "true" ||
    read("VERCEL_ENV") === "preview" ||
    read("NEXT_PUBLIC_DEPLOY_ENV") === "preview"
  );
}

export const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
  },
} as const;

/**
 * Pages that work but whose content is not final (/image, /ai/image,
 * /effects, /gallery): kept out of search until they are, while the links on
 * them are still followed. When one is ready, drop this and add it to
 * PUBLIC_ROUTES.
 */
export const DRAFT_ROBOTS = { index: false, follow: true } as const;
