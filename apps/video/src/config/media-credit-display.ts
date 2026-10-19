/**
 * Display-only credit prices for image and music generation on /pricing.
 * Mirrors src/config/media-pricing.ts on feat/kie-image-music (nano-banana = 3,
 * Suno V6 = 9 per request with 2 tracks). Once that branch is merged, import the
 * values from media-pricing instead of duplicating them.
 */
export const IMAGE_CREDITS_PER_IMAGE = 3;
export const MUSIC_CREDITS_PER_REQUEST = 9;
export const MUSIC_TRACKS_PER_REQUEST = 2;
