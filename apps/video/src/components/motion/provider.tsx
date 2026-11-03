"use client";

import { type ReactNode, useEffect, useMemo } from "react";
import { LazyMotion, MotionConfig } from "motion/react";

const loadFeatures = () => import(/* webpackChunkName: "studio-motion-features" */ "./features").then((module) => module.default);

export function SiteMotion({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export function MotionFeatures({ children, afterPoster = false }: { children: ReactNode; afterPoster?: boolean }) {
  const gate = useMemo(() => {
    let start = () => {};
    const ready = new Promise<void>((resolve) => { start = resolve; });
    return { start, load: () => ready.then(loadFeatures) };
  }, []);

  useEffect(() => {
    const poster = afterPoster && matchMedia("(max-width: 767px)").matches
      ? document.querySelector<HTMLImageElement>("#conversion-hero img[data-studio-poster]")
      : null;
    if (!poster || navigator.userActivation?.hasBeenActive) {
      gate.start();
      return;
    }
    let active = true;
    let frame = 0;
    let idle = 0;
    let timer = 0;
    const events = new AbortController();
    function clear() {
      active = false;
      events.abort();
      cancelAnimationFrame(frame);
      if (idle) window.cancelIdleCallback(idle);
      if (timer) window.clearTimeout(timer);
    }
    function start() {
      if (!active) return;
      clear();
      gate.start();
    }
    // The tape is usable before Motion loads. A deliberate interaction takes priority.
    const options = { passive: true, capture: true, signal: events.signal };
    window.addEventListener("pointerdown", start, options);
    window.addEventListener("keydown", start, options);
    const afterDecode = () => {
      if (!active) return;
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(start, { timeout: 1200 });
          else timer = window.setTimeout(start, 60);
        });
      });
    };
    // A decoded image still needs a rendering opportunity. Never race it for bandwidth.
    if (typeof poster.decode === "function") void poster.decode().then(afterDecode, afterDecode);
    else if (poster.complete) afterDecode();
    else {
      poster.addEventListener("load", afterDecode, { once: true, signal: events.signal });
      poster.addEventListener("error", afterDecode, { once: true, signal: events.signal });
    }
    return clear;
  }, [afterPoster, gate]);

  return <LazyMotion features={gate.load}>{children}</LazyMotion>;
}
