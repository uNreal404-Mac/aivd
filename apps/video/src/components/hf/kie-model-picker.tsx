"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePresence } from "@/hooks/use-presence";
import {
  Aperture,
  AudioLines,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock3,
  Coins,
  Film,
  Image as ImageIcon,
  MonitorPlay,
  Orbit,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { useCatalogDetail } from "@/components/hf/use-catalog-detail";
import "./kie-model-picker.css";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import {
  IMAGE_CATALOG,
  IMAGE_FEATURED_IDS,
  VIDEO_CATALOG,
  VIDEO_FEATURED_IDS,
  VIDEO_MODEL_SPECS,
  type CatalogModel,
} from "@/lib/kie-model-catalog";

type Props = {
  kind: "video" | "image";
  locale: string;
  value: string;
  onChange: (id: string) => void;
  /** Models with a connected generation endpoint. */
  connectedIds?: string[];
  /** "card" renders a settings card: a small label over the model name. */
  placement?: "top" | "bottom" | "inline" | "card";
  /** Label shown above the name when placement is "card". */
  label?: string;
  /** Name to show on the trigger instead of the selected catalogue entry. */
  valueLabel?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Kept for callers; availability is now always shown by section. */
  showConnectionStatus?: boolean;
  compact?: boolean;
  catalogSet?: "backup" | "current";
  glass?: boolean;
  allowUnconnectedSelection?: boolean;
  hideTrigger?: boolean;
};

function ModelIcon({ family, kind }: { family: string; kind: "video" | "image" }) {
  const Icon =
    kind === "image"
      ? family === "FLUX" || family === "Wan"
        ? Aperture
        : family === "Google Imagen" || family === "Nano Banana" || family === "GPT Image"
          ? Sparkles
          : family === "Kling" || family === "Grok Imagine"
            ? Orbit
            : ImageIcon
      : family === "Seedance"
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

// Preserve the model selection and featured order from the macv-001 backup.
const BACKUP_VIDEO_IDS = [
  "bytedance/seedance-2-5", "seedance-2-5-flash", "bytedance/seedance-2-5-draft", "bytedance/seedance-2",
  "bytedance/seedance-2-fast", "bytedance/seedance-2-mini", "seedance-1.5-pro",
  "kling/v4-reference-to-video", "kling/v4-flash-reference-to-video", "kling/kling-3-0",
  "wan/3-0-video-prime", "wan/3-0-video", "wan2.6", "google/gemini-omni-flash-1-1",
  "veo-3.1", "minimax-h3/text-to-video", "minimax-h3-max/text-to-video", "hailuo/02-text-to-video-pro",
  "hailuo/02-text-to-video-standard", "grok-imagine/text-to-video",
  "happyhorse/text-to-video", "sora-2",
];
const BACKUP_IMAGE_IDS = [
  "grok-imagine-image-2-0/text-to-image", "flux3/klein-text-to-image",
  "flux2/pro-text-to-image", "flux2/flex-text-to-image", "seedream/5-pro-text-to-image",
  "seedream/5-flash-text-to-image", "google/imagen4", "google/imagen4-fast",
  "ideogram/v3-text-to-image", "qwen3/text-to-image", "z-image/z-image",
];
const BACKUP_VIDEO_FEATURED = [
  "bytedance/seedance-2-5", "seedance-2-5-flash", "bytedance/seedance-2-5-draft",
  "kling/v4-reference-to-video", "minimax-h3/text-to-video", "minimax-h3-max/text-to-video", "wan/3-0-video",
];
const BACKUP_IMAGE_FEATURED = [
  "grok-imagine-image-2-0/text-to-image", "flux3/klein-text-to-image",
  "flux2/pro-text-to-image", "seedream/5-pro-text-to-image", "google/imagen4",
  "qwen3/text-to-image",
];

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

const MODEL_BADGES: Record<string, { label: string; tone: "top" | "new" | "fast" }> = {
  "bytedance/seedance-2-5": { label: "TOP", tone: "top" },
  "kling/v4-reference-to-video": { label: "NEW", tone: "new" },
  "seedance-2-5-flash": { label: "FAST", tone: "fast" },
  "kling/v4-flash-reference-to-video": { label: "FAST", tone: "fast" },
  "veo-3.1": { label: "TOP", tone: "top" },
  "seedream-5-5": { label: "TOP", tone: "top" },
  "gpt-image-2-6-sunburst": { label: "NEW", tone: "new" },
  "gpt-image-2": { label: "NEW", tone: "new" },
  "minimax-h3-image": { label: "FAST", tone: "fast" },
};

/** Cheapest credit price an image model can be run at, from live KIE market pricing. */
function startingImageCredits(modelId: string): number | null {
  const model = getMarketModel(modelId);
  if (!model || model.kind !== "image") return null;
  const resolutions = model.options.resolutions?.length ? model.options.resolutions : [undefined];
  let lowest: number | null = null;
  for (const resolution of resolutions) {
    const credits = marketCredits(model, { prompt: "", resolution, count: 1 });
    if (credits > 0 && (lowest === null || credits < lowest)) lowest = credits;
  }
  return lowest;
}

/** Models that can generate first, then the rest; order is otherwise kept. */
function connectedFirst(models: CatalogModel[], isConnected: (id: string) => boolean): CatalogModel[] {
  return [...models.filter((item) => isConnected(item.id)), ...models.filter((item) => !isConnected(item.id))];
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
  catalogSet = "current",
  label,
  valueLabel,
  glass = false,
  allowUnconnectedSelection = false,
  hideTrigger = false,
}: Props) {
  const zh = locale.toLowerCase().startsWith("zh");
  const t = useTranslations("ModelPicker");
  const backupIds = kind === "video" ? BACKUP_VIDEO_IDS : BACKUP_IMAGE_IDS;
  const fullCatalog = kind === "video" ? VIDEO_CATALOG : IMAGE_CATALOG;
  const catalog = catalogSet === "backup" ? fullCatalog.filter((item) => backupIds.includes(item.id)) : fullCatalog;
  const displayCatalog = catalogSet === "backup" ? catalog : catalog.filter((item) => connectedIds.includes(item.id));
  const featuredIds = catalogSet === "backup"
    ? kind === "video" ? BACKUP_VIDEO_FEATURED : BACKUP_IMAGE_FEATURED
    : kind === "video" ? VIDEO_FEATURED_IDS : IMAGE_FEATURED_IDS;
  // Without a connected list every entry counts as ready (older callers).
  const isConnected = (id: string) => connectedIds.length === 0 || connectedIds.includes(id);
  const detailOf = useCatalogDetail();

  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const panelPresence = usePresence(open);
  const setOpen = onOpenChange ?? setInternalOpen;
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"default" | "fast" | "value" | "quality">("default");
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // In a studio's narrow settings column ("card") the list floats to the right
  // of the card, over the canvas, instead of being clipped by the column.
  const [floatAt, setFloatAt] = useState<{ left: number; top: number; maxHeight?: number } | null>(null);

  const copy = zh
    ? {
        choose: "选择模型",
        close: "关闭",
        search: "搜索模型",
        featured: "精选模型",
        all: "全部模型",
        models: "个模型",
        from: (credits: number) => `${credits} 积分起`,
        more: "更多模型",
        none: "没有匹配的模型",
        noneAvailable: "暂无模型",
      }
    : {
        choose: "Choose model",
        close: "Close",
        search: "Search models",
        featured: "Featured models",
        all: "All models",
        models: "models",
        from: (credits: number) => `From ${credits} credits`,
        more: "More models",
        none: "No models match",
        noneAvailable: "No models available",
      };

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (item: CatalogModel) =>
      needle === "" ||
      item.name.toLowerCase().includes(needle) ||
      item.family.toLowerCase().includes(needle);
    return connectedFirst(inDisplayOrder(displayCatalog.filter(matches), featuredIds), isConnected);
  }, [kind, query, catalogSet, connectedIds]);
  const readyCatalog = displayCatalog.filter((item) => allowUnconnectedSelection || isConnected(item.id));
  const sortedByMode = useMemo(() => {
    if (sortBy === "default") return [];
    const costOf = (id: string) =>
      (kind === "video" ? startingCredits(id) : startingImageCredits(id)) ?? 999999;
    const isFast = (item: CatalogModel) =>
      MODEL_BADGES[item.id]?.tone === "fast" || /flash|fast|turbo|mini|draft|schnell/i.test(item.id + item.name);
    const isQuality = (item: CatalogModel) =>
      MODEL_BADGES[item.id]?.tone === "top" || /pro|prime|max|4k|veo|seedance-2-5|kling\/v4|nano-banana-pro/i.test(item.id);
    const list = [...readyCatalog];
    if (sortBy === "value") {
      return list.sort((a, b) => costOf(a.id) - costOf(b.id));
    }
    if (sortBy === "fast") {
      return list.sort((a, b) => Number(isFast(b)) - Number(isFast(a)) || costOf(a.id) - costOf(b.id));
    }
    return list.sort((a, b) => Number(isQuality(b)) - Number(isQuality(a)) || costOf(b.id) - costOf(a.id));
  }, [sortBy, readyCatalog, kind]);
  const comingSoon = allowUnconnectedSelection ? [] : inDisplayOrder(displayCatalog.filter((item) => !isConnected(item.id)), featuredIds);

  const current = fullCatalog.find((item) => item.id === value);
  const triggerLabel = valueLabel ?? current?.name ?? (compact ? copy.noneAvailable : copy.choose);

  const close = (returnFocus: boolean) => {
    setOpen(false);
    setQuery("");
    setFamily(null);
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

  useLayoutEffect(() => {
    // While closing, the panel keeps its last position for its exit.
    if (!open) return;
    if (placement !== "card" && placement !== "top" && placement !== "bottom") {
      setFloatAt(null);
      return;
    }
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      if (!trigger) return;
      const width = panelRef.current?.offsetWidth ?? 400;
      const height = panelRef.current?.offsetHeight ?? 480;
      if (placement === "top") {
        // Image studio (Higgsfield): fills the room above the bar, left edge on the button.
        const maxHeight = Math.max(160, Math.min(640, trigger.top - 68));
        setFloatAt({ left: Math.min(0, window.innerWidth - trigger.left - width - 16), top: -(maxHeight + 8), maxHeight });
      } else if (placement === "bottom") {
        const maxHeight = Math.max(160, Math.min(420, window.innerHeight - trigger.bottom - 20));
        setFloatAt({ left: Math.min(0, window.innerWidth - trigger.left - width - 16), top: trigger.height + 8, maxHeight });
      } else {
        // Studio column (Higgsfield): 8px right of the settings column, centred
        // vertically in the window rather than following the card.
        const column = triggerRef.current?.closest("aside") ?? triggerRef.current;
        const columnRight = column ? column.getBoundingClientRect().right : trigger.right;
        const left = Math.min(columnRight + 8, window.innerWidth - width - 16);
        const top = Math.max(64, Math.round((window.innerHeight - height) / 2));
        setFloatAt({ left, top });
      }
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, placement, family, query]);

  // ↓ from the search box goes into the list; ↑/↓ move between models; Enter
  // in the search box picks the first match.
  const rowButtons = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button[data-model-row]") ?? [])];
  const onListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const rows = rowButtons();
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (at === -1) return;
    event.preventDefault();
    const next = at + (event.key === "ArrowDown" ? 1 : -1);
    if (next < 0) searchRef.current?.focus();
    else rows[Math.min(next, rows.length - 1)]?.focus();
  };
  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      rowButtons()[0]?.focus();
    } else if (event.key === "Enter" && matches[0] && (allowUnconnectedSelection || isConnected(matches[0].id))) {
      event.preventDefault();
      onChange(matches[0].id);
      close(true);
    }
  };

  const availableRow = (item: CatalogModel) => {
    const selected = item.id === value;
    const ready = isConnected(item.id);
    const selectable = ready || allowUnconnectedSelection;
    const credits = !ready ? null : kind === "video" ? startingCredits(item.id) : startingImageCredits(item.id);
    const specs = kind === "video" ? VIDEO_MODEL_SPECS[item.id] : undefined;
    const badge = MODEL_BADGES[item.id];
    // Highest resolution the model renders (image models from the registry).
    const resolution = specs?.resolution ?? getMarketModel(item.id)?.options.resolutions?.at(-1);
    const duration = specs ? (specs.duration === "source" ? (zh ? "继承原片" : "Source clip") : specs.duration) : null;
    return (
      <button
        key={item.id}
        type="button"
        data-model-row
        aria-pressed={selected}
        aria-disabled={!selectable || undefined}
        disabled={!selectable}
        title={detailOf(item)}
        onClick={() => {
          if (!selectable) return;
          onChange(item.id);
          close(true);
        }}
        className={`du-model-row ${selectable ? "" : "is-unavailable"} ${selected ? "is-selected" : ""}`}
      >
        <span aria-hidden="true" className="du-model-tile">
          <ModelIcon family={item.family} kind={kind} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="du-model-name">{item.name}</span>
            {badge ? <span className={`du-model-badge is-${badge.tone}`}>{badge.label}</span> : null}
          </span>
          <span className="du-model-meta">
            {resolution ? <span><MonitorPlay aria-hidden="true" />{resolution}</span> : null}
            {duration ? <span title={item.id === "bytedance/seedance-2-5-draft" ? (zh ? "时长继承原样片任务" : "Duration follows the source draft task") : undefined}><Clock3 aria-hidden="true" />{duration}</span> : null}
            {credits !== null ? <span className="du-num"><Coins aria-hidden="true" />{copy.from(credits)}</span> : null}
            {!ready && !allowUnconnectedSelection ? <span>{t("comingSoon")}</span> : null}
            {!resolution && !duration && credits === null && ready ? <span>{detailOf(item)}</span> : null}
          </span>
        </span>
        {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--du-accent-text)]" /> : null}
      </button>
    );
  };

  const triggerClass =
    placement === "card"
      ? "vs-card w-full"
      : placement === "inline"
      ? "w-full rounded-xl border border-[var(--du-border)] bg-[var(--du-surface-2)] px-3 py-3"
      : compact
        ? "h-9 max-sm:h-11 max-w-[min(46vw,230px)] px-1 text-xs hover:text-[var(--du-accent-text)] sm:text-sm"
        : "h-9 w-full rounded-xl bg-[var(--du-surface-2)] px-3 text-xs xl:h-10 xl:text-sm";

  return (
    <div ref={pickerRef} className={`relative ${placement === "inline" || placement === "card" ? "w-full" : ""}`}>
      {hideTrigger ? (
        <button ref={triggerRef} type="button" tabIndex={-1} aria-hidden="true" className="pointer-events-none block h-0 w-full overflow-hidden p-0 opacity-0" />
      ) : (
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerLabel ? `${copy.choose}：${triggerLabel}` : copy.choose}
        aria-expanded={open}
        onClick={() => (open ? close(false) : setOpen(true))}
        data-model-trigger
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
            <ChevronDown className="du-caret ml-auto h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />
          </>
        )}
      </button>
      )}

      {panelPresence.mounted ? (
        <div
          ref={panelRef}
          data-presence="pop"
          data-state={panelPresence.state}
          onKeyDown={onListKeyDown}
          style={placement === "card" ? { position: "fixed", left: floatAt?.left ?? -9999, top: floatAt?.top ?? 0, maxHeight: "min(80vh, 570px)" } : placement === "top" || placement === "bottom" ? { position: "absolute", left: floatAt?.left ?? -9999, top: floatAt?.top ?? 0, maxHeight: floatAt?.maxHeight } : undefined}
          className={`${placement === "inline" ? "mt-2" : ""} du-model-picker-panel ${placement === "top" ? "origin-bottom-left" : "origin-top-left"} z-50 flex ${placement === "card" || placement === "top" ? "is-studio w-[min(92vw,402px)]" : "w-[min(92vw,368px)]"} max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-[var(--du-border)] ${glass ? "du-model-picker-glass" : "bg-[var(--du-surface)]"} shadow-2xl`}
        >
          <div className="du-model-picker-search flex items-center gap-2 px-3 py-2.5">
            <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={copy.search}
              aria-label={copy.search}
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--du-text)] outline-none placeholder:text-[var(--du-text-muted)]"
            />
          </div>

          {/* The panel is the only scrolling container, including on Windows. */}
          <div ref={listRef} className="du-model-list">
            {query.trim() ? (
              matches.length ? matches.map(availableRow) : <p className="px-3 py-3 text-sm text-[var(--du-text-muted)]">{copy.none}</p>
            ) : sortBy !== "default" ? (
              sortedByMode.map(availableRow)
            ) : family ? (
              <>
                <button type="button" onClick={() => setFamily(null)} className="mb-1 flex items-center gap-1 px-3 py-2 text-xs text-[var(--du-text-muted)] hover:text-[var(--du-text)]"><ChevronLeft className="h-4 w-4" />{copy.all}</button>
                <p className="px-3 pb-1 text-xs font-semibold text-[var(--du-text-muted)]">{family}</p>
                {connectedFirst(displayCatalog.filter((item) => item.family === family), isConnected).map(availableRow)}
              </>
            ) : (
              <>
                <p className="du-model-section"><Sparkles aria-hidden="true" />{copy.featured}</p>
                {featuredIds.map((id) => readyCatalog.find((item) => item.id === id)).filter((item): item is CatalogModel => Boolean(item)).map(availableRow)}
                {readyCatalog.some((item) => !featuredIds.includes(item.id)) ? (
                  <>
                    <p className="du-model-section">{copy.more}</p>
                    {readyCatalog.filter((item) => !featuredIds.includes(item.id)).map(availableRow)}
                  </>
                ) : null}
                {comingSoon.length ? (
                  <>
                    <p className="du-model-section">{t("comingSoonSection")}</p>
                    {comingSoon.map(availableRow)}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
