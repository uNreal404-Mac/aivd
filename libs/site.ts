/** Production origin used for canonical URLs, sitemap, and robots. */
export const CANONICAL_ORIGIN = "https://dreamutopia-clone.pages.dev";

/** Stripe Checkout metadata.site — ignore events from other products on the same Stripe account. */
export const PAYMENT_SITE = "dreamutopia";

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
  "/business",
] as const;
