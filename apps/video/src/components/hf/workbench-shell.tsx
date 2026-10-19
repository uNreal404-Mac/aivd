"use client";

import { BookOpen, Clock, Film } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

type WorkbenchMode = "text-to-video" | "image-to-video" | "reference-to-video";

type HfWorkbenchShellProps = {
  generator: React.ReactNode;
  history: React.ReactNode;
  heroTitle: string;
  heroDescription: string;
  activeMode: WorkbenchMode;
  lang: string;
};

type RightTab = "history" | "library" | "how";

const MODE_TABS: { key: WorkbenchMode; label: string; slug: string }[] = [
  { key: "text-to-video", label: "Text", slug: "text-to-video" },
  { key: "image-to-video", label: "Image", slug: "image-to-video" },
  { key: "reference-to-video", label: "Reference", slug: "reference-to-video" },
];

const RIGHT_TABS: { key: RightTab; label: string; Icon: typeof Clock }[] = [
  { key: "history", label: "History", Icon: Clock },
  { key: "library", label: "Library", Icon: Film },
  { key: "how", label: "How it works", Icon: BookOpen },
];

const FILTERS = ["Featured", "Trending", "Newest"] as const;

const LIBRARY_TILES: { title: string; caption: string }[] = [
  { title: "Neon skyline", caption: "City flythrough" },
  { title: "Desert drift", caption: "Slow pan" },
  { title: "Ocean bloom", caption: "Macro water" },
  { title: "Paper craft", caption: "Stop motion" },
  { title: "Aurora loop", caption: "Night sky" },
  { title: "Studio light", caption: "Product spin" },
  { title: "Forest mist", caption: "Morning haze" },
  { title: "Retro grid", caption: "Synth horizon" },
  { title: "Clay figures", caption: "Soft shadows" },
];

const HOW_STEPS: { title: string; body: string }[] = [
  {
    title: "Write a prompt or upload an image",
    body: "Describe the scene you want, or start from a still frame you already have.",
  },
  {
    title: "Choose model, length and ratio",
    body: "Pick the model that fits the look, then set duration and aspect ratio.",
  },
  {
    title: "Generate and download from History",
    body: "Run the job, then find every render waiting for you in History.",
  },
];

function DemoChip() {
  return (
    <span className="rounded-[6px] bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--du-text-muted)]">
      Demo
    </span>
  );
}

function SoonChip() {
  return (
    <span className="rounded-[6px] bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--du-text-muted)]">
      Soon
    </span>
  );
}

export function HfWorkbenchShell({
  generator,
  history,
  heroTitle,
  heroDescription,
  activeMode,
  lang,
}: HfWorkbenchShellProps) {
  const [rightTab, setRightTab] = useState<RightTab>("library");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Featured");

  return (
    <div className="flex h-auto flex-col gap-3 p-3 lg:h-[calc(100svh-52px)] lg:flex-row">
      <aside className="flex w-full shrink-0 flex-col rounded-[20px] border border-white/5 bg-[var(--du-surface)] lg:w-[320px] lg:overflow-y-auto">
        <div className="flex items-center gap-4 border-b border-white/5 px-3 pt-3">
          {MODE_TABS.map((tab) => {
            const isActive = tab.key === activeMode;
            return (
              <Link
                key={tab.key}
                href={`/${lang}/${tab.slug}`}
                className={`-mb-px border-b-2 pb-2 text-[14px] font-medium transition-colors ${
                  isActive
                    ? "border-white text-white"
                    : "border-transparent text-white/50 hover:text-white/80"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
          <span
            aria-disabled="true"
            className="-mb-px flex cursor-not-allowed items-center gap-1.5 border-b-2 border-transparent pb-2 text-[14px] font-medium text-white/50 opacity-60"
          >
            Edit
            <SoonChip />
          </span>
        </div>

        <div className="p-3">
          <div className="relative flex h-[104px] flex-col justify-center overflow-hidden rounded-[14px] bg-[radial-gradient(120%_140%_at_0%_0%,var(--du-accent-soft)_0%,var(--du-accent-soft)_38%,var(--du-surface)_78%)] px-4">
            <span className="font-display text-[16px] font-bold uppercase tracking-[-0.04em] text-[var(--du-accent-text)]">
              DreamUtopia Video
            </span>
            <span className="mt-1 text-[12px] text-white/70">
              Pick a model below
            </span>
            <span className="absolute right-3 top-3">
              <DemoChip />
            </span>
          </div>
        </div>

        <div className="flex-1 p-3">{generator}</div>
      </aside>

      <section className="min-w-0 flex-1 rounded-[20px] border border-white/5 bg-[var(--du-surface)] p-5 lg:overflow-y-auto">
        <div className="flex items-center gap-1">
          {RIGHT_TABS.map(({ key, label, Icon }) => {
            const isActive = key === rightTab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setRightTab(key)}
                className={`flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/50 hover:text-white/80"
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </button>
            );
          })}
        </div>

        {rightTab === "history" ? <div className="mt-6">{history}</div> : null}

        {rightTab === "library" ? (
          <div>
            <div className="mt-6 flex flex-col items-center gap-6 md:flex-row">
              <div className="flex-1">
                <h2 className="font-display text-[28px] font-bold uppercase leading-tight tracking-[-0.04em] text-[var(--du-text)] md:text-[32px]">
                  {heroTitle}
                </h2>
                <p className="mt-3 max-w-[420px] text-[14px] text-[var(--du-text-muted)]">
                  {heroDescription}
                </p>
              </div>
              <div className="relative aspect-video w-full overflow-hidden rounded-[12px] bg-[linear-gradient(135deg,var(--du-surface-2)_0%,var(--du-surface-2)_45%,var(--du-accent-soft)_100%)] md:w-[44%]">
                <span className="absolute right-3 top-3">
                  <DemoChip />
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <div className="flex items-center gap-1 rounded-full border border-white/10 p-1">
                {FILTERS.map((item) => {
                  const isActive = item === filter;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFilter(item)}
                      className={`h-8 rounded-full px-3 text-[14px] font-medium transition-colors ${
                        isActive
                          ? "bg-white text-[var(--du-surface)]"
                          : "text-white/60 hover:text-white/80"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3">
              {LIBRARY_TILES.map((tile) => (
                <div
                  key={tile.title}
                  className="relative aspect-[3/4] overflow-hidden rounded-[12px] bg-[linear-gradient(160deg,var(--du-surface-2)_0%,var(--du-surface-2)_55%,var(--du-accent-soft)_100%)]"
                >
                  <span className="absolute right-2 top-2">
                    <DemoChip />
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                    <span className="text-[12px] text-white/80">
                      {tile.caption}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {rightTab === "how" ? (
          <div className="mt-6 flex flex-col gap-3">
            {HOW_STEPS.map((step, index) => (
              <div
                key={step.title}
                className="rounded-[16px] bg-[var(--du-surface-2)] p-5"
              >
                <span className="font-display text-[16px] font-bold uppercase tracking-[-0.04em] text-[var(--du-accent-text)]">
                  {`Step ${index + 1}`}
                </span>
                <h3 className="mt-2 text-[16px] font-semibold text-[var(--du-text)]">
                  {step.title}
                </h3>
                <p className="mt-1 text-[14px] text-[var(--du-text-muted)]">{step.body}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
