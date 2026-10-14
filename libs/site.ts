/** Production origin used for canonical URLs, sitemap, and robots. */
export const CANONICAL_ORIGIN = "https://dreamutopia-clone.pages.dev";

/** Public HTML routes listed in sitemap.xml (reset is noindex). */
export const PUBLIC_PATHS = [
  "/",
  "/pricing",
  "/workspace",
  "/auth",
  "/privacy",
  "/terms",
  "/image-to-video",
  "/photo-to-video",
  "/free-ai-video",
] as const;
