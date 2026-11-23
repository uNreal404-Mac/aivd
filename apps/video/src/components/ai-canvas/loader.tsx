"use client";

import dynamic from "next/dynamic";

// React Flow measures the DOM, so the canvas renders on the client only.
const AiCanvas = dynamic(() => import("./ai-canvas").then((m) => m.AiCanvas), {
  ssr: false,
  loading: () => <div style={{ flex: 1, background: "var(--du-bg)", minHeight: "calc(100svh - 56px)" }} />,
});

export function AiCanvasLoader({ locale }: { locale: string }) {
  return <AiCanvas locale={locale} />;
}
