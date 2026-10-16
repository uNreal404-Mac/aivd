/**
 * SEO indexing controls
 * Determines whether the current environment should be excluded from search indexing.
 */

export function isNoIndexEnvironment(): boolean {
  return (
    process.env.NEXT_PUBLIC_NOINDEX === "true" ||
    process.env.VERCEL_ENV === "preview"
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
