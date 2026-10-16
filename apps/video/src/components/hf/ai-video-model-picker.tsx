"use client";

import { Check, X } from "lucide-react";
import { STUDIO_MODELS, UNAVAILABLE_LABEL } from "@/lib/ai-video-studio";

export function AiVideoModelPicker({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label="Choose a model"
      className="rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] p-2"
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
        <span className="text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
          Choose a model
        </span>
        <button
          type="button"
          aria-label="Close model picker"
          onClick={onClose}
          className="rounded-[var(--hfv-radius-chip)] p-1 text-[var(--hfv-muted)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {STUDIO_MODELS.map((option) => {
          const selected = option.id === selectedId;
          const unavailable = !option.available;

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              aria-disabled={unavailable}
              disabled={unavailable}
              onClick={() => onSelect(option.id)}
              className={[
                "flex items-start gap-2 rounded-[var(--hfv-radius-chip)] px-2.5 py-2 text-left transition-colors",
                unavailable
                  ? "cursor-not-allowed opacity-50"
                  : selected
                    ? "bg-[var(--hfv-chip-active-bg)] text-[var(--hfv-chip-active-text)]"
                    : "text-[var(--hfv-text)] hover:bg-[var(--hfv-panel-3)]",
              ].join(" ")}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    {option.name}
                  </span>
                  {unavailable ? (
                    <span className="rounded-[var(--hfv-radius-chip)] bg-[var(--hfv-chip-bg)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
                      {UNAVAILABLE_LABEL}
                    </span>
                  ) : option.badge ? (
                    <span className="rounded-[var(--hfv-radius-chip)] bg-[var(--hfv-accent)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--hfv-accent-text)]">
                      {option.badge}
                    </span>
                  ) : null}
                </span>
                <span
                  className={[
                    "text-xs",
                    selected
                      ? "text-[var(--hfv-chip-active-text)] opacity-80"
                      : "text-[var(--hfv-muted)]",
                  ].join(" ")}
                >
                  {option.tagline}
                </span>
              </span>
              {selected ? (
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
