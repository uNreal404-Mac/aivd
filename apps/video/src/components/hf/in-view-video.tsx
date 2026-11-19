"use client";

import { useEffect, useRef } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOVER_INTENT_MS, bindHoverPlay, playQuietly, releasePlay } from "@/lib/hover-play";
import { prefersReducedMotion } from "@/lib/reduced-motion";

/**
 * A muted looping showcase clip.
 *
 * Normally it plays while it is on screen. Clips that are scrolled away (or
 * sit off the edge of a carousel) stay paused and fetch only their metadata,
 * so a page full of showcase videos does not download them all at once.
 *
 * For visitors who asked for reduced motion nothing starts by itself: the
 * clip shows a still and plays when they ask for it. Resting the pointer on
 * its card (the nearest `[data-video-scope]`, else its parent) or moving
 * keyboard focus there plays it, and a `VideoPlayToggle` in the same card
 * plays it by click or tap. Large clips such as a full-width hero pass
 * `hoverPlay={false}`: the pointer is over them most of the time, so hover
 * would amount to autoplay, and only the button starts them.
 */
export function InViewVideo({
  src,
  poster,
  className,
  threshold = 0.35,
  hoverPlay = true,
}: {
  src: string;
  poster?: string;
  className?: string;
  /** Share of the clip that must be visible before it plays. */
  threshold?: number;
  /** With reduced motion, whether resting the pointer on the card plays the clip. */
  hoverPlay?: boolean;
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
    if (prefersReducedMotion()) {
      video.pause();
      const scope = video.closest<HTMLElement>("[data-video-scope]") ?? video.parentElement;
      if (!scope) return;
      const unbind = hoverPlay ? bindHoverPlay(scope, video, { delay: HOVER_INTENT_MS }) : undefined;
      // A clip started with the button stops once it is scrolled away.
      const observer =
        typeof IntersectionObserver === "undefined"
          ? undefined
          : new IntersectionObserver(([entry]) => {
              if (!entry.isIntersecting) releasePlay(scope, video);
            });
      observer?.observe(video);
      return () => {
        unbind?.();
        observer?.disconnect();
        releasePlay(scope, video);
      };
    }

    if (typeof IntersectionObserver === "undefined") {
      playQuietly(video);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) playQuietly(video);
        else video.pause();
      },
      { threshold },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [threshold, hoverPlay, reducedMotion]);

  return (
    <video
      ref={ref}
      className={className}
      src={poster ? src : `${src}#t=0.1`}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
    />
  );
}
