/**
 * Hover and focus playback for a showcase clip, shared by the wall cards, the
 * carousel slides and the gallery thumbnails.
 *
 * Nothing here starts a clip by itself. A clip plays while the pointer rests
 * on its card or the card holds keyboard focus, and stops when both are gone.
 * The play button (components/hf/video-play-toggle) talks to the same card
 * through two data attributes:
 *
 *   data-video-pinned  the clip was started with the button and keeps playing
 *                      after the pointer leaves;
 *   data-video-hold    the clip was paused with the button and stays paused
 *                      until the pointer and focus have left the card.
 *
 * Touch pointers are ignored: a tap is not a hover.
 */

/**
 * With reduced motion a clip waits this long before it plays, so a cursor
 * passing over a wall of cards does not set them off one after another.
 */
export const HOVER_INTENT_MS = 180;

/** The part of a card element this module uses. */
export type HoverScope = {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  contains(node: Node | null): boolean;
  dataset: Record<string, string | undefined>;
};

/** The part of a video element this module uses. */
export type HoverClip = {
  play(): Promise<void> | void;
  pause(): void;
  currentTime: number;
};

export function playQuietly(clip: Pick<HoverClip, "play">): void {
  try {
    const started = clip.play();
    // Autoplay rules or a quick pause can reject the promise; neither matters here.
    if (started && typeof started.catch === "function") started.catch(() => undefined);
  } catch {
    // Older browsers throw instead of rejecting.
  }
}

/**
 * Plays `clip` while `scope` is hovered or focused. Returns the function that
 * removes the listeners again.
 */
export function bindHoverPlay(
  scope: HoverScope,
  clip: HoverClip,
  options: {
    /** Wait before playing (ms); 0 plays at once. */
    delay?: number;
    /** Go back to the first frame when the clip stops. */
    rewind?: boolean;
  } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const start = () => {
    if (timer !== undefined) clearTimeout(timer);
    const go = () => {
      timer = undefined;
      if (scope.dataset.videoHold === "true") return;
      playQuietly(clip);
    };
    if (options.delay) timer = setTimeout(go, options.delay);
    else go();
  };

  const stop = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    delete scope.dataset.videoHold;
    if (scope.dataset.videoPinned === "true") return;
    clip.pause();
    if (options.rewind) {
      try {
        clip.currentTime = 0;
      } catch {
        // Seeking can fail before metadata is ready; nothing to clean up.
      }
    }
  };

  const isTouch = (event: Event) => (event as PointerEvent).pointerType === "touch";
  const onEnter = (event: Event) => {
    if (!isTouch(event)) start();
  };
  const onLeave = (event: Event) => {
    if (!isTouch(event)) stop();
  };
  const onFocusIn = () => start();
  const onFocusOut = (event: Event) => {
    // Focus moving between the card's own link and button is not leaving.
    const next = (event as FocusEvent).relatedTarget as Node | null;
    if (next && scope.contains(next)) return;
    stop();
  };

  scope.addEventListener("pointerenter", onEnter);
  scope.addEventListener("pointerleave", onLeave);
  scope.addEventListener("focusin", onFocusIn);
  scope.addEventListener("focusout", onFocusOut);

  return () => {
    if (timer !== undefined) clearTimeout(timer);
    scope.removeEventListener("pointerenter", onEnter);
    scope.removeEventListener("pointerleave", onLeave);
    scope.removeEventListener("focusin", onFocusIn);
    scope.removeEventListener("focusout", onFocusOut);
  };
}

/**
 * What the play button does: start the clip and pin it on, or pause it and
 * hold it off. Returns true when the clip is now playing.
 */
export function togglePinnedPlay(scope: Pick<HoverScope, "dataset">, clip: Pick<HoverClip, "play" | "pause"> & { paused: boolean }): boolean {
  if (clip.paused) {
    delete scope.dataset.videoHold;
    scope.dataset.videoPinned = "true";
    playQuietly(clip);
    return true;
  }
  delete scope.dataset.videoPinned;
  scope.dataset.videoHold = "true";
  clip.pause();
  return false;
}

/** Forget a pin or hold, e.g. when the clip scrolls out of view. */
export function releasePlay(scope: Pick<HoverScope, "dataset">, clip: Pick<HoverClip, "pause">): void {
  delete scope.dataset.videoPinned;
  delete scope.dataset.videoHold;
  clip.pause();
}
