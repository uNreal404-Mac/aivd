"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/reduced-motion";

/** How long a closing element stays mounted: the exit animation (--m-fast)
 * plus a frame of slack. Kept in step with styles/motion.css. */
export const PRESENCE_EXIT_MS = 200;

export type PresenceState = "open" | "closed";

/**
 * Keeps something on screen long enough to animate out.
 *
 * Components that render a popover, menu or dialog only while `open` would
 * make it vanish in a single frame. Render while `mounted` instead and put
 * `data-state={state}` on the element (with a `data-presence` kind or a class
 * styled in motion.css): it plays its exit, then unmounts. Opening again while
 * it is still leaving simply turns it back around, so a quick second click is
 * never lost. With reduced motion it unmounts at once.
 */
export function usePresence(open: boolean, exitMs = PRESENCE_EXIT_MS): { mounted: boolean; state: PresenceState } {
  const [mounted, setMounted] = useState(open);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (open) {
      setMounted(true);
      return;
    }
    if (prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      setMounted(false);
    }, exitMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, exitMs]);

  return { mounted: open || mounted, state: open ? "open" : "closed" };
}
