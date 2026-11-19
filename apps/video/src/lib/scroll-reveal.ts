/**
 * One-time entrance for page sections as they scroll into view.
 *
 * A section that is below the screen when this starts waits there, hidden,
 * and rises in once when any part of it comes into view. A section that is
 * already on screen, or above it, is never touched: nothing a visitor can see
 * gets hidden, and a section resting at the foot of the screen is shown in
 * full instead of half faded. A section passed without being seen (a jump
 * down the page) is shown plainly, so scrolling back up finds it in place.
 * The styles are in styles/motion.css ([data-reveal]);
 * components/scroll-reveal runs this in the browser.
 */

/** The sections that rise in: the blocks of the showcase and pricing layouts. */
export const REVEAL_SELECTOR = ".hs > section, .hs > .hs-usecases, .hp > div";

/** The part of a section element this module uses. */
export type RevealTarget = {
  dataset: Record<string, string | undefined>;
  getBoundingClientRect(): { top: number; bottom: number };
};

/** The part of an IntersectionObserver this module uses. */
export type RevealWatcher<T> = {
  observe(target: T): void;
  disconnect(): void;
};

/**
 * Marks the `targets` below the screen as waiting and reveals each one the
 * first time `watch` reports it in view. Returns the function that stops
 * watching and shows everything again.
 */
export function bindScrollReveal<T extends RevealTarget>(
  targets: Iterable<T>,
  viewportHeight: number,
  /** Makes the watcher, which calls `onEnter` when a watched target comes into view. */
  watch: (onEnter: (target: T) => void) => RevealWatcher<T>,
): () => void {
  const waiting = new Set<T>();
  const mine: T[] = [];

  const watcher = watch((target) => {
    // Once only: later reports for the same section change nothing.
    if (!waiting.delete(target)) return;
    target.dataset.reveal = "in";
    // A jump down the page (a link, the End key) passes sections without
    // ever showing them. Those are above the screen now: show them plainly.
    for (const passed of waiting) {
      if (passed.getBoundingClientRect().bottom > 0) continue;
      waiting.delete(passed);
      delete passed.dataset.reveal;
    }
  });

  for (const target of targets) {
    // Marked already: another part of the page has it.
    if (target.dataset.reveal) continue;
    // On screen or above it: leave it as it is.
    if (target.getBoundingClientRect().top < viewportHeight) continue;
    target.dataset.reveal = "wait";
    waiting.add(target);
    mine.push(target);
    watcher.observe(target);
  }

  return () => {
    watcher.disconnect();
    waiting.clear();
    for (const target of mine) delete target.dataset.reveal;
  };
}
