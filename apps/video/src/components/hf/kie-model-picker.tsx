"use client";

import { useState } from "react";
import { Aperture, AudioLines, Check, ChevronDown, ChevronLeft, ChevronRight, Clapperboard, Film, Image as ImageIcon, Orbit, Sparkles, X } from "lucide-react";
import {
  IMAGE_CATALOG, IMAGE_FEATURED_IDS, VIDEO_CATALOG, VIDEO_FEATURED_IDS,
  type CatalogModel,
} from "@/lib/kie-model-catalog";

type Props = {
  kind: "video" | "image";
  locale: string;
  value: string;
  onChange: (id: string) => void;
  connectedIds?: string[];
  placement?: "top" | "inline";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function ModelIcon({ family }: { family: string }) {
  const Icon = family === "Seedance" ? Clapperboard
    : family === "Kling" || family === "Grok Imagine" ? Orbit
    : family === "MiniMax Hailuo" ? AudioLines
    : family === "Google Veo" || family === "Gemini Omni Flash" || family === "Google Imagen" ? Sparkles
    : family === "Wan" || family === "FLUX" ? Aperture
    : family === "Seedream" || family === "Ideogram" || family === "Qwen" || family === "Z-Image" ? ImageIcon
    : Film;
  return <Icon aria-hidden="true" className="h-5 w-5" />;
}

export function KieModelPicker({ kind, locale, value, onChange, connectedIds = [], placement = "inline", open: controlledOpen, onOpenChange }: Props) {
  const zh = locale.toLowerCase().startsWith("zh");
  const catalog = kind === "video" ? VIDEO_CATALOG : IMAGE_CATALOG;
  const featuredIds = kind === "video" ? VIDEO_FEATURED_IDS : IMAGE_FEATURED_IDS;
  const featured = featuredIds.map((id) => catalog.find((item) => item.id === id)).filter((item): item is CatalogModel => Boolean(item));
  const families = Array.from(new Set(catalog.map((item) => item.family)));
  const current = catalog.find((item) => item.id === value);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [family, setFamily] = useState<string | null>(null);

  const row = (item: CatalogModel) => {
    const connected = connectedIds.includes(item.id);
    const selected = item.id === value;
    return <button key={item.id} type="button" aria-pressed={selected} onClick={() => { onChange(item.id); setOpen(false); setFamily(null); }}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--du-surface-2)] ${selected ? "bg-[var(--du-surface-2)]" : ""}`}>
      <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--du-surface-2)] text-[var(--du-accent-text)]"><ModelIcon family={item.family} /></span>
      <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--du-text)]">{item.name}
        {item.badge ? <span className="rounded-md bg-[var(--du-accent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--du-on-accent)]">{item.badge === "Top" ? (zh ? "精选" : "Top") : (zh ? "新" : "New")}</span> : null}
      </span><span className="mt-0.5 block text-xs text-[var(--du-text-muted)]">{item.detail} · {connected ? (zh ? "可生成" : "Ready") : (zh ? "接口待接入" : "Integration pending")}</span></span>
      {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--du-accent-text)]" /> : null}
    </button>;
  };

  return <div className={`relative ${placement === "inline" ? "w-full" : ""}`}>
    <button type="button" aria-label={zh ? "选择模型" : "Choose model"} aria-expanded={open} onClick={() => setOpen(!open)}
      className={`flex items-center gap-2 text-left ${placement === "inline" ? "w-full rounded-xl border border-[var(--du-border)] bg-[var(--du-surface-2)] px-3 py-3" : "h-9 max-w-[210px] rounded-xl bg-[var(--du-surface-2)] px-3 text-xs xl:h-10 xl:text-sm"}`}>
      {kind === "video" ? <Film className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]" /> : <ImageIcon className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />}
      <span className="truncate text-[var(--du-text)]">{current?.name ?? (zh ? "选择模型" : "Choose model")}</span>
      <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-[var(--du-text-muted)]" />
    </button>
    {open ? <div className={`${placement === "top" ? "absolute bottom-[calc(100%+8px)] left-0" : "mt-2"} z-50 w-[min(92vw,620px)] max-w-full rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] shadow-2xl`}>
      <div className="flex items-center justify-between border-b border-[var(--du-border)] px-4 py-3"><span className="text-sm font-semibold text-[var(--du-text)]">{family ?? (zh ? "选择模型" : "Choose a model")}</span><button type="button" aria-label={zh ? "关闭" : "Close"} onClick={() => { setOpen(false); setFamily(null); }}><X className="h-4 w-4 text-[var(--du-text-muted)]" /></button></div>
      <div className="max-h-[min(65vh,520px)] overflow-y-auto p-2">
        {family ? <><button type="button" onClick={() => setFamily(null)} className="mb-2 flex items-center gap-1 px-3 py-2 text-xs text-[var(--du-text-muted)] hover:text-[var(--du-text)]"><ChevronLeft className="h-4 w-4" />{zh ? "全部模型" : "All models"}</button>{catalog.filter((item) => item.family === family).map(row)}</> : <>
          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-[var(--du-text-muted)]"><Sparkles className="h-3.5 w-3.5" />{zh ? "精选模型" : "Featured models"}</div>
          {featured.map(row)}
          <div className="mt-2 flex items-center gap-2 border-t border-[var(--du-border)] px-3 py-3 text-xs font-semibold text-[var(--du-text-muted)]">{zh ? "全部模型" : "All models"}</div>
          {families.map((name) => <button key={name} type="button" onClick={() => setFamily(name)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--du-surface-2)]"><span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--du-surface-2)] text-[var(--du-accent-text)]"><ModelIcon family={name} /></span><span className="flex-1 text-sm text-[var(--du-text)]">{name}<span className="block text-xs text-[var(--du-text-muted)]">{catalog.filter((item) => item.family === name).length} {zh ? "个型号" : "models"}</span></span><ChevronRight className="h-4 w-4 text-[var(--du-text-muted)]" /></button>)}
        </>}
      </div>
    </div> : null}
  </div>;
}
