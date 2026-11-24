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

/** Focus the chosen option when a menu opens, so arrows start from it. */
function useFocusChosen(open: boolean, popover: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const target =
        popover.current?.querySelector<HTMLElement>('[aria-pressed="true"]') ??
        popover.current?.querySelector<HTMLElement>("button, input");
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, popover]);
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
        aria-haspopup="true"
        onClick={() => setOpen((current) => !current)}
      >
        <CardFace label={label} value={show(value)} chevron={!fixed} />
      </button>
      {popover.mounted ? (
        <div
          ref={popover.popoverRef}
          style={popover.style}
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
            options.map((option) => {
              const chosen = option === value;
              return (
                <button
                  key={String(option)}
                  type="button"
                  aria-pressed={chosen}
                  className="vst-menu-item"
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    popover.anchorRef.current?.focus();
                  }}
                >
                  <span className="du-num">{show(option)}</span>
                  {chosen ? <Check className="vst-menu-check" aria-hidden="true" /> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </>
  );
}

/** Tick labels under the length slider: both ends and the round fives between. */
function durationTicks(min: number, max: number): number[] {
  const ticks = [min];
  for (let value = Math.ceil((min + 1) / 5) * 5; value < max; value += 5) {
    if (value - min >= 3 && max - value >= 3) ticks.push(value);
  }
  ticks.push(max);
  return ticks;
}

/**
 * The length card. A model with a continuous range (say 4 to 30 seconds)
 * gets a slider in its popover, as on the reference; one with a handful of
 * fixed lengths gets the same short list as the other cards.
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
  const progress = max === min ? 0 : ((value - min) / (max - min)) * 100;

  return (
    <>
      <button
        ref={popover.anchorRef}
        type="button"
        className={`vst-card vst-card-button ${fixed ? "vst-card-fixed" : ""} ${className}`}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => onOpenChange(!open)}
      >
        <CardFace label={label} value={options.length ? <span className="du-num">{value}s</span> : emptyValue} chevron={!fixed} />
      </button>
      {popover.mounted ? (
        <div
          ref={popover.popoverRef}
          style={popover.style}
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
              <input
                type="range"
                className="vst-slider"
                min={min}
                max={max}
                step={1}
                value={value}
                aria-label={label}
                aria-valuetext={`${value}s`}
                onChange={(event) => onChange(Number(event.target.value))}
                style={{ "--vst-progress": `${progress}%` } as CSSProperties}
              />
              <span className="vst-slider-ticks" aria-hidden="true">
                {durationTicks(min, max).map((tick) => (
                  <span key={tick} className="du-num" style={{ left: `${((tick - min) / (max - min)) * 100}%` }}>
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
                options.map((option) => {
                  const chosen = option === value;
                  return (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={chosen}
                      className="vst-menu-item"
                      onClick={() => {
                        onChange(option);
                        onOpenChange(false);
                        popover.anchorRef.current?.focus();
                      }}
                    >
                      <span className="du-num">{option}s</span>
                      {chosen ? <Check className="vst-menu-check" aria-hidden="true" /> : null}
                    </button>
                  );
                })
              )}
            </>
          )}
          {warning ? <p className="vst-menu-warning">{warning}</p> : null}
        </div>
      ) : null}
    </>
  );
}
