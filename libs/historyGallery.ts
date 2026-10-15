import { IMAGE_COST, VIDEO_COST, parseStoredModel, type GenerationKind } from "./costs";

/** Client-side filter for the owner's History canvas. Not a community feed. */
export type HistoryKindFilter = "all" | "video" | "image";

/**
 * Fields from GET /api/history and GET /api/generations (publicGeneration).
 * Do not add community/gallery fields here — API contract stays unchanged.
 */
export type HistoryItem = {
  id: string | number;
  kind?: string;
  model?: string;
  storedModel?: string;
  prompt?: string;
  status?: string;
  duration_sec?: number | null;
  result_url?: string | null;
  resultUrl?: string | null;
  input_image_url?: string | null;
  last_image_url?: string | null;
  created_at?: string | null;
  guest?: boolean;
};

export function itemKind(g: HistoryItem): GenerationKind {
  if (g.kind === "image" || g.kind === "video") return g.kind;
  if (g.storedModel) return parseStoredModel(g.storedModel).kind;
  return String(g.model || "").indexOf("image") === 0 ? "image" : "video";
}

export function itemModel(g: HistoryItem): string {
  if (g.model) return String(g.model);
  if (g.storedModel) return parseStoredModel(g.storedModel).model;
  return "lite";
}

export function creditCostForItem(g: HistoryItem): number {
  const kind = itemKind(g);
  const model = itemModel(g);
  const table = kind === "image" ? IMAGE_COST : VIDEO_COST;
  return table[model] || 0;
}

export function displayDuration(g: HistoryItem): string {
  if (itemKind(g) === "image") return "—";
  const n = Number(g.duration_sec);
  return Number.isFinite(n) && n > 0 ? `${n}s` : "—";
}

/** Aspect is not in the history JSON contract — show an honest placeholder. */
export function displayAspect(g: HistoryItem): string {
  void g;
  return "—";
}

/**
 * Resolution is not stored on generations. Image Lite is always 1K;
 * image Pro defaults to 2K in the workspace payload. Video is unknown.
 */
export function displayResolution(g: HistoryItem): string {
  if (itemKind(g) !== "image") return "—";
  return itemModel(g) === "pro" ? "2K" : "1K";
}

export function resultUrlOf(g: HistoryItem): string {
  return String(g.result_url || g.resultUrl || "");
}

export function filterOwnWorks(items: HistoryItem[] | null | undefined, filter: HistoryKindFilter): HistoryItem[] {
  const list = Array.isArray(items) ? items : [];
  if (filter === "all") return list.slice();
  return list.filter((g) => itemKind(g) === filter);
}

export function refillPayload(g: HistoryItem): {
  kind: GenerationKind;
  model: string;
  prompt: string;
  durationSec: 5 | 10;
  imageUrl: string;
  lastImageUrl: string;
} {
  const kind = itemKind(g);
  const durationSec: 5 | 10 = Number(g.duration_sec) === 10 ? 10 : 5;
  return {
    kind,
    model: itemModel(g),
    prompt: String(g.prompt || ""),
    durationSec,
    imageUrl: String(g.input_image_url || ""),
    lastImageUrl: String(g.last_image_url || ""),
  };
}
