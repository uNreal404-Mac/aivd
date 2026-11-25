"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Phase = "idle" | "loading" | "done";

/**
 * A thin bar along the top while the next page loads, so a click on a link
 * always shows that something is happening. App Router has no route events:
 * the bar starts on a click on an internal link and finishes when the URL
 * changes. Quick navigations finish before the short delay and show nothing.
 */
function RouteProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("idle");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clear = () => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== "_self") return;
      if (link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page (or only the #hash changes): nothing to load.
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      clear();
      timers.current.push(setTimeout(() => setPhase("loading"), 120));
      // Never leave the bar hanging if the navigation is abandoned.
      timers.current.push(setTimeout(() => setPhase("idle"), 12000));
    };
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      clear();
    };
  }, []);

  // The URL changed: the new page is in. searchParams is a dependency on purpose.
  useEffect(() => {
    clear();
    setPhase((current) => (current === "loading" ? "done" : "idle"));
  }, [pathname, searchParams]);

  useEffect(() => {
    if (phase !== "done") return;
    const timer = setTimeout(() => setPhase("idle"), 400);
    return () => clearTimeout(timer);
  }, [phase]);

  if (phase === "idle") return null;
  return <div className="route-progress" data-phase={phase} aria-hidden="true" />;
}

export function RouteProgress() {
  return (
    <Suspense fallback={null}>
      <RouteProgressBar />
    </Suspense>
  );
}
