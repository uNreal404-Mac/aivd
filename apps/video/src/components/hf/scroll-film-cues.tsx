"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import { type RefObject, useCallback, useEffect } from "react";

type Props = {
  film: RefObject<HTMLDivElement | null>;
  onCut: (index: number) => void;
};

export function ScrollFilmCues({ film, onCut }: Props) {
  const { scrollY } = useScroll();
  const selectVisibleTake = useCallback(() => {
    const bounds = film.current?.getBoundingClientRect();
    if (!bounds) return;
    const viewport = window.innerHeight;
    const progress = (0.9 * viewport - bounds.top) / (bounds.height + 0.6 * viewport);
    onCut(progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2);
  }, [film, onCut]);

  useMotionValueEvent(scrollY, "change", selectVisibleTake);
  useEffect(() => {
    selectVisibleTake();
    window.addEventListener("resize", selectVisibleTake);
    return () => window.removeEventListener("resize", selectVisibleTake);
  }, [selectVisibleTake]);
  return null;
}
