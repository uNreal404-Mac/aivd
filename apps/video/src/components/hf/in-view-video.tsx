"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOVER_INTENT_MS, bindHoverPlay, syncViewportPlayback, watchPagePreviews } from "@/lib/hover-play";
import { prefersReducedMotion } from "@/lib/reduced-motion";

/**
 * A muted looping showcase clip.
 *
 * Viewport previews pause offscreen and in background tabs. When a poster is
 * available it is enough to paint the frame before playback starts.
 *
 * For visitors who asked for reduced motion nothing starts by itself: the
 * clip shows a still and plays when they ask for it. Resting the pointer on
 * its card (the nearest `[data-video-scope]`, else its parent) or moving
 * keyboard focus there plays it. A card may also offer `VideoPlayToggle`.
 */
export function InViewVideo({
  src,
  poster,
  className,
  threshold = 0.35,
  hoverPlay = true,
  playback = "viewport",
  documentGallery = false,
}: {
  src: string;
  poster?: string;
  className?: string;
  /** Share of the clip that must be visible before it plays. */
  threshold?: number;
  /** With reduced motion, whether resting the pointer on the card plays the clip. */
  hoverPlay?: boolean;
  playback?: "viewport" | "hover";
  /** These cards scroll in the document, with no inner clipping container. */
  documentGallery?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  // Only here to re-run the effect when the visitor switches the system
  // setting; the effect reads the setting itself when it runs.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const video = ref.current;
    if (!video) return;

    // Read the setting now rather than trust the first render, which assumes
    // it is off and would start the clip for a moment.
    const reduced = prefersReducedMotion();
    const scope = video.closest<HTMLElement>("[data-video-scope]") ?? video.parentElement;
    if (!scope) return;
    if (playback === "hover") {
      return bindHoverPlay(scope, video, { delay: reduced ? HOVER_INTENT_MS : 0 });
    }
    if (reduced) video.pause();
    const unbind = reduced && hoverPlay ? bindHoverPlay(scope, video, { delay: HOVER_INTENT_MS }) : undefined;
    let inView = typeof IntersectionObserver === "undefined";
    const sync = () => syncViewportPlayback(scope, video, inView && !document.hidden, !reduced);
    const checkPosition = () => {
      const r = video.getBoundingClientRect();
      const width = Math.max(0, Math.min(innerWidth, r.right) - Math.max(0, r.left));
      const height = Math.max(0, Math.min(innerHeight, r.bottom) - Math.max(0, r.top));
      inView = width * height > 0 && width * height >= r.width * r.height * threshold;
      sync();
    };
    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => {
      if (documentGallery) { checkPosition(); return; }
      inView = entry.isIntersecting && entry.intersectionRatio >= threshold;
      sync();
    }, { threshold });
    const unwatch = documentGallery ? watchPagePreviews(checkPosition) : undefined;
    observer?.observe(video);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", sync);
      unwatch?.();
      unbind?.();
      video.pause();
    };
  }, [threshold, hoverPlay, reducedMotion, playback, src, documentGallery]);

  return (
    <video
      ref={ref}
      className={className}
      src={poster || playback === "hover" ? src : `${src}#t=0.1`}
      poster={poster}
      muted
      loop
      playsInline
      preload={poster || playback === "hover" ? "none" : "metadata"}
    />
  );
}
