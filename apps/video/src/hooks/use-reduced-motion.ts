"use client";

import { useSyncExternalStore } from "react";

import { REDUCED_MOTION_QUERY } from "@/lib/reduced-motion";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener?.("change", onChange);
  return () => query.removeEventListener?.("change", onChange);
}

/**
 * Whether the visitor asked the system for reduced motion. Follows the
 * setting live, so switching it while a page is open takes effect at once.
 * The server (and the first client render) assume it is off; effects that
 * must not start motion should also check `prefersReducedMotion()` when they
 * run rather than trust the first render.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}
