/**
 * Apple-style frosted glass class helpers.
 *
 * Primary CTAs stay solid `var(--du-accent)` with `var(--du-on-accent)` text so
 * they keep maximum contrast against imagery. Secondary buttons and
 * example/content cards instead use the translucent glass treatment below.
 */

export const GLASS_CARD = "du-glass";
export const GLASS_BUTTON = "du-glass-btn";
export const GLASS_ROUND = "du-glass-round";
export const GLASS_ON_MEDIA = "du-glass-on-media";

const VARIANTS = {
  card: GLASS_CARD,
  button: GLASS_BUTTON,
  "media-button": `${GLASS_BUTTON} ${GLASS_ON_MEDIA}`,
} as const;

/**
 * Returns the classes for a glass variant, followed by any truthy extras,
 * joined by a single space.
 */
export function glass(
  variant: "card" | "button" | "media-button",
  ...extra: Array<string | false | null | undefined>
): string {
  return [VARIANTS[variant], ...extra.filter(Boolean)].join(" ");
}
