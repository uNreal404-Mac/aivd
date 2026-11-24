"use client";

import { type CSSProperties, useId } from "react";

/**
 * A slider drawn as a filled bar, the way the reference draws its advanced
 * controls: label on the left, value on the right, the fill up to the thumb.
 * A native range input sits on top, so dragging, clicking and the arrow keys
 * all work and screen readers read it as a slider.
 */
export function AudioFillSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="au-fill" style={{ "--au-fill": `${pct}%` } as CSSProperties}>
      <span className="au-fill-bar" aria-hidden="true" />
      <span className="au-fill-thumb" aria-hidden="true" />
      <label htmlFor={id} className="au-fill-label">
        {label}
      </label>
      <span className="au-fill-value" data-num="">
        {format(value)}
      </span>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-valuetext={format(value)}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}

/** An on/off setting: label and a short explanation, switch on the right. */
export function AudioSwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="au-switch-row">
      <span className="au-switch-text">
        <span id={`${id}-label`} className="au-switch-label">
          {label}
        </span>
        {hint ? (
          <span id={`${id}-hint`} className="au-switch-hint">
            {hint}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="au-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="au-switch-knob" aria-hidden="true" />
      </button>
    </div>
  );
}
