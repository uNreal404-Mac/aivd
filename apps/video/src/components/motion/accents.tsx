"use client";

import { m, useReducedMotion } from "motion/react";
import type { PointerEvent, ReactNode } from "react";

export function MotionTitle({ children }: { children: ReactNode }) {
  const reduced = useReducedMotion();
  return <m.h1 id="creator-headline" className="motion-title"
    initial={reduced ? false : { opacity: .86, y: 3, filter: "blur(.8px)" }}
    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ duration: reduced ? 0 : .48, ease: "easeOut" }}>
    {children}
  </m.h1>;
}

// Adapted from David Haz's React Bits SpotlightCard (TS-TW); see SOURCES.md.
export function SpotlightLink({ children, className, href, label }: { children: ReactNode; className: string; href: string; label: string }) {
  const reduced = useReducedMotion();
  function move(event: PointerEvent<HTMLAnchorElement>) {
    if (event.pointerType !== "mouse" || reduced || !matchMedia("(hover:hover) and (pointer:fine)").matches) return;
    const card = event.currentTarget;
    const rect = card.getBoundingClientRect();
    card.style.setProperty("--spot-x", (event.clientX - rect.left) + "px");
    card.style.setProperty("--spot-y", (event.clientY - rect.top) + "px");
  }
  return <m.a href={href} aria-label={label} className={className + " motion-card"}
    onPointerMove={move} initial={reduced ? false : { opacity: .86, y: 4 }}
    whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .18 }}
    transition={{ duration: reduced ? 0 : .38, ease: "easeOut" }}>{children}</m.a>;
}

export function BillingMotion({ yearly }: { yearly: boolean }) {
  const reduced = useReducedMotion();
  return <m.i aria-hidden="true" className="motion-billing-indicator" initial={false}
    animate={{ x: yearly ? "100%" : "0%" }}
    transition={{ duration: reduced ? 0 : .22, ease: "easeInOut" }} />;
}

export function BeamBackdrop() {
  return <svg className="motion-beams" viewBox="0 0 1000 180" preserveAspectRatio="none" fill="none" aria-hidden="true">
    <path d="M-20 148C260 148 334 36 613 36S860 118 1030 77" />
    <path d="M-20 171C244 171 398 61 628 61S854 136 1030 112" />
    <path d="M-20 116C253 116 355 16 603 16S833 90 1030 44" />
  </svg>;
}
