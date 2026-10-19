import { z } from "zod";

import type { Video } from "@/db/schema";

/** Maximum length of a gallery card title. */
export const GALLERY_TITLE_MAX = 100;
/** Maximum length of an optional gallery description. */
export const GALLERY_DESCRIPTION_MAX = 500;
/** Maximum length of the prompt a super account may expose publicly. */
export const GALLERY_PUBLIC_PROMPT_MAX = 5000;
/** Title length the publish dialog pre-fills from the prompt. */
export const GALLERY_FALLBACK_TITLE_LENGTH = 60;
/** Shown when a work has no author name (or the name looks like an email). */
export const ANONYMOUS_AUTHOR = "Anonymous";
/** Shown when a work has neither a title nor a prompt we may reuse. */
export const UNTITLED_TITLE = "Untitled";

/** Postgres codes raised when migration 0003_gallery.sql has not been applied. */
const MISSING_SCHEMA_ERROR_CODES = ["42703", "42P01"] as const;
/** Fallback for drivers that only surface a human-readable message. */
const MISSING_SCHEMA_MESSAGE_PATTERN =
  /column .* does not exist|relation .* does not exist/i;

/**
 * Whether an error means the gallery migration has not been applied yet.
 * Drizzle wraps driver failures, so we walk up to three `cause` levels and
 * accept either a Postgres code or the matching message.
 */
export function isMissingGallerySchemaError(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) break;

    const candidate = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };

    if (
      typeof candidate.code === "string" &&
      (MISSING_SCHEMA_ERROR_CODES as readonly string[]).includes(candidate.code)
    ) {
      return true;
    }

    if (
      typeof candidate.message === "string" &&
      MISSING_SCHEMA_MESSAGE_PATTERN.test(candidate.message)
    ) {
      return true;
    }

    current = candidate.cause;
  }

  return false;
}

/**
 * Payload accepted by the publish endpoint. `title` is always required; every
 * other field is optional because a normal account may not set it at all.
 */
export const publishInputSchema = z.object({
  title: z.string().trim().min(1).max(GALLERY_TITLE_MAX),
  description: z.string().trim().max(GALLERY_DESCRIPTION_MAX).optional(),
  publicPrompt: z.string().trim().max(GALLERY_PUBLIC_PROMPT_MAX).optional(),
  protectPrompt: z.boolean().optional(),
  allowAssetReuse: z.boolean().optional(),
});

export type PublishInput = z.infer<typeof publishInputSchema>;

/** A `videos` row plus the author's display name (never the author's email). */
export type GallerySourceRow = Video & { authorName?: string | null };

/** Everything the gallery UI is allowed to see about a published work. */
export interface GalleryItem {
  uuid: string;
  title: string;
  description: string | null;
  authorName: string;
  model: string;
  modelLabel: string;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  /** `null` when the author protected an empty prompt. */
  publicPrompt: string | null;
  promptProtected: boolean;
  aspectRatio: string | null;
  duration: number | null;
  resolution: string | null;
  publishedAt: Date | null;
  assetsReusable: boolean;
  /** Whether the original generation had a start image at all. */
  hasStartImage: boolean;
  /** Only populated when the author allowed reuse. */
  startImageUrl: string | null;
}

export interface ResolvePublishFieldsParams {
  isSuperAccount: boolean;
  originalPrompt: string;
  input: PublishInput;
}

export interface ResolvedPublishFields {
  galleryTitle: string;
  galleryDescription: string | null;
  publicPrompt: string;
  promptProtected: boolean;
  assetsReusable: boolean;
}

export type PublishDenialCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "NOT_COMPLETED"
  | "ALREADY_PUBLISHED";

export type CanPublishResult =
  | { ok: true }
  | { ok: false; code: PublishDenialCode };

/** Prefill payload consumed by the "Use Template" flow. */
export interface GalleryTemplate {
  prompt: string;
  model: string | null;
  modelUnavailable: boolean;
  originalModel: string;
  duration: number | null;
  aspectRatio: string | null;
  quality: string | null;
  /** Present only when the author allowed reuse of the input image. */
  imageUrl?: string;
  needsOwnImage: boolean;
}

const QUALITY_LABELS: Record<string, string> = {
  "480p": "480p",
  "540p": "540p",
  "720p": "720p",
  "1080p": "1080p",
  "1440p": "1440p",
  "2160p": "4k",
  "4k": "4k",
};

function truncateText(value: string | null | undefined, max: number): string {
  const text = (value ?? "").trim();
  return text.length > max ? text.slice(0, max) : text;
}

