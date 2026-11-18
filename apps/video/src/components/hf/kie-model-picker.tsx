"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Aperture,
  AudioLines,
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Orbit,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import {
  IMAGE_CATALOG,
  IMAGE_FEATURED_IDS,
  VIDEO_CATALOG,
  VIDEO_FEATURED_IDS,
  type CatalogModel,
} from "@/lib/kie-model-catalog";

type Props = {
  kind: "video" | "image";
  locale: string;
  value: string;
  onChange: (id: string) => void;
  /** Models that can generate today. Everything else is listed as coming soon. */
  connectedIds?: string[];
  /** "card" renders a settings card: a small label over the model name. */
  placement?: "top" | "inline" | "card";
  /** Label shown above the name when placement is "card". */
  label?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Kept for callers; availability is now always shown by section. */
  showConnectionStatus?: boolean;
  compact?: boolean;
};

function ModelIcon({ family }: { family: string }) {
  const Icon =
    family === "Seedance"
      ? Clapperboard
      : family === "Kling" || family === "Grok Imagine"
        ? Orbit
        : family === "MiniMax Hailuo"
          ? AudioLines
          : family === "Google Veo" || family === "Gemini Omni Flash" || family === "Google Imagen"
            ? Sparkles
            : family === "Wan" || family === "FLUX"
              ? Aperture
              : family === "Seedream" || family === "Ideogram" || family === "Qwen" || family === "Z-Image"
                ? ImageIcon
                : Film;
  return <Icon aria-hidden="true" className="h-5 w-5" />;
}

/** Cheapest credit price a video model can be run at, or null if unpriced. */
function startingCredits(modelId: string): number | null {
  const model = STUDIO_MODELS.find((item) => item.id === modelId);
  if (!model) return null;
  let lowest: number | null = null;
  for (const duration of model.durations) {
    for (const resolution of model.resolutions) {
      const credits = estimateCredits({ modelId, duration, resolution });
      if (credits > 0 && (lowest === null || credits < lowest)) lowest = credits;
    }
  }
  return lowest;
}

/** Featured models first, then the rest in catalogue order. */
function inDisplayOrder(models: CatalogModel[], featuredIds: string[]): CatalogModel[] {
  const rank = (id: string) => {
    const index = featuredIds.indexOf(id);
    return index === -1 ? featuredIds.length : index;
  };
  return [...models].sort((a, b) => rank(a.id) - rank(b.id));
}

