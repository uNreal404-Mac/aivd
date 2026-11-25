import { getModelConfig } from "@/config/credits";

/**
 * Image-to-video: shared constants, client-side validation and request
 * helpers. Everything in here is intentionally free of React so it can be
 * unit tested directly.
 */

/** Master switch. While `false` no generation request is ever sent. */
export function isI2VGenerationEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.VIDEO_GENERATION_ENABLED === "true";
}

export const I2V_MODEL_IDS = [
  "seedance-1.5-pro",
  "wan2.6",
  "veo-3.1",
  "sora-2",
] as const;

export type I2VModelId = (typeof I2V_MODEL_IDS)[number];

export interface I2VModel {
  id: I2VModelId;
  label: string;
  durations: number[];
  aspectRatios: string[];
}

export const I2V_MODELS: I2VModel[] = I2V_MODEL_IDS.map((id) => {
  const config = getModelConfig(id);
  return {
    id,
    label: config?.name ?? id,
    durations: config?.durations ?? [],
    aspectRatios: config?.aspectRatios ?? [],
  };
});

/** Durations allowed for a model, read from the shared credit config. */
export function durationsFor(modelId: string): number[] {
  return I2V_MODELS.find((model) => model.id === modelId)?.durations ?? [];
}

/** Aspect ratios allowed for a model, read from the shared credit config. */
export function aspectRatiosFor(modelId: string): string[] {
  return I2V_MODELS.find((model) => model.id === modelId)?.aspectRatios ?? [];
}

/**
 * Snaps a duration/aspect-ratio pair onto the model's allowed values,
 * falling back to the first option when the current one is not supported.
 */
export function normalizeSettings(
  modelId: string,
  duration: number,
  aspectRatio: string,
): { duration: number; aspectRatio: string } {
  const durations = durationsFor(modelId);
  const aspectRatios = aspectRatiosFor(modelId);

  return {
    duration: durations.includes(duration) ? duration : durations[0],
    aspectRatio: aspectRatios.includes(aspectRatio)
      ? aspectRatio
      : aspectRatios[0],
  };
}

export const ALLOWED_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

/** 10MB */
export const MAX_BYTES = 10 * 1024 * 1024;

/** Endpoints used by the studio. */
export const UPLOAD_ENDPOINT = "/api/v1/upload";
export const GENERATE_ENDPOINT = "/api/v1/video/generate";

/* -------------------------------------------------------------------------- */
/* Upload errors                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Stable reasons an image upload can fail. Code compares these; people read
 * them through uploadErrorText, in the page's language, with a next step.
 */
export type UploadErrorCode =
  | "not_image"
  | "unsupported_type"
  | "too_large"
  | "unauthorized"
  | "upload_unavailable"
  | "upload_failed"
  | "content_blocked"
  | "missing_item";

const MAX_MB = MAX_BYTES / 1024 / 1024;

const UPLOAD_ERROR_TEXT: Record<UploadErrorCode, { zh: string; en: string }> = {
  not_image: { zh: "请选择图片文件", en: "Choose an image file." },
  unsupported_type: {
    zh: "不支持这个图片格式，请换用 JPG、PNG、WebP 或 GIF",
    en: "That format isn't supported. Use a JPG, PNG, WebP or GIF.",
  },
  too_large: {
    zh: `图片超过 ${MAX_MB} MB，请换一张小一点的`,
    en: `That image is over ${MAX_MB} MB. Choose a smaller one.`,
  },
  unauthorized: { zh: "请先登录再上传", en: "Sign in to upload." },
  upload_unavailable: {
    zh: "暂时无法上传，请稍后再试",
    en: "Uploads aren't available right now. Try again later.",
  },
  upload_failed: { zh: "上传失败，请重试", en: "Upload failed. Try again." },
  content_blocked: {
    zh: "这张图片没有通过内容审核，请换一张",
    en: "This image didn't pass the content check. Try a different one.",
  },
  missing_item: {
    zh: "这张图片已失效，请重新上传",
    en: "This image is no longer available. Upload it again.",
  },
};

export function isUploadErrorCode(value: unknown): value is UploadErrorCode {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(UPLOAD_ERROR_TEXT, value)
  );
}

/** Thrown when a picked image cannot be made ready. `message` is English. */
export class UploadError extends Error {
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode) {
    super(UPLOAD_ERROR_TEXT[code].en);
    this.name = "UploadError";
    this.code = code;
  }
}

/**
 * What to tell the reader about an upload problem, in their language.
 * Accepts a code, an UploadFailure, an UploadError, or anything else that
 * was thrown (which reads as a plain "upload failed, try again").
 * `lang` is a locale ("zh", "en-US") or the usual `zh` flag.
 */
export function uploadErrorText(reason: unknown, lang: string | boolean): string {
  const zh =
    typeof lang === "boolean" ? lang : lang.toLowerCase().startsWith("zh");
  const nested =
    reason && typeof reason === "object"
      ? (reason as { code?: unknown }).code
      : undefined;
  const code: UploadErrorCode = isUploadErrorCode(reason)
    ? reason
    : isUploadErrorCode(nested)
      ? nested
      : "upload_failed";
  return UPLOAD_ERROR_TEXT[code][zh ? "zh" : "en"];
}

/* -------------------------------------------------------------------------- */
/* File validation                                                            */
/* -------------------------------------------------------------------------- */

export interface ImageFileLike {
  type: string;
  size: number;
}

