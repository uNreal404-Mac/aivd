"use client";

import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "@/hooks/use-presence";

type Placement = "side" | "below-end";

/**
 * A floating list for the audio studio's settings rows.
 *
 * "side" (model and voice lists) opens beside the settings column on wide
 * screens, the way the reference opens its model list, and over the row at
 * the row's width on phones. "below-end" (the history filter) drops under its
 * button, right edges aligned. Closes on Escape, on a click outside and when
 * the page scrolls it away; plays the shared pop in and out.
 */
export function AudioPopover({
  open,
  onClose,
  anchorRef,
  label,
  placement = "side",
  width = 368,
  className = "",
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  placement?: Placement;
  width?: number;
  className?: string;
  children: ReactNode;
}) {
  const { mounted, state } = usePresence(open);
  const panelRef = useRef<HTMLDialogElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number; origin: string } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    if (!mounted) {
      setBox(null);
      return;
    }
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const margin = 12;
      const natural = panel.scrollHeight;
      if (placement === "below-end") {
        const w = Math.min(width, vw - margin * 2);
        const left = Math.max(margin, Math.min(r.right - w, vw - margin - w));
        const top = r.bottom + 8;
        setBox({ top, left, width: w, maxHeight: vh - top - margin, origin: "top right" });
        return;
      }
      if (vw >= 1024) {
        const w = Math.min(width, vw - r.right - 8 - margin);
        const maxHeight = vh - margin * 2;
        const h = Math.min(natural, maxHeight);
        const top = Math.max(margin, Math.min(r.top, vh - margin - h));
        setBox({ top, left: r.right + 8, width: w, maxHeight, origin: "left top" });
        return;
      }
      // Phones and narrow windows: over the row, at its width, on the side
      // with more room.
      const above = r.top - 8 - margin;
      const below = vh - r.bottom - 8 - margin;
      if (above >= Math.min(natural, 280) || above > below) {
        const maxHeight = above;
        const h = Math.min(natural, maxHeight);
        setBox({ top: r.top - 8 - h, left: r.left, width: r.width, maxHeight, origin: "bottom center" });
      } else {
        setBox({ top: r.bottom + 8, left: r.left, width: r.width, maxHeight: below, origin: "top center" });
      }
    };
    place();
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [mounted, anchorRef, placement, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        closeRef.current();
        anchorRef.current?.focus();
      }
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, anchorRef]);

  // Move focus into the list (onto the chosen entry when there is one).
  useEffect(() => {
    if (!open || !box) return;
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    const target = panel.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"]') ?? panel.querySelector<HTMLElement>("button");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [open, box]);

  if (!mounted || typeof document === "undefined") return null;
  return createPortal(
    <dialog
      ref={panelRef}
      open
      aria-label={label}
      data-presence="pop"
      data-state={state}
      className={`au-pop ${className}`}
      style={
        box
          ? { top: box.top, left: box.left, width: box.width, maxHeight: box.maxHeight, transformOrigin: box.origin }
          : { top: 0, left: 0, width, visibility: "hidden" }
      }
    >
      {children}
    </dialog>,
    document.body,
  );
}
