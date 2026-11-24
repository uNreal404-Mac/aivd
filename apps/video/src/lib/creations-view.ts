import { MARKET_MODELS } from "@/ai/kie-market";
import { IMAGE_CATALOG, VIDEO_CATALOG } from "@/lib/kie-model-catalog";
import { localizedHref } from "@/lib/locale-path";
import type { CreationMediaType, Video, VideoStatus } from "@/lib/types/dashboard";

// ============================================
// Types
// ============================================

export type CreationsViewMode = "grid" | "list";

export type StatusTab = "all" | "queued" | "generating" | "done" | "failed";

export type StatusTag = "queued" | "generating" | "done" | "failed";

/** Filter value accepted by the existing `useVideos` hook / list API. */
export type CreationsFilterStatus = StatusTag | "all";

/** Minimal storage contract so helpers stay testable and SSR-safe. */
export interface ViewModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** What the library shows instead of cards, if anything. */
export type CreationsEmptyState = "none" | "loading" | "kind" | "filtered";

// ============================================
// Constants
// ============================================

export const VIEW_MODE_STORAGE_KEY = "du.creations.view";

export const DEFAULT_VIEW_MODE: CreationsViewMode = "grid";

export const KIND_STORAGE_KEY = "du.creations.kind";

export const DEFAULT_KIND: CreationMediaType = "video";

const KINDS: readonly CreationMediaType[] = ["video", "image", "audio"];

/** The audio studio's unsent-script draft (hooks/use-prompt-draft.ts, key "audio"). */
export const AUDIO_DRAFT_STORAGE_KEY = "aivd:draft:audio";

export const STATUS_TABS: readonly StatusTab[] = [
  "all",
  "queued",
  "generating",
  "done",
  "failed",
] as const;

/**
 * Display names by stored model id. The studios' own registries come first, so
 * a creation carries the same name the model menu and studio showed: the
 * models on sale (ai/kie-market), then the wider catalogue (wan2.6, veo-3.1,
 * sora-2 and models not connected yet), then ids only older records use.
 */
const LEGACY_MODEL_LABELS: Readonly<Record<string, string>> = {
  "wan-2.6": "Wan 2.6",
  "seedance-1.0-pro-fast": "Seedance 1.0 Pro Fast",
  "seedance-1.0-pro-quality": "Seedance 1.0 Pro Quality",
};

const MODEL_LABELS: ReadonlyMap<string, string> = new Map<string, string>([
  ...Object.entries(LEGACY_MODEL_LABELS),
  ...[...VIDEO_CATALOG, ...IMAGE_CATALOG].map((item): [string, string] => [item.id, item.name]),
  ...MARKET_MODELS.map((item): [string, string] => [item.id, item.name]),
]);

// ============================================
// Status helpers
// ============================================

/**
 * Maps a status tab to the status understood by the list API.
 * `UPLOADING` is intentionally not a tab of its own: it is presented
 * to the user as "generating".
 */
export function tabToFilterStatus(tab: StatusTab): CreationsFilterStatus {
  return tab === "all" ? "all" : tab;
}

/**
 * Maps a raw video status to its visual tag.
 * `UPLOADING` is shown as "generating"; unknown values fall back to "queued".
 */
export function statusTag(status: VideoStatus | string): StatusTag {
  switch (String(status).toUpperCase()) {
    case "PENDING":
      return "queued";
    case "GENERATING":
    case "UPLOADING":
      return "generating";
    case "COMPLETED":
      return "done";
    case "FAILED":
      return "failed";
    default:
      return "queued";
  }
}

/** True when a raw status belongs to the given tab (`all` matches everything). */
export function matchesTab(status: string, tab: StatusTab): boolean {
  return tab === "all" || statusTag(status) === tab;
}

// ============================================
// Formatting helpers
// ============================================

export function formatCreatedAt(
  date: Date | string | number,
  locale: string,
): string {
  const parsed = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function modelLabel(modelId: string): string {
  if (!modelId) {
    return "";
  }
  return MODEL_LABELS.get(modelId) ?? modelId;
}

// ============================================
// Empty states
// ============================================

/**
 * Which empty state to show. Status tabs filter the pages loaded so far, so a
 * filtered tab with nothing yet keeps loading while more pages exist; only
 * then does it say the filter is empty. With nothing of this type at all it
 * says so for the type, whatever the tab.
 */
export function emptyStateFor({
  total,
  visible,
  hasMore,
}: {
  total: number;
  visible: number;
  hasMore: boolean;
}): CreationsEmptyState {
  if (visible > 0) return "none";
  if (hasMore) return "loading";
  return total === 0 ? "kind" : "filtered";
}

// ============================================
// Generate again
// ============================================

/**
 * Studio link that starts a new generation from a creation, carrying over
 * what that studio accepts: prompt, model, length and aspect for video;
 * prompt, model and aspect for images; prompt and model for audio (the audio
 * studio keeps an unsent draft of its own and offers it back).
 * Null when there is no prompt to reuse.
 */
export function regenerateHref(
  video: Pick<Video, "prompt" | "model" | "duration" | "aspectRatio">,
  kind: CreationMediaType,
  locale: string,
): string | null {
  const prompt = video.prompt?.trim();
  if (!prompt) return null;
  const params = new URLSearchParams();
  if (kind === "audio") {
    if (video.model) params.set("audioModel", video.model);
    params.set("prompt", prompt);
    const query = params.toString();
    return localizedHref(locale, query ? `/audio?${query}` : "/audio");
  }
  params.set("prompt", prompt);
  if (video.model) params.set("model", video.model);
  if (kind === "video" && Number.isFinite(video.duration) && video.duration > 0) {
    params.set("duration", String(video.duration));
  }
  if (video.aspectRatio?.trim()) params.set("aspect", video.aspectRatio.trim());
  return localizedHref(locale, `${kind === "image" ? "/ai/image" : "/ai/video"}?${params}`);
}

// ============================================
// View mode persistence
// ============================================

export function readViewMode(
  storage: ViewModeStorage | null | undefined,
): CreationsViewMode {
  if (!storage) {
    return DEFAULT_VIEW_MODE;
  }
  try {
    const value = storage.getItem(VIEW_MODE_STORAGE_KEY);
    return value === "list" ? "list" : DEFAULT_VIEW_MODE;
  } catch {
    return DEFAULT_VIEW_MODE;
  }
}

export function readKind(
  storage: ViewModeStorage | null | undefined,
): CreationMediaType {
  if (!storage) {
    return DEFAULT_KIND;
  }
  try {
    const value = storage.getItem(KIND_STORAGE_KEY);
    return KINDS.find((kind) => kind === value) ?? DEFAULT_KIND;
  } catch {
    return DEFAULT_KIND;
  }
}

export function writeKind(
  storage: ViewModeStorage | null | undefined,
  kind: CreationMediaType,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(KIND_STORAGE_KEY, KINDS.includes(kind) ? kind : DEFAULT_KIND);
  } catch {
    // Storage can be unavailable (private mode, quota, etc.) — ignore.
  }
}

export function writeViewMode(
  storage: ViewModeStorage | null | undefined,
  mode: CreationsViewMode,
): void {
  if (!storage) {
    return;
  }
  try {
    storage.setItem(VIEW_MODE_STORAGE_KEY, mode === "list" ? "list" : "grid");
  } catch {
    // Storage can be unavailable (private mode, quota, etc.) — ignore.
  }
}
