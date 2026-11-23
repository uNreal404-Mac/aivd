"use client";

import { createContext, useContext } from "react";

import { type CanvasCopy, getCopy } from "./copy";

export interface CanvasContextValue {
  locale: string;
  zh: boolean;
  t: CanvasCopy;
  /** Shows a short message at the bottom of the canvas. */
  toast: (message: string) => void;
  /** Called when a generation finished or credits changed. */
  onCreditsChanged: () => void;
}

export const CanvasContext = createContext<CanvasContextValue>({
  locale: "en",
  zh: false,
  t: getCopy("en"),
  toast: () => {},
  onCreditsChanged: () => {},
});

export function useCanvasContext() {
  return useContext(CanvasContext);
}
