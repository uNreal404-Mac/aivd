"use client";

import { m, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

export function MotionTitle({ children }: { children: ReactNode }) {
  return <h1 id="creator-headline" className="motion-title">{children}</h1>;
}

export function BillingMotion({ yearly }: { yearly: boolean }) {
  const reduced = useReducedMotion();
  return <m.i aria-hidden="true" className="motion-billing-indicator" initial={false}
    animate={{ x: yearly ? "100%" : "0%" }}
    transition={{ duration: reduced ? 0 : .22, ease: "easeInOut" }} />;
}
