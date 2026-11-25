import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOVER_INTENT_MS, bindHoverPlay, releasePlay, syncViewportPlayback, togglePinnedPlay, watchPagePreviews, type HoverScope } from "@/lib/hover-play";

/** A card: an event target with a dataset and one child it "contains". */
function fakeScope() {
  const target = new EventTarget();
  const inside = {} as Node;
  const scope: HoverScope & { inside: Node; fire(type: string, init?: Record<string, unknown>): void } = {
    addEventListener: (type, listener) => target.addEventListener(type, listener),
    removeEventListener: (type, listener) => target.removeEventListener(type, listener),
    contains: (node) => node === inside,
    dataset: {},
    inside,
    fire(type, init = {}) {
      target.dispatchEvent(Object.assign(new Event(type), init));
    },
  };
  return scope;
}

function fakeClip() {
  return {
    paused: true,
    currentTime: 3,
    plays: 0,
    play() {
      this.plays += 1;
      this.paused = false;
      return Promise.resolve();
    },
    pause() {
      this.paused = true;
    },
  };
}

describe("viewport playback", () => {
  it("plays a visible clip and keeps a manual pause when it returns to the viewport", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    syncViewportPlayback(scope, clip, true, true);
    expect(clip.paused).toBe(false);
    syncViewportPlayback(scope, clip, true, true);
    expect(clip.plays).toBe(1);
    togglePinnedPlay(scope, clip);
    syncViewportPlayback(scope, clip, false, true);
    syncViewportPlayback(scope, clip, true, true);
    expect(clip.paused).toBe(true);
    togglePinnedPlay(scope, clip);
    expect(clip.paused).toBe(false);
    syncViewportPlayback(scope, clip, false, true);
    expect(clip.paused).toBe(true);
  });

  it("leaves reduced-motion previews still until played manually, and stops them offscreen", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    syncViewportPlayback(scope, clip, true, false);
    expect(clip.plays).toBe(0);
    togglePinnedPlay(scope, clip);
    expect(clip.paused).toBe(false);
    syncViewportPlayback(scope, clip, false, false);
    syncViewportPlayback(scope, clip, true, false);
    expect(clip.paused).toBe(true);
    expect(clip.plays).toBe(1);
  });

  it("rechecks every mounted document preview once per frame after fast scrolling", () => {
    const win = new EventTarget();
    let frame: FrameRequestCallback | undefined;
    const request = vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; });
    vi.stubGlobal("window", Object.assign(win, { requestAnimationFrame: request, cancelAnimationFrame: vi.fn() }));
    const one = vi.fn();
    const two = vi.fn();
    const stopOne = watchPagePreviews(one);
    const stopTwo = watchPagePreviews(two);
    try {
      win.dispatchEvent(new Event("scroll"));
      win.dispatchEvent(new Event("resize"));
      expect(request).toHaveBeenCalledTimes(1);
      frame?.(0);
      expect(one).toHaveBeenCalledTimes(1);
      expect(two).toHaveBeenCalledTimes(1);
      stopOne();
      win.dispatchEvent(new Event("scroll"));
      frame?.(16);
      expect(one).toHaveBeenCalledTimes(1);
      expect(two).toHaveBeenCalledTimes(2);
      stopTwo();
      win.dispatchEvent(new Event("scroll"));
      expect(request).toHaveBeenCalledTimes(2);
    } finally {
      stopOne();
      stopTwo();
      vi.unstubAllGlobals();
    }
  });
});

