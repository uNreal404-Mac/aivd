"use client";

import { useMotionValueEvent, useScroll } from "motion/react";
import type { RefObject } from "react";

type Props = {
  film: RefObject<HTMLDivElement | null>;
  onCut: (index: number) => void;
};

export function ScrollFilmCues({ film, onCut }: Props) {
  const { scrollYProgress } = useScroll({
    target: film,
    offset: ["start 90%", "end 30%"],
  });
  useMotionValueEvent(scrollYProgress, "change", progress => {
    onCut(progress < 1 / 3 ? 0 : progress < 2 / 3 ? 1 : 2);
  });
  return null;
}
