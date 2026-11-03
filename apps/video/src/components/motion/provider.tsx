"use client";
import type { ReactNode } from "react";
import { LazyMotion, MotionConfig } from "motion/react";

const features = () => import("./features").then((module) => module.default);

export function SiteMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user"><LazyMotion features={features}>{children}</LazyMotion></MotionConfig>;
}
