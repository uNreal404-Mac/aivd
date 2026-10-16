"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Film,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  RESULT_FILTERS,
  RIGHT_TABS,
  STUDIO_MODELS,
  UNAVAILABLE_LABEL,
  canGenerate,
  defaultSettings,
  estimateCredits,
  selectModel,
  submitGeneration,
} from "@/lib/ai-video-studio";
import type { StudioSettings } from "@/lib/ai-video-studio";
import { PROMPT_MAX_LENGTH } from "@/lib/prompt-limits";

const MODES = ["Create", "Edit", "Motion"] as const;

const TAB_ICONS = {
  History: Clock,
  Library: Film,
  "How it works": BookOpen,
} as const;

const LIBRARY_TILES = [
  "City at dusk",
  "Slow push-in",
  "Coastal drift",
  "Neon alley",
  "Morning fog",
  "Rooftop orbit",
  "Desert pass",
  "Rain on glass",
  "Quiet workshop",
];

const HOW_IT_WORKS = [
  {
    title: "Choose a model",
    body: "Each model trades speed, detail and sound differently. Pick the one that fits the shot.",
  },
  {
    title: "Describe the shot",
    body: "Write the subject, the motion, the camera move and the light. Add a start frame if you have one.",
  },
  {
    title: "Tune and generate",
    body: "Set length, ratio, resolution and audio, then generate. Clips collect on this page.",
  },
];

type ResultItem = {
  id: string;
  status: "queued" | "failed";
  videoUuid?: string | null;
  message?: string;
};

function chipClass(active: boolean, disabled = false): string {
  return [
    "inline-flex max-md:min-h-11 max-md:min-w-11 items-center justify-center rounded-[var(--hfv-radius-chip)] border px-3 py-1.5 text-xs transition-colors",
    active
      ? "border-[var(--hfv-chip-active-bg)] bg-[var(--hfv-chip-active-bg)] text-[var(--hfv-chip-active-text)]"
      : "border-[var(--hfv-border-strong)] bg-[var(--hfv-chip)] text-[var(--hfv-text)]",
    disabled ? "cursor-not-allowed opacity-60" : "hover:opacity-80",
  ].join(" ");
}

function ChipGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function AiVideoStudio({
  generationEnabled,
  initialSettings,
}: {
  generationEnabled: boolean;
  initialSettings?: StudioSettings;
}) {
  const [settings, setSettings] = useState<StudioSettings>(
    () => initialSettings ?? defaultSettings(),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(RIGHT_TABS[0]);
  const [activeFilter, setActiveFilter] = useState<string>(RESULT_FILTERS[0]);

  const model =
    STUDIO_MODELS.find((item) => item.id === settings.modelId) ??
    STUDIO_MODELS[0];

  const check = canGenerate(settings, generationEnabled);
  const credits = estimateCredits(settings);
  const promptEmpty = !check.ok && check.reason === "empty-prompt";

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickerOpen]);

  async function handleGenerate() {
    if (promptEmpty || submitting) {
      return;
    }

    if (!generationEnabled) {
      setNotice(
        "Generation is paused while we finish setup. Your settings are saved on this page.",
      );
      return;
    }

    setSubmitting(true);
    setNotice(null);

    const idempotencyKey =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now());

    try {
      const result = await submitGeneration(settings, idempotencyKey);

      if (!result.ok) {
        setNotice(result.message);
        return;
      }

      setResults((previous) => [
        {
          id: result.videoUuid ?? result.taskId ?? `clip-${previous.length + 1}`,
          status: "queued",
          videoUuid: result.videoUuid,
        },
        ...previous,
      ]);
      setNotice(null);
      setActiveTab(RIGHT_TABS[0]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 lg:h-[calc(100svh-52px)] lg:flex-row bg-[var(--hfv-bg)] text-[var(--hfv-text)]">
      <aside
        aria-label="Video settings"
        className="flex flex-col gap-3 rounded-[var(--hfv-radius-panel)] border border-[var(--hfv-border)] bg-[var(--hfv-panel)] p-3 lg:w-[340px] lg:overflow-y-auto"
      >
        <div className="flex items-center gap-1">
          {MODES.map((mode) => {
            const active = mode === "Create";

            return (
              <button
                key={mode}
                type="button"
                aria-disabled={!active}
                aria-pressed={active}
                className={[
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors max-md:min-h-11 max-md:min-w-11 max-md:justify-center",
                  active
                    ? "border-[var(--hfv-text)] text-[var(--hfv-text)]"
                    : "border-[var(--hfv-border)] text-[var(--hfv-muted)]",
                ].join(" ")}
              >
                {mode}
                {active ? null : (
                  <span className="rounded-[var(--hfv-radius-chip)] bg-[var(--hfv-chip-bg)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="relative h-[112px] rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[radial-gradient(120%_140%_at_0%_0%,var(--hfv-accent-soft),var(--hfv-panel)_75%)] p-4">
          <p className="font-display text-lg font-bold uppercase text-[var(--hfv-accent)]">
            {model.name}
          </p>
          <p className="mt-1 max-w-[72%] text-xs text-[var(--hfv-muted)]">
            {model.tagline}
          </p>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="absolute right-3 top-3 inline-flex max-md:min-h-11 max-md:min-w-11 items-center justify-center rounded-[var(--hfv-radius-chip)] border border-[var(--hfv-border)] bg-[var(--hfv-panel)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--hfv-text)]"
          >
            Change
          </button>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--hfv-radius-card)] border border-dashed border-[var(--hfv-border-strong)] bg-[var(--hfv-panel-2)] px-4 py-5 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hfv-chip-bg)] text-[var(--hfv-muted)]">
            <Upload className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="max-w-[11rem] text-sm font-bold leading-tight">
            Add a start frame (optional)
          </span>
          <span className="text-xs text-[var(--hfv-muted)]">
            PNG, JPG or WebP
          </span>
          {fileName ? (
            <span className="max-w-full truncate text-xs text-[var(--hfv-accent)]">
              {fileName}
            </span>
          ) : null}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setFileName(file ? file.name : null);
            }}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="studio-prompt"
            className="text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]"
          >
            Prompt
          </label>
          <div className="relative">
            <textarea
              id="studio-prompt"
              value={settings.prompt}
              maxLength={PROMPT_MAX_LENGTH}
              placeholder="Describe the shot: subject, motion, camera, light…"
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  prompt: event.target.value,
                }))
              }
              className="min-h-[112px] w-full resize-none rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-field)] px-3 py-3 pb-7 text-sm text-[var(--hfv-text)] outline-none placeholder:text-[var(--hfv-muted)]"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-[var(--hfv-muted)]">
              {settings.prompt.length}/{PROMPT_MAX_LENGTH}
            </span>
          </div>
        </div>

        {settings.preset ? (
          <span className="flex w-fit items-center gap-1.5 rounded-[var(--hfv-radius-chip)] border border-[var(--hfv-border-strong)] bg-[var(--hfv-chip)] px-2.5 py-1 text-xs text-[var(--hfv-text)]">
            Preset: {settings.preset}
            <button
              type="button"
              aria-label="Clear preset"
              onClick={() =>
                setSettings((previous) => ({
                  ...previous,
                  preset: undefined,
                }))
              }
              className="text-[var(--hfv-muted)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : null}

        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="flex flex-col gap-1.5 rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] px-3 py-2.5 text-left"
        >
          <span className="text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
            Model
          </span>
          <span className="flex w-full items-center gap-2">
            <span className="text-sm font-semibold">{model.name}</span>
            {model.badge ? (
              <span className="rounded-[var(--hfv-radius-chip)] bg-[var(--hfv-accent)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--hfv-accent-text)]">
                {model.badge}
              </span>
            ) : null}
            <ChevronRight
              className="ml-auto h-4 w-4 text-[var(--hfv-muted)]"
              aria-hidden="true"
            />
          </span>
        </button>

        {pickerOpen ? (
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
                onClick={() => setPickerOpen(false)}
                className="rounded-[var(--hfv-radius-chip)] p-1 text-[var(--hfv-muted)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {STUDIO_MODELS.map((option) => {
                const selected = option.id === settings.modelId;
                const unavailable = !option.available;

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    aria-disabled={unavailable}
                    disabled={unavailable}
                    onClick={() => {
                      setSettings((previous) => selectModel(previous, option.id));
                      setPickerOpen(false);
                    }}
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
        ) : null}

        <ChipGroup label="Duration">
          {model.durations.map((duration) => {
            const active = duration === settings.duration;

            return (
              <button
                key={duration}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, duration }))
                }
                className={chipClass(active)}
              >
                {duration}s
              </button>
            );
          })}
        </ChipGroup>

        <ChipGroup label="Aspect">
          {model.aspects.map((aspect) => {
            const active = aspect === settings.aspect;

            return (
              <button
                key={aspect}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, aspect }))
                }
                className={chipClass(active)}
              >
                {aspect}
              </button>
            );
          })}
        </ChipGroup>

        <ChipGroup label="Resolution">
          {model.resolutions.map((resolution) => {
            const active = resolution === settings.resolution;

            return (
              <button
                key={resolution}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, resolution }))
                }
                className={chipClass(active)}
              >
                {resolution}
              </button>
            );
          })}
        </ChipGroup>

        <ChipGroup label="Audio">
          {(["On", "Off"] as const).map((option) => {
            const value = option === "On";
            const disabled = !model.audio;
            const active = disabled ? false : settings.audio === value;

            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, audio: value }))
                }
                className={chipClass(active, disabled)}
              >
                {option}
              </button>
            );
          })}
        </ChipGroup>

        <button
          type="button"
          disabled={promptEmpty || submitting}
          onClick={handleGenerate}
          className={[
            "flex h-12 w-full items-center justify-between rounded-[var(--hfv-radius-btn)] bg-[var(--hfv-accent)] px-4 text-[var(--hfv-accent-text)]",
            promptEmpty || submitting ? "cursor-not-allowed opacity-50" : "",
          ].join(" ")}
        >
          <span className="font-semibold">
            {submitting ? "Submitting…" : "Generate"}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {credits} credits
          </span>
        </button>

        {notice ? (
          <output
            aria-live="polite"
            className="rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] px-3 py-2 text-xs text-[var(--hfv-muted)]"
          >
            {notice}
          </output>
        ) : null}
      </aside>

      <section
        aria-label="Results"
        className="flex-1 overflow-y-auto rounded-[var(--hfv-radius-panel)] border border-[var(--hfv-border)] bg-[var(--hfv-panel)] p-4"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {RIGHT_TABS.map((tab) => {
            const active = tab === activeTab;
            const Icon = TAB_ICONS[tab];

            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab)}
                className={[
                  "flex items-center gap-1.5 rounded-[var(--hfv-radius-chip)] px-3 py-1.5 text-xs transition-colors max-md:min-h-11 max-md:min-w-11 max-md:justify-center",
                  active
                    ? "bg-[var(--hfv-chip-bg)] text-[var(--hfv-text)]"
                    : "text-[var(--hfv-muted)]",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab}
              </button>
            );
          })}
        </div>

        <div className="grid items-center gap-6 py-8 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[40px] font-bold uppercase leading-none text-[var(--hfv-text)]">
              Direct every frame
            </h2>
            <p className="text-sm text-[var(--hfv-muted)]">
              Pick a model, write the shot, and tune length, ratio and sound.
              Your clips land here.
            </p>
          </div>
          <div className="flex aspect-video items-center justify-center rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[linear-gradient(135deg,var(--hfv-panel-3),var(--hfv-accent-soft))]">
            <Film
              className="h-8 w-8 text-[var(--hfv-muted)]"
              aria-hidden="true"
            />
          </div>
        </div>

        <div className="flex justify-center py-2">
          <div className="flex items-center gap-1 rounded-full border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] p-1">
            {RESULT_FILTERS.map((filter) => {
              const active = filter === activeFilter;

              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setActiveFilter(filter)}
                  className={[
                    "inline-flex max-md:min-h-11 max-md:min-w-11 items-center justify-center rounded-full px-3 py-1 text-xs transition-colors",
                    active
                      ? "bg-[var(--hfv-chip-active-bg)] text-[var(--hfv-chip-active-text)]"
                      : "text-[var(--hfv-muted)]",
                  ].join(" ")}
                >
                  {filter}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pt-4">
          {activeTab === "Library" ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {LIBRARY_TILES.map((caption) => (
                <div
                  key={caption}
                  className="relative aspect-[3/4] overflow-hidden rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[linear-gradient(160deg,var(--hfv-panel-2),var(--hfv-panel-3))] transition-transform duration-300 hover:scale-[1.02]"
                >
                  <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(to_top,var(--hfv-overlay),transparent)] px-3 pb-2 pt-8">
                    <span className="text-xs text-[var(--hfv-text)]">
                      {caption}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "How it works" ? (
            <div className="grid gap-3 md:grid-cols-3">
              {HOW_IT_WORKS.map((step, index) => (
                <div
                  key={step.title}
                  className="flex flex-col gap-2 rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] p-4"
                >
                  <span className="font-display text-2xl font-bold uppercase text-[var(--hfv-accent)]">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold">{step.title}</span>
                  <span className="text-xs text-[var(--hfv-muted)]">
                    {step.body}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "History" ? (
            results.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--hfv-muted)]">
                No clips yet. Your generations will show up here.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="flex aspect-video flex-col items-center justify-center gap-2 rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[linear-gradient(160deg,var(--hfv-panel-2),var(--hfv-panel-3))]"
                  >
                    <Clock
                      className="h-5 w-5 text-[var(--hfv-muted)]"
                      aria-hidden="true"
                    />
                    <span className="text-xs uppercase tracking-wide text-[var(--hfv-muted)]">
                      {result.status}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
      </section>
    </div>
  );
}