export function KieModelPicker({
  kind,
  locale,
  value,
  onChange,
  connectedIds = [],
  placement = "inline",
  open: controlledOpen,
  onOpenChange,
  compact = false,
  label,
}: Props) {
  const zh = locale.toLowerCase().startsWith("zh");
  const catalog = kind === "video" ? VIDEO_CATALOG : IMAGE_CATALOG;
  const featuredIds = kind === "video" ? VIDEO_FEATURED_IDS : IMAGE_FEATURED_IDS;

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [query, setQuery] = useState("");
  const [showUpcoming, setShowUpcoming] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const copy = zh
    ? {
        choose: "选择模型",
        close: "关闭",
        search: "搜索模型",
        available: "可生成",
        upcoming: "即将上线",
        showUpcoming: (count: number) => `查看 ${count} 个即将上线的模型`,
        hideUpcoming: "收起即将上线的模型",
        soon: "即将上线",
        from: (credits: number) => `${credits} 积分起`,
        none: "没有匹配的模型",
        noneAvailable: kind === "image" ? "图片模型即将上线" : "暂无可生成的模型",
      }
    : {
        choose: "Choose model",
        close: "Close",
        search: "Search models",
        available: "Ready to generate",
        upcoming: "Coming soon",
        showUpcoming: (count: number) => `Show ${count} models coming soon`,
        hideUpcoming: "Hide models coming soon",
        soon: "Soon",
        from: (credits: number) => `From ${credits} credits`,
        none: "No models match",
        noneAvailable: kind === "image" ? "Image models coming soon" : "No models available yet",
      };

  const { available, upcoming } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (item: CatalogModel) =>
      needle === "" ||
      item.name.toLowerCase().includes(needle) ||
      item.family.toLowerCase().includes(needle);
    const ordered = inDisplayOrder(catalog.filter(matches), featuredIds);
    return {
      available: ordered.filter((item) => connectedIds.includes(item.id)),
      upcoming: ordered.filter((item) => !connectedIds.includes(item.id)),
    };
  }, [catalog, connectedIds, featuredIds, query]);

  const current = catalog.find((item) => item.id === value);
  const currentIsAvailable = current ? connectedIds.includes(current.id) : false;
  const hasAnyAvailable = catalog.some((item) => connectedIds.includes(item.id));
  const triggerLabel = currentIsAvailable
    ? current?.name
    : hasAnyAvailable
      ? (current?.name ?? copy.choose)
      : compact
        ? (current?.name ?? copy.noneAvailable)
        : copy.noneAvailable;
  // A search should reveal matches wherever they are.
  const upcomingVisible = showUpcoming || query.trim() !== "";

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setQuery("");
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus({ preventScroll: true });
    const onPointerDown = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) close(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        close(true);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const availableRow = (item: CatalogModel) => {
    const selected = item.id === value;
    const credits = kind === "video" ? startingCredits(item.id) : null;
    return (
      <button
        key={item.id}
        type="button"
        aria-pressed={selected}
        onClick={() => {
          onChange(item.id);
          close(true);
        }}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--du-surface-2)] ${selected ? "bg-[var(--du-surface-2)]" : ""}`}
      >
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--du-surface-2)] text-[var(--du-accent-text)]"
        >
          <ModelIcon family={item.family} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--du-text)]">{item.name}</span>
          <span className="mt-0.5 block truncate text-xs text-[var(--du-text-muted)]">{item.detail}</span>
        </span>
        {credits !== null ? (
          <span className="shrink-0 rounded-md bg-[var(--du-surface-2)] px-2 py-1 text-[11px] font-medium text-[var(--du-accent-text)]">
            {copy.from(credits)}
          </span>
        ) : null}
        {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--du-accent-text)]" /> : null}
      </button>
    );
  };

  const upcomingRow = (item: CatalogModel) => (
    <div
      key={item.id}
      aria-disabled="true"
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left opacity-60"
    >
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--du-surface-2)] text-[var(--du-text-muted)]"
      >
        <ModelIcon family={item.family} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-[var(--du-text)]">{item.name}</span>
      <span className="shrink-0 rounded-md border border-[var(--du-border)] px-2 py-0.5 text-[11px] text-[var(--du-text-muted)]">
        {copy.soon}
      </span>
    </div>
  );

  const triggerClass =
    placement === "card"
      ? "vs-card w-full"
      : placement === "inline"
      ? "w-full rounded-xl border border-[var(--du-border)] bg-[var(--du-surface-2)] px-3 py-3"
      : compact
        ? "h-9 max-w-[min(46vw,230px)] px-1 text-xs hover:text-[var(--du-accent-text)] sm:text-sm"
        : "h-9 w-full rounded-xl bg-[var(--du-surface-2)] px-3 text-xs xl:h-10 xl:text-sm";

  return (
    <div ref={pickerRef} className={`relative ${placement === "inline" || placement === "card" ? "w-full" : ""}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={copy.choose}
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
        className={`flex items-center gap-2 text-left ${triggerClass}`}
      >
        {placement === "card" ? (
          <>
            <span className="min-w-0 flex-1">
              <span className="vs-card-label">{label ?? copy.choose}</span>
              <span className="vs-card-value">{triggerLabel}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />
          </>
        ) : (
          <>
            {kind === "video" ? (
              <Film className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />
            ) : (
              <ImageIcon className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />
            )}
            <span className="truncate text-[var(--du-text)]">{triggerLabel}</span>
            <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />
          </>
        )}
      </button>

      {open ? (
        <div
          className={`${placement === "top" ? "absolute bottom-[calc(100%+8px)] left-0" : "mt-2"} z-50 w-[min(92vw,400px)] max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] shadow-2xl`}
        >
          <div className="flex items-center gap-2 border-b border-[var(--du-border)] px-3 py-2.5">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.search}
              aria-label={copy.search}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--du-text)] outline-none placeholder:text-[var(--du-text-muted)]"
            />
            <button type="button" aria-label={copy.close} onClick={() => close(true)}>
              <X className="h-4 w-4 text-[var(--du-text-muted)]" />
            </button>
          </div>

          <div className="max-h-[min(60vh,420px)] overflow-y-auto p-2">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold text-[var(--du-text-muted)]">{copy.available}</p>
            {available.length > 0 ? (
              <div>{available.map(availableRow)}</div>
            ) : (
              <p className="px-3 py-3 text-sm text-[var(--du-text-muted)]">
                {query.trim() !== "" ? copy.none : copy.noneAvailable}
              </p>
            )}

            {upcoming.length > 0 ? (
              <div className="mt-2 border-t border-[var(--du-border)] pt-2">
                {query.trim() === "" ? (
                  <button
                    type="button"
                    aria-expanded={upcomingVisible}
                    onClick={() => setShowUpcoming(!showUpcoming)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold text-[var(--du-text-muted)] hover:text-[var(--du-text)]"
                  >
                    {upcomingVisible ? copy.hideUpcoming : copy.showUpcoming(upcoming.length)}
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-4 w-4 transition-transform ${upcomingVisible ? "rotate-180" : ""}`}
                    />
                  </button>
                ) : (
                  <p className="px-3 pb-1 pt-1 text-xs font-semibold text-[var(--du-text-muted)]">{copy.upcoming}</p>
                )}
                {upcomingVisible ? upcoming.map(upcomingRow) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
