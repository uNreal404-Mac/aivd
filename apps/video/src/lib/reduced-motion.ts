/**
 * The visitor's "reduce motion" system setting.
 *
 * The site's rule for it: nothing moves by itself. What a visitor asks for
 * still plays (a showcase clip on hover or its play button), and a scroll the
 * page starts goes there at once instead of gliding. The stylesheet side is
 * in styles/motion.css.
 */

export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Whether the visitor asked for reduced motion. False on the server. */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

/**
 * How a scroll that the page starts should move: gliding, or at once for
 * visitors who asked for reduced motion. Pass it as `behavior` to scrollTo,
 * scrollBy and scrollIntoView.
 */
export function scrollMotion(): ScrollBehavior {
  return prefersReducedMotion() ? "instant" : "smooth";
}
