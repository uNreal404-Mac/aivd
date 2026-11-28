"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * A sliding highlight for segmented controls and tabs.
 *
 * Put the returned ref on the group and give it the `du-seg` class: one
 * highlight (styles/motion.css, `.du-seg::before`) sits under whichever child
 * has aria-pressed="true" or aria-selected="true" and glides to the next one
 * when the choice changes, so the eye follows where the selection went. It is
 * placed without a transition the first time, so it never slides in from the
 * left edge on page load, and re-measured when the group resizes (fonts,
 * translations, narrow windows).
 */
export function useSegmentIndicator<T extends HTMLElement>(active: unknown) {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const group = ref.current;
    if (!group) return;
    const place = () => {
      const on = group.querySelector<HTMLElement>(':scope > [aria-pressed="true"], :scope > [aria-selected="true"]');
      if (!on) {
        group.style.setProperty("--seg-w", "0px");
        return;
      }
      group.style.setProperty("--seg-x", `${on.offsetLeft}px`);
      group.style.setProperty("--seg-y", `${on.offsetTop}px`);
      group.style.setProperty("--seg-w", `${on.offsetWidth}px`);
      group.style.setProperty("--seg-h", `${on.offsetHeight}px`);
    };
    place();
    let frame = 0;
    if (!("segReady" in group.dataset)) {
      frame = requestAnimationFrame(() => {
        group.dataset.segReady = "";
      });
    }
    const observer = new ResizeObserver(place);
    observer.observe(group);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active]);

  return ref;
}
