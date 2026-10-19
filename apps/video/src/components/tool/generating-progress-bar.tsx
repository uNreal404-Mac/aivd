/**
 * Generating Progress Bar
 *
 * - `percent` number  → determinate bar driven by the queue estimate
 * - `percent` missing → looping indeterminate animation
 */

"use client";

import { cn } from "@/components/ui";

export function GeneratingProgressBar({
  className,
  percent,
  label,
}: {
  className?: string;
  percent?: number | null;
  label?: string;
}) {
  const value =
    typeof percent === "number"
      ? Math.min(100, Math.max(0, Math.round(percent)))
      : null;

  return (
    <div className={cn("w-full", className)}>
      {/* Native element for assistive tech; the styled bar below is visual. */}
      <progress
        className="sr-only"
        max={100}
        value={value ?? undefined}
        aria-label={label}
      />
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-[var(--du-surface-2)]"
        aria-hidden="true"
      >
        {value !== null ? (
          <div
            className="h-full rounded-full bg-[var(--du-accent)] transition-[width] duration-700"
            style={{ width: `${value}%` }}
          />
        ) : (
          <div className="h-full rounded-full bg-[var(--du-accent)] animate-[loading_2s_ease-in-out_infinite]" />
        )}
      </div>

      <style jsx>{`
        @keyframes loading {
          0% {
            width: 0%;
            opacity: 0.5;
          }
          50% {
            width: 60%;
            opacity: 1;
          }
          100% {
            width: 100%;
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
