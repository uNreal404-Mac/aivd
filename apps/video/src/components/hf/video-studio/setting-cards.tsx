"use client";

import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { Check, ChevronRight } from "lucide-react";
import { moveFocusWithArrows, useAnchoredPopover } from "./use-anchored-popover";

/** The face of a settings card: a small label over the current value. */
export function CardFace({ label, value, chevron }: { label: string; value: ReactNode; chevron: boolean }) {
  return (
    <>
      <span className="vst-card-text">
        <span className="vst-card-label">{label}</span>
        <span className="vst-card-value">{value}</span>
      </span>
      {chevron ? <ChevronRight className="vst-card-chevron" aria-hidden="true" /> : null}
    </>
  );
}

/** Aspect ratios from the widest frame to the tallest, the order the
 * reference lists them in (21:9, 16:9, 4:3, 1:1, 3:4, 9:16). */
export function widestFirst(ratios: readonly string[]): string[] {
  const value = (ratio: string) => {
    const [width, height] = ratio.split(":").map(Number);
    return width && height ? width / height : 0;
  };
  return [...ratios].sort((a, b) => value(b) - value(a));
}

/** Focus the chosen option when a menu opens, so arrows start from it. */
function useFocusChosen(open: boolean, popover: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target =
        popover.current?.querySelector<HTMLElement>('[aria-checked="true"]') ??
        popover.current?.querySelector<HTMLElement>("button, input");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, popover]);
}

/** One row of a settings menu: the value, and a check on the chosen one. */
function MenuOption({ label, chosen, onChoose }: { label: string; chosen: boolean; onChoose: () => void }) {
  return (
    <button type="button" role="menuitemradio" aria-checked={chosen} className="vst-menu-item" onClick={onChoose}>
      <span className="du-num">{label}</span>
      {chosen ? <Check className="vst-menu-check" aria-hidden="true" /> : null}
    </button>
  );
}

/**
 * A settings card that opens a short list of choices beside it (ratio,
 * resolution, a few fixed lengths). With a single choice the model fixes the
 * value: the card still opens, and says so in words instead of a list.
 */
