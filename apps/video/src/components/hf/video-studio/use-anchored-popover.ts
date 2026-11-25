"use client";

import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePresence } from "@/hooks/use-presence";

/** Where a popover sits next to the control that opened it:
 * - "right-end": beside the control, bottom edges aligned (the settings
 *   column's cards open their menus over the stage, as on the reference);
 * - "top-start": above the control, left edges aligned;
 * - "bottom-end": under the control, right edges aligned (the stage's
 *   Filter and View menus).
 * Each falls back to above, then below, when the window is too narrow. */
export type PopoverPlacement = "right-end" | "top-start" | "bottom-end";

const GAP = 8;
const EDGE = 8;

/**
 * A small popover anchored to a control inside the settings column. It is
 * positioned `fixed` from the control's rectangle, so the column's own
 * scrolling never clips it, and follows the control when the column scrolls
 * or the window resizes. It closes on Escape (focus goes back to the control)
 * and on a press anywhere outside it, and plays its exit (data-presence).
 */
export function useAnchoredPopover<A extends HTMLElement = HTMLButtonElement>(
  open: boolean,
  close: () => void,
  placement: PopoverPlacement = "right-end",
) {
  const anchorRef = useRef<A>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const presence = usePresence(open);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useLayoutEffect(() => {
    // While it leaves, the popover keeps its last position.
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const width = popover.offsetWidth;
      const height = popover.offsetHeight;
      const viewWidth = window.innerWidth;
      const viewHeight = window.innerHeight;
      let left: number;
      let top: number;
      if (placement === "right-end" && anchor.right + GAP + width <= viewWidth - EDGE) {
        left = anchor.right + GAP;
        top = anchor.bottom - height;
      } else if (placement === "bottom-end") {
        left = anchor.right - width;
        top = anchor.bottom + GAP;
        if (top + height > viewHeight - EDGE) top = anchor.top - GAP - height;
      } else {
        left = anchor.left;
        top = anchor.top - GAP - height;
        if (top < EDGE) top = anchor.bottom + GAP;
      }
      left = Math.max(EDGE, Math.min(left, viewWidth - width - EDGE));
      top = Math.max(EDGE, Math.min(top, viewHeight - height - EDGE));
      setPosition((current) => (current && current.left === left && current.top === top ? current : { left, top }));
    };
    place();
    const resize = new ResizeObserver(place);
    if (popoverRef.current) resize.observe(popoverRef.current);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      resize.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      closeRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current();
      anchorRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const style: CSSProperties = {
    position: "fixed",
    left: position?.left ?? -9999,
    top: position?.top ?? 0,
  };

  return { anchorRef, popoverRef, mounted: presence.mounted, state: presence.state, style };
}

/** Up and down arrows move between the options of an open menu. */
export function moveFocusWithArrows(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
  const at = items.indexOf(document.activeElement as HTMLButtonElement);
  if (!items.length) return;
  event.preventDefault();
  const next = at === -1 ? 0 : (at + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
}
