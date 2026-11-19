"use client";

import { useEffect, useRef } from "react";

/**
 * A muted looping clip that only plays while it is on screen. Clips that are
 * scrolled away (or sit off the edge of a carousel) stay paused and fetch
 * only their metadata, so a page full of showcase videos does not download
 * them all at once. Visitors who ask for reduced motion see the first frame.
 */
export function InViewVideo({
  src,
  poster,
  className,
  threshold = 0.35,
}: {
  src: string;
  poster?: string;
  className?: string;
  /** Share of the clip that must be visible before it plays. */
  threshold?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (typeof IntersectionObserver === "undefined") {
      void video.play().catch(() => undefined);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [threshold]);

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
