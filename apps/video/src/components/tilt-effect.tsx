"use client";

import { useEffect } from "react";

/**
 * Pointer tilt for elements marked with data-tilt: one delegated listener
 * writes --tilt-x / --tilt-y (-1..1) on the hovered card, and motion.css turns
 * them into a slight 3D lean. Skipped for touch input and reduced motion.
 */
export function TiltEffect() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current: HTMLElement | null = null;
    let frame = 0;

    const reset = (element: HTMLElement | null) => {
      element?.style.removeProperty("--tilt-x");
      element?.style.removeProperty("--tilt-y");
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest?.("[data-tilt]") as HTMLElement | null;
      if (target !== current) {
        reset(current);
        current = target;
      }
      if (!target) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
        target.style.setProperty("--tilt-x", x.toFixed(3));
        target.style.setProperty("--tilt-y", y.toFixed(3));
      });
    };

    const onLeave = () => {
      reset(current);
      current = null;
    };

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return null;
}