describe("hover playback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays while the pointer is on the card and pauses when it leaves", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    bindHoverPlay(scope, clip);

    scope.fire("pointerenter", { pointerType: "mouse" });
    expect(clip.paused).toBe(false);
    scope.fire("pointerleave", { pointerType: "mouse" });
    expect(clip.paused).toBe(true);
    expect(clip.currentTime).toBe(3);
  });

  it("waits for the pointer to rest when a delay is set", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    bindHoverPlay(scope, clip, { delay: HOVER_INTENT_MS });

    // A cursor passing over the card does not start it.
    scope.fire("pointerenter", { pointerType: "mouse" });
    vi.advanceTimersByTime(HOVER_INTENT_MS - 1);
    scope.fire("pointerleave", { pointerType: "mouse" });
    vi.advanceTimersByTime(HOVER_INTENT_MS * 2);
    expect(clip.plays).toBe(0);

    // A cursor that stays does.
    scope.fire("pointerenter", { pointerType: "mouse" });
    vi.advanceTimersByTime(HOVER_INTENT_MS);
    expect(clip.paused).toBe(false);
  });

  it("ignores touch pointers", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    bindHoverPlay(scope, clip);

    scope.fire("pointerenter", { pointerType: "touch" });
    expect(clip.plays).toBe(0);
    clip.paused = false;
    scope.fire("pointerleave", { pointerType: "touch" });
    expect(clip.paused).toBe(false);
  });

  it("plays on keyboard focus and keeps playing while focus moves inside the card", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    bindHoverPlay(scope, clip);

    scope.fire("focusin");
    expect(clip.paused).toBe(false);
    scope.fire("focusout", { relatedTarget: scope.inside });
    expect(clip.paused).toBe(false);
    scope.fire("focusout", { relatedTarget: null });
    expect(clip.paused).toBe(true);
  });

  it("rewinds when asked to", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    bindHoverPlay(scope, clip, { rewind: true });

    scope.fire("pointerenter", { pointerType: "mouse" });
    scope.fire("pointerleave", { pointerType: "mouse" });
    expect(clip.currentTime).toBe(0);
  });

  it("stops listening after cleanup", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    const unbind = bindHoverPlay(scope, clip, { delay: HOVER_INTENT_MS });

    scope.fire("pointerenter", { pointerType: "mouse" });
    unbind();
    vi.advanceTimersByTime(HOVER_INTENT_MS * 2);
    scope.fire("pointerenter", { pointerType: "mouse" });
    vi.advanceTimersByTime(HOVER_INTENT_MS * 2);
    expect(clip.plays).toBe(0);
  });
});

describe("play button", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("pins a clip on so it survives the pointer leaving", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    bindHoverPlay(scope, clip);

    expect(togglePinnedPlay(scope, clip)).toBe(true);
    expect(scope.dataset.videoPinned).toBe("true");
    scope.fire("pointerleave", { pointerType: "mouse" });
    expect(clip.paused).toBe(false);
  });

  it("holds a clip off so hover and focus do not restart it", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    bindHoverPlay(scope, clip, { delay: HOVER_INTENT_MS });

    // Hovering started it; clicking the button focuses the button (which
    // schedules a play) and then pauses.
    scope.fire("pointerenter", { pointerType: "mouse" });
    vi.advanceTimersByTime(HOVER_INTENT_MS);
    scope.fire("focusin");
    expect(togglePinnedPlay(scope, clip)).toBe(false);
    vi.advanceTimersByTime(HOVER_INTENT_MS * 2);
    expect(clip.paused).toBe(true);

    // Leaving the card ends the hold; coming back plays again.
    scope.fire("focusout", { relatedTarget: null });
    scope.fire("pointerleave", { pointerType: "mouse" });
    expect(scope.dataset.videoHold).toBeUndefined();
    scope.fire("pointerenter", { pointerType: "mouse" });
    vi.advanceTimersByTime(HOVER_INTENT_MS);
    expect(clip.paused).toBe(false);
  });

  it("releases a pin when the clip leaves the screen", () => {
    const scope = fakeScope();
    const clip = fakeClip();
    togglePinnedPlay(scope, clip);
    releasePlay(scope, clip);
    expect(clip.paused).toBe(true);
    expect(scope.dataset.videoPinned).toBeUndefined();
  });
});