export function ChoiceCard<T extends string | number>({
  label,
  value,
  options,
  format,
  onChange,
  fixedNote,
  className = "",
}: {
  label: string;
  value: T;
  options: readonly T[];
  format?: (option: T) => string;
  onChange: (option: T) => void;
  /** Why there is nothing to choose, shown when the model offers one value. */
  fixedNote: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const popover = useAnchoredPopover<HTMLButtonElement>(open, () => setOpen(false));
  useFocusChosen(open, popover.popoverRef);
  const show = format ?? ((option: T) => String(option));
  const fixed = options.length <= 1;

  return (
    <>
      <button
        ref={popover.anchorRef}
        type="button"
        className={`vst-card vst-card-button ${fixed ? "vst-card-fixed" : ""} ${className}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <CardFace label={label} value={show(value)} chevron={!fixed} />
      </button>
      {popover.mounted ? (
        <div
          ref={popover.popoverRef}
          style={popover.style}
          role="menu"
          data-presence="pop"
          data-state={popover.state}
          className="vst-menu"
          aria-label={label}
          onKeyDown={moveFocusWithArrows}
        >
          <p className="vst-menu-title">{label}</p>
          {fixed ? (
            <p className="vst-menu-note">{fixedNote}</p>
          ) : (
            options.map((option) => (
              <MenuOption
                key={String(option)}
                label={show(option)}
                chosen={option === value}
                onChoose={() => {
                  onChange(option);
                  setOpen(false);
                  popover.anchorRef.current?.focus();
                }}
              />
            ))
          )}
        </div>
      ) : null}
    </>
  );
}

/** Tick labels under the length bar: both ends and the round fives between. */
function durationTicks(min: number, max: number): number[] {
  const ticks = [min];
  for (let value = Math.ceil((min + 1) / 5) * 5; value < max; value += 5) {
    if (value - min >= 3 && max - value >= 3) ticks.push(value);
  }
  ticks.push(max);
  return ticks;
}

/** Width of the bar's handle (px): the filled part never gets narrower. */
const HANDLE = 18;

/**
 * The length card. A model with a continuous range (say 4 to 30 seconds)
 * gets the reference's length bar in its popover: a wide track that fills up
 * to a slim handle, dots at the round values and their numbers underneath.
 * One with a handful of fixed lengths gets the same short list as the other
 * cards.
 */
export function DurationCard({
  label,
  value,
  options,
  onChange,
  fixedNote,
  emptyValue,
  warning,
  open,
  onOpenChange,
  className = "",
}: {
  label: string;
  value: number;
  options: readonly number[];
  onChange: (seconds: number) => void;
  fixedNote: string;
  /** What the card reads when the model sets the length itself. */
  emptyValue: string;
  /** Shown in the popover when the current length does not suit the model. */
  warning?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const popover = useAnchoredPopover<HTMLButtonElement>(open, () => onOpenChange(false));
  useFocusChosen(open, popover.popoverRef);
  const min = options[0] ?? value;
  const max = options.at(-1) ?? value;
  const continuous = options.length > 6 && max - min === options.length - 1;
  const fixed = options.length <= 1;
  const share = (seconds: number) => (max === min ? 0 : Math.min(1, Math.max(0, (seconds - min) / (max - min))));
  // Where a value sits along the bar: the centre of the handle at that value.
  const at = (seconds: number) => `calc(${HANDLE / 2}px + (100% - ${HANDLE}px) * ${share(seconds)})`;

  return (
    <>
      <button
        ref={popover.anchorRef}
        type="button"
        className={`vst-card vst-card-button ${fixed ? "vst-card-fixed" : ""} ${className}`}
        aria-expanded={open}
        aria-haspopup={continuous ? "dialog" : "menu"}
        onClick={() => onOpenChange(!open)}
      >
        <CardFace label={label} value={options.length ? <span className="du-num">{value}s</span> : emptyValue} chevron={!fixed} />
      </button>
      {popover.mounted ? (
        <div
          ref={popover.popoverRef}
          style={popover.style}
          role={continuous ? "dialog" : "menu"}
          data-presence="pop"
          data-state={popover.state}
          className={continuous ? "vst-menu vst-menu-slider" : "vst-menu"}
          aria-label={label}
          onKeyDown={continuous ? undefined : moveFocusWithArrows}
        >
          {continuous ? (
            <>
              <p className="vst-menu-title">{label}</p>
              <p className="vst-slider-value du-num">{value}s</p>
              <div className="vst-range" style={{ "--vst-fill": `calc(${HANDLE}px + (100% - ${HANDLE}px) * ${share(value)})` } as CSSProperties}>
                <span className="vst-range-track" aria-hidden="true">
                  {durationTicks(min, max).map((tick) =>
                    tick > value ? <i key={tick} className="vst-range-dot" style={{ left: at(tick) }} /> : null,
                  )}
                  <span className="vst-range-fill">
                    <span className="vst-range-handle" />
                  </span>
                </span>
                <input
                  type="range"
                  className="vst-range-input"
                  min={min}
                  max={max}
                  step={1}
                  value={value}
                  aria-label={label}
                  aria-valuetext={`${value}s`}
                  onChange={(event) => onChange(Number(event.target.value))}
                />
              </div>
              <span className="vst-slider-ticks" aria-hidden="true">
                {durationTicks(min, max).map((tick, index, all) => (
                  <span
                    key={tick}
                    className="du-num"
                    data-edge={index === 0 ? "start" : index === all.length - 1 ? "end" : undefined}
                    style={{ left: at(tick) }}
                  >
                    {tick}
                  </span>
                ))}
              </span>
            </>
          ) : (
            <>
              <p className="vst-menu-title">{label}</p>
              {fixed ? (
                <p className="vst-menu-note">{fixedNote}</p>
              ) : (
                options.map((option) => (
                  <MenuOption
                    key={option}
                    label={`${option}s`}
                    chosen={option === value}
                    onChoose={() => {
                      onChange(option);
                      onOpenChange(false);
                      popover.anchorRef.current?.focus();
                    }}
                  />
                ))
              )}
            </>
          )}
          {warning ? <p className="vst-menu-warning">{warning}</p> : null}
        </div>
      ) : null}
    </>
  );
}
