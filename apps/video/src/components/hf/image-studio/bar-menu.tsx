"use client";

// Small popovers that open from the image studio's creation bar (ratio,
// resolution, @ references) and from the view button above the results.
// They grow out of the control that opened them, close on an outside press or
// Escape (focus goes back to the control), a second press on the control, or a
// choice, and move with the arrow keys.
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { Check } from "lucide-react";
import { usePresence } from "@/hooks/use-presence";

/**
 * A short dark label above a control, shown on hover (after a moment) or on
 * keyboard focus, and hidden while the control's own menu is open. The
 * control should point at it with aria-describedby={id}.
 */
export function Tip({ id, text, children }: { id: string; text: string; children: ReactNode }) {
  return (
    <span className="is-tipped">
      {children}
      <span id={id} role="tooltip" className="is-tip">
        {text}
      </span>
    </span>
  );
}

/** Close on a press outside `wrapRef` or on Escape. */
export function useDismiss(open: boolean, close: (refocus: boolean) => void, wrapRef: RefObject<HTMLElement | null>) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) closeRef.current(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      closeRef.current(true);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, wrapRef]);
}

/** ↑/↓ (and Home/End) move between the menu's items. */
export function moveFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-menu-item]:not(:disabled)")];
  if (!items.length) return;
  event.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? Math.min(items.length - 1, at + 1) : Math.max(0, at - 1);
  items[next]?.focus();
}

export type BarOption = { value: string; label: string; sub?: string; icon?: ReactNode };

/**
 * A chip in the creation bar that opens a list of choices: a small title, one
 * row per choice, a check on the chosen one. The list opens above the chip, or
 * beside it (bottom edges level) for the two-line resolution rows, as on the
 * reference. With a single choice it is a plain value that explains itself on
 * hover.
 */
export function BarSelect({
  id,
  title,
  icon,
  value,
  options,
  onChange,
  wide = false,
  side = "top",
  fixedNote,
}: {
  /** Stable id prefix for the hover label of a fixed value. */
  id: string;
  title: string;
  icon: ReactNode;
  value: string;
  options: BarOption[];
  onChange: (value: string) => void;
  /** Rows with a second line (resolution) get the wider menu. */
  wide?: boolean;
  /** Where the list opens on wider screens; phones always open it above. */
  side?: "top" | "right";
  /** Hover text when the model allows only one choice. */
  fixedNote: string;
}) {
  const [open, setOpen] = useState(false);
  const presence = usePresence(open);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = options.find((option) => option.value === value) ?? options[0];
  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  };
  useDismiss(open, close, wrapRef);

  // Opening puts focus on the chosen row, so ↑/↓ start from there.
  useEffect(() => {
    if (!open) return;
    const chosen = menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]') ?? menuRef.current?.querySelector<HTMLElement>("[data-menu-item]");
    chosen?.focus({ preventScroll: true });
  }, [open]);

  if (options.length <= 1) {
    return (
      <Tip id={`${id}-tip`} text={fixedNote}>
        <span className="is-chip is-chip-fixed" aria-describedby={`${id}-tip`}>
          {current?.icon ?? icon}
          <span>{current?.label}</span>
        </span>
      </Tip>
    );
  }

  return (
    <span ref={wrapRef} className="is-pop-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="is-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${title}: ${current?.label ?? ""}`}
        onClick={() => setOpen((was) => !was)}
      >
        {current?.icon ?? icon}
        <span>{current?.label}</span>
      </button>
      {presence.mounted ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={title}
          data-presence="pop"
          data-state={presence.state}
          className={`is-pop${wide ? " is-pop-wide" : ""}${side === "right" ? " is-pop-right" : ""}`}
          onKeyDown={moveFocus}
        >
          <p className="is-pop-title">{title}</p>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              data-menu-item
              className={option.sub ? "is-pop-item is-pop-item-two" : "is-pop-item"}
              onClick={() => {
                onChange(option.value);
                close(true);
              }}
            >
              {option.icon ? <span className="is-pop-icon">{option.icon}</span> : null}
              <span className="is-pop-text">
                <span className="is-pop-label">{option.label}</span>
                {option.sub ? <span className="is-pop-sub">{option.sub}</span> : null}
              </span>
              {option.value === value ? <Check className="is-pop-check" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

/** The outline of an aspect ratio, drawn to scale inside a 20px square. */
export function RatioIcon({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) return null;
  const long = 16;
  const width = w >= h ? long : Math.max(7, Math.round((long * w) / h));
  const height = h >= w ? long : Math.max(7, Math.round((long * h) / w));
  return (
    <span className="is-ratio" aria-hidden="true">
      <span style={{ width, height }} />
    </span>
  );
}
