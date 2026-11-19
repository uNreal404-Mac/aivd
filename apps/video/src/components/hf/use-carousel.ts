"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

import { scrollMotion } from "@/lib/reduced-motion";

/**
 * Arrows for a horizontally scrolling row of cards. Each step lands on a card
 * edge (so scroll-snap does not fight it), and the arrows know when the row is
 * at either end. Reduced motion jumps instead of gliding.
 */
export function useCarousel(
  trackRef: RefObject<HTMLElement | null>,
  /** Change this when the row is mounted again (e.g. after a search is cleared). */
  mountKey?: unknown,
) {
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanPrev(track.scrollLeft > 4);
    setCanNext(track.scrollLeft + track.clientWidth < track.scrollWidth - 4);
  }, [trackRef]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    update();
    track.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(track);
    return () => {
      track.removeEventListener("scroll", update);
      observer.disconnect();
    };
    // mountKey re-attaches the listeners to a freshly mounted row.
  }, [trackRef, update, mountKey]);

  const step = (direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const cards = [...track.children] as HTMLElement[];
    const view = track.getBoundingClientRect();
    const start = track.scrollLeft;
    let target = start;
    if (direction === 1) {
      // The first card that is not fully in view moves to the left edge.
      const next = cards.find((card) => card.getBoundingClientRect().right > view.right + 1);
      target = next ? start + next.getBoundingClientRect().left - view.left : track.scrollWidth;
    } else {
      // Go back by about one view, to the card edge at or before it.
      const goal = start - track.clientWidth;
      const previous = cards.filter((card) => start + card.getBoundingClientRect().left - view.left <= goal + 1).pop();
      target = previous ? start + previous.getBoundingClientRect().left - view.left : 0;
    }
    track.scrollTo({ left: Math.max(0, target), behavior: scrollMotion() });
  };

  return { canPrev, canNext, step };
}
