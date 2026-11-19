"use client";

import { useEffect } from "react";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import { REVEAL_SELECTOR, bindScrollReveal } from "@/lib/scroll-reveal";

/**
 * Makes the page's sections rise in once as they scroll into view (see
 * lib/scroll-reveal). Renders nothing; put it inside a layout that has such
 * sections, so it starts when they are on the page. Several on one page are
 * fine: a section is only ever taken by one of them.
 *
 * Visitors who asked for reduced motion get the sections as they are.
 */
export function ScrollReveal() {
  // Only here to start or stop when the visitor switches the system setting.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    const sections = document.querySelectorAll<HTMLElement>(REVEAL_SELECTOR);
    return bindScrollReveal(sections, window.innerHeight, (onEnter) => {
      return new IntersectionObserver((entries, observer) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          onEnter(entry.target as HTMLElement);
        }
      });
    });
  }, [reducedMotion]);

  return null;
}