/** Why a file can't be uploaded as an image, or `null` when it can. */
export function imageFileError(
  file: ImageFileLike | null | undefined,
): UploadErrorCode | null {
  if (!file || !file.type?.startsWith("image/")) {
    return "not_image";
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return "unsupported_type";
  }

  if (file.size > MAX_BYTES) {
    return "too_large";
  }

  return null;
}

/**
 * Inline error text for a file, or `null` when it is acceptable. English
 * unless a locale or `zh` flag is passed.
 */
export function validateImageFile(
  file: ImageFileLike | null | undefined,
  lang: string | boolean = "en",
): string | null {
  const code = imageFileError(file);
  return code ? uploadErrorText(code, lang) : null;
}

/* -------------------------------------------------------------------------- */
/* Upload                                                                     */
/* -------------------------------------------------------------------------- */

export interface UploadSuccess {
  ok: true;
  key: string;
  url: string;
}

export interface UploadFailure {
  ok: false;
  code: UploadErrorCode;
  /** English text for the code; show uploadErrorText(result, lang) instead. */
  message: string;
}

export type UploadResult = UploadSuccess | UploadFailure;

interface UploadEnvelope {
  success?: boolean;
  data?: {
    key?: string;
    signedUrl?: string;
    publicUrl?: string;
    expiresIn?: number;
  };
  error?: { message?: string; details?: { code?: string } };
}

function uploadFailure(code: UploadErrorCode): UploadFailure {
  return { ok: false, code, message: UPLOAD_ERROR_TEXT[code].en };
}

/** Maps a raw upload response onto a stable, UI-friendly result. */
export function parseUploadResponse(status: number, json: unknown): UploadResult {
  if (status === 401) {
    return uploadFailure("unauthorized");
  }

  if (status === 503) {
    return uploadFailure("upload_unavailable");
  }

  const payload = (json ?? null) as UploadEnvelope | null;
  const isSuccessStatus = status >= 200 && status < 300;

  if (isSuccessStatus && payload && payload.success !== false) {
    const key = payload.data?.key;

    if (typeof key === "string" && key.length > 0) {
      const url = payload.data?.signedUrl ?? payload.data?.publicUrl ?? "";
      return { ok: true, key, url };
    }
  }

  if (status === 422 || payload?.error?.details?.code === "CONTENT_BLOCKED") {
    return uploadFailure("content_blocked");
  }

  // The route rejects these before storing anything; the browser checks
  // first, so they only show if the two ever disagree.
  const message = payload?.error?.message ?? "";
  if (status === 413 || /too large/i.test(message)) {
    return uploadFailure("too_large");
  }
  if (status === 415 || /content type/i.test(message)) {
    return uploadFailure("unsupported_type");
  }

  return uploadFailure("upload_failed");
}

/** Minimal structural type so tests can pass a stub in place of `fetch`. */
export interface FetchResponseLike {
  status: number;
  json: () => Promise<unknown>;
}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<FetchResponseLike>;

async function readJson(response: FetchResponseLike): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/** POSTs the file as multipart/form-data and normalises the result. */
export async function uploadImage(
  file: File,
  fetchFn: FetchLike = fetch,
  expectedAccount?: string,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  try {
    const response = await fetchFn(UPLOAD_ENDPOINT, {
      method: "POST",
      ...(expectedAccount ? { headers: { "X-Media-Account": expectedAccount } } : {}),
      body: form,
    });

    return parseUploadResponse(response.status, await readJson(response));
  } catch {
    return uploadFailure("upload_failed");
  }
}

/* -------------------------------------------------------------------------- */
/* Submit                                                                     */
/* -------------------------------------------------------------------------- */

export interface I2VFormState {
  imageKey: string | null;
  prompt: string;
  uploading?: boolean;
}

export const MAX_PROMPT_LENGTH = 1000;

/**
 * Form-level validity only. The caller is also responsible for checking
 * `I2V_GENERATION_ENABLED` before enabling the generate button.
 */
export function canSubmit(state: I2VFormState): boolean {
  if (state.uploading) {
    return false;
  }

  if (!state.imageKey) {
    return false;
  }

  const prompt = state.prompt.trim();

  if (prompt.length === 0) {
    return false;
  }

  if (state.prompt.length > MAX_PROMPT_LENGTH) {
    return false;
  }

  return true;
}

export interface GenerateVideoBody {
  model: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  imageKey: string;
}

export type SubmitResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; reason: "disabled" }
  | { ok: false; reason: "error"; message: string };

export interface SubmitOptions {
  enabled: boolean;
  fetchFn?: FetchLike;
  idempotencyKey?: string;
}

/** Generates a fresh key so retries of the same submit stay unique. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

export async function submitImageToVideo(
  body: GenerateVideoBody,
  options: SubmitOptions,
): Promise<SubmitResult> {
  if (!options.enabled) {
    return { ok: false, reason: "disabled" };
  }

  const fetchFn = options.fetchFn ?? fetch;

  try {
    const response = await fetchFn(GENERATE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": options.idempotencyKey ?? crypto.randomUUID(),
      },
      body: JSON.stringify(body),
    });

    const data = await readJson(response);

    if (response.status >= 200 && response.status < 300) {
      return { ok: true, status: response.status, data };
    }

    const message = (data as { error?: { message?: string } } | null)?.error
      ?.message;

    return {
      ok: false,
      reason: "error",
      message:
        typeof message === "string" && message.trim().length > 0
          ? message
          : "Generation request failed. Please try again.",
    };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: "Generation request failed. Please try again.",
    };
  }
}
