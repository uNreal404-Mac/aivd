"use client";

import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePresence } from "@/hooks/use-presence";

/*
 * Open floating layers, oldest first. Escape closes only the newest one, and
 * a click inside a newer layer (a submenu, the voice filter) does not count
 * as a click outside the older ones.
 */
type Layer = { el: () => HTMLElement | null };
const layers: Layer[] = [];

/**
 * Closes a floating layer on Escape (returning focus to what opened it) and
 * on a click outside it, its trigger and any layer opened on top of it.
 */
export function useDismissLayer(
  open: boolean,
  panelRef: RefObject<HTMLElement | null>,
  anchorRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const layer: Layer = { el: () => panelRef.current };
    layers.push(layer);
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || layers[layers.length - 1] !== layer) return;
      event.preventDefault();
      event.stopPropagation();
      closeRef.current();
      anchorRef.current?.focus();
    };
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      const index = layers.indexOf(layer);
      if (layers.slice(index).some((item) => item.el()?.contains(target))) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      const index = layers.indexOf(layer);
      if (index >= 0) layers.splice(index, 1);
    };
  }, [open, panelRef, anchorRef]);
}

type Placement = "side" | "below-end" | "submenu";

/**
 * A floating list for the audio studio.
 *
 * "side" (the model list) opens beside the settings column on wide screens,
 * the way the reference opens its model list, and over the row at the row's
 * width on phones. "below-end" (filters) drops 8px under its button, right
 * edges aligned. "submenu" opens to the left of the menu its row sits in,
 * tops aligned, or over that menu when there is no room. Closes on Escape,
 * on a click outside and when its trigger is pressed again; plays the shared
 * pop in and out.
 */
export function AudioPopover({
  open,
  onClose,
  anchorRef,
  label,
  placement = "side",
  width = 368,
  className = "",
  autoFocus = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  label: string;
  placement?: Placement;
  width?: number;
  className?: string;
  /** Move focus to the chosen entry on open (off for menus whose trigger keeps it). */
  autoFocus?: boolean;
  children: ReactNode;
}) {
  const { mounted, state } = usePresence(open);
  const panelRef = useRef<HTMLDialogElement>(null);
  const [box, setBox] = useState<{ top: number; left: number; width: number; maxHeight: number; origin: string } | null>(null);
  useDismissLayer(open, panelRef, anchorRef, onClose);

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
      if (placement === "submenu") {
        const menu = anchor.closest(".au-pop")?.getBoundingClientRect() ?? r;
        const w = Math.min(width, vw - margin * 2);
        const top = Math.max(margin, Math.min(r.top, vh - margin - natural));
        if (menu.left - 8 - w >= margin) {
          setBox({ top, left: menu.left - 8 - w, width: w, maxHeight: vh - top - margin, origin: "top right" });
        } else {
          // No room beside it (phones): over the menu, at its width.
          setBox({ top: menu.top, left: menu.left, width: menu.width, maxHeight: vh - menu.top - margin, origin: "top center" });
        }
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
    // Placed once per opening (and on resize or scroll): a search narrowing
    // the list shrinks it from the bottom instead of moving it.
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [mounted, anchorRef, placement, width]);

  // Move focus into the list (onto the chosen entry when there is one).
  const placed = box !== null;
  useEffect(() => {
    if (!open || !placed || !autoFocus) return;
    const panel = panelRef.current;
    if (!panel || panel.contains(document.activeElement)) return;
    const target =
      panel.querySelector<HTMLElement>('[aria-selected="true"], [aria-pressed="true"], [aria-checked="true"]') ??
      panel.querySelector<HTMLElement>("button");
    target?.focus({ preventScroll: true });
    target?.scrollIntoView({ block: "nearest" });
  }, [open, placed, autoFocus]);

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
      <div className="au-pop-inner">{children}</div>
    </dialog>,
    document.body,
  );
}
