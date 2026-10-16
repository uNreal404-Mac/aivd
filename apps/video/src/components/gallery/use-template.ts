"use client";

import type { useRouter } from "next/navigation";

import { localizedHref } from "@/lib/du-home";

/** Router instance returned by `useRouter`, without importing client-only code. */
type AppRouter = ReturnType<typeof useRouter>;

/** `sessionStorage` keys shared with the tool pages. */
export const TOOL_PREFILL_KEY = "videofly_tool_prefill";
export const TOOL_PREFILL_NOTICE_KEY = "videofly_tool_prefill_notice";

/** Shape returned by `GET /api/v1/gallery/[uuid]/template`. */
export interface GalleryTemplateResponse {
  prompt: string;
  model: string | null;
  modelUnavailable: boolean;
  originalModel: string;
  duration: number | null;
  aspectRatio: string | null;
  quality: string | null;
  imageUrl?: string;
  needsOwnImage: boolean;
}

/** Prefill payload consumed by the generation tools. */
export interface ToolPrefill {
  prompt: string;
  model?: string;
  duration?: number;
  aspectRatio?: string;
  quality?: string;
  imageUrl?: string;
}

/** One-shot notice consumed (and dismissed) by the tool layout. */
export interface ToolPrefillNotice {
  modelUnavailable: boolean;
  originalModel: string;
  needsOwnImage: boolean;
}

/** Unwrap `{ data }` API envelopes, falling back to the raw payload. */
export function unwrapApiData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function buildPrefill(template: GalleryTemplateResponse): ToolPrefill {
  const prefill: ToolPrefill = { prompt: template.prompt };

  if (!template.modelUnavailable && template.model) {
    prefill.model = template.model;
  }
  if (template.duration != null) prefill.duration = template.duration;
  if (template.aspectRatio) prefill.aspectRatio = template.aspectRatio;
  if (template.quality) prefill.quality = template.quality;
  if (template.imageUrl) prefill.imageUrl = template.imageUrl;

  return prefill;
}

/**
 * Load the "Use Template" payload for a public work, stash it for the tool
 * pages and navigate to the matching generator. Returns `false` when the
 * template could not be loaded so callers can surface an error.
 */
export async function applyTemplate(
  uuid: string,
  router: AppRouter,
  locale: string
): Promise<boolean> {
  try {
    const response = await fetch(`/api/v1/gallery/${uuid}/template`, {
      cache: "no-store",
    });
    if (!response.ok) return false;

    const template = unwrapApiData<GalleryTemplateResponse>(
      await response.json()
    );
    const prefill = buildPrefill(template);
    const notice: ToolPrefillNotice = {
      modelUnavailable: template.modelUnavailable,
      originalModel: template.originalModel,
      needsOwnImage: template.needsOwnImage,
    };

    sessionStorage.setItem(TOOL_PREFILL_KEY, JSON.stringify(prefill));
    sessionStorage.setItem(TOOL_PREFILL_NOTICE_KEY, JSON.stringify(notice));

    const href =
      prefill.imageUrl || template.needsOwnImage
        ? "/image-to-video"
        : "/text-to-video";
    router.push(localizedHref(locale, href));

    return true;
  } catch {
    return false;
  }
}