function capitalizeSegment(segment: string): string {
  if (/\d/.test(segment)) return segment.toUpperCase();
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/** Human readable label for a model id, with no external catalog lookup. */
export function modelLabelFor(model: string): string {
  return (model ?? "")
    .trim()
    .split(/[-_/\s]+/)
    .filter(Boolean)
    .map(capitalizeSegment)
    .join(" ");
}

/** Map a stored resolution onto a supported quality name, or `null`. */
export function qualityFromResolution(
  resolution: string | null | undefined
): string | null {
  if (!resolution) return null;

  const normalized = resolution.trim().toLowerCase();
  if (!normalized) return null;

  const direct = QUALITY_LABELS[normalized];
  if (direct) return direct;

  const numbers = normalized.match(/\d{3,4}/g);
  if (!numbers?.length) return null;

  const height = numbers[numbers.length - 1];
  return QUALITY_LABELS[`${height}p`] ?? null;
}

function resolveAuthorName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.includes("@")) return ANONYMOUS_AUTHOR;
  return trimmed;
}

/**
 * Decide which prompt/asset fields are actually stored when a video is
 * published. Normal accounts always publish their original prompt; only super
 * accounts may protect it and provide a replacement prompt.
 */
export function resolvePublishFields({
  isSuperAccount,
  originalPrompt,
  input,
}: ResolvePublishFieldsParams): ResolvedPublishFields {
  const promptProtected = Boolean(isSuperAccount) && Boolean(input.protectPrompt);

  const title = (input.title ?? "").trim().slice(0, GALLERY_TITLE_MAX);
  const galleryTitle =
    title ||
    (promptProtected
      ? UNTITLED_TITLE
      : truncateText(originalPrompt, GALLERY_TITLE_MAX)) ||
    UNTITLED_TITLE;

  const description = (input.description ?? "").trim().slice(0, GALLERY_DESCRIPTION_MAX);

  return {
    galleryTitle,
    galleryDescription: description || null,
    publicPrompt: promptProtected
      ? (input.publicPrompt ?? "").trim().slice(0, GALLERY_PUBLIC_PROMPT_MAX)
      : originalPrompt,
    promptProtected,
    assetsReusable: Boolean(input.allowAssetReuse),
  };
}

/** Whether the given user may publish the given video right now. */
export function canPublish(
  video: GallerySourceRow | null | undefined,
  userId: string
): CanPublishResult {
  if (!video || video.isDeleted) return { ok: false, code: "NOT_FOUND" };
  if (video.userId !== userId) return { ok: false, code: "FORBIDDEN" };
  if (video.status !== "COMPLETED" || !video.videoUrl) {
    return { ok: false, code: "NOT_COMPLETED" };
  }
  if (video.visibility === "public") {
    return { ok: false, code: "ALREADY_PUBLISHED" };
  }
  return { ok: true };
}

/**
 * Project a database row down to the public gallery shape. Never exposes the
 * author's email or user id, never leaks a protected prompt, and hides the
 * start image unless the author explicitly allowed reuse.
 */
export function toGalleryItem(row: GallerySourceRow): GalleryItem {
  const promptProtected = Boolean(row.promptProtected);
  const assetsReusable = Boolean(row.assetsReusable);
  const startImageUrl = row.startImageUrl ?? null;

  const storedPrompt = row.publicPrompt?.trim() ? row.publicPrompt : null;
  const publicPrompt = promptProtected
    ? storedPrompt
    : storedPrompt ?? row.prompt;

  const title =
    row.galleryTitle?.trim() ||
    (promptProtected ? UNTITLED_TITLE : truncateText(row.prompt, GALLERY_TITLE_MAX)) ||
    UNTITLED_TITLE;

  const description = row.galleryDescription?.trim() || null;

  return {
    uuid: row.uuid,
    title,
    description,
    authorName: resolveAuthorName(row.authorName),
    model: row.model,
    modelLabel: modelLabelFor(row.model),
    thumbnailUrl: row.thumbnailUrl ?? null,
    videoUrl: row.videoUrl ?? null,
    publicPrompt,
    promptProtected,
    aspectRatio: row.aspectRatio ?? null,
    duration: row.duration ?? null,
    resolution: row.resolution ?? null,
    publishedAt: row.publishedAt ?? null,
    assetsReusable,
    hasStartImage: Boolean(startImageUrl),
    startImageUrl: assetsReusable ? startImageUrl : null,
  };
}

/**
 * Build the "Use Template" prefill payload. The model is dropped when it is no
 * longer offered, and the author's input image is only passed through when
 * reuse was allowed.
 */
export function buildTemplate(
  item: GalleryItem,
  availableModelIds: readonly string[]
): GalleryTemplate {
  const modelUnavailable = !availableModelIds.includes(item.model);
  const reusableImageUrl =
    item.assetsReusable && item.startImageUrl ? item.startImageUrl : null;

  const template: GalleryTemplate = {
    prompt: item.publicPrompt ?? "",
    model: modelUnavailable ? null : item.model,
    modelUnavailable,
    originalModel: item.model,
    duration: item.duration,
    aspectRatio: item.aspectRatio,
    quality: qualityFromResolution(item.resolution),
    needsOwnImage: item.hasStartImage && !reusableImageUrl,
  };

  if (reusableImageUrl) {
    template.imageUrl = reusableImageUrl;
  }

  return template;
}
