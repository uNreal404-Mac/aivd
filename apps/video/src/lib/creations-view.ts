import type { VideoStatus } from "@/lib/types/dashboard";

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

// ============================================
// Constants
// ============================================

export const VIEW_MODE_STORAGE_KEY = "du.creations.view";

export const DEFAULT_VIEW_MODE: CreationsViewMode = "grid";

export const STATUS_TABS: readonly StatusTab[] = [
  "all",
  "queued",
  "generating",
  "done",
  "failed",
] as const;

const MODEL_LABELS: Readonly<Record<string, string>> = {
  "seedance-1.5-pro": "Seedance 1.5 Pro",
  "wan2.6": "Wan 2.6",
  "wan-2.6": "Wan 2.6",
  "veo-3.1": "Veo 3.1",
  "sora-2": "Sora 2",
};

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
  return MODEL_LABELS[modelId] ?? modelId;
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
