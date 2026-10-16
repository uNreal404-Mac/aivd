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

/* -------------------------------------------------------------------------- */
/* Copy                                                                       */
/* -------------------------------------------------------------------------- */

export interface I2VCopy {
  title: string;
  subtitle: string;
  sourceImageLabel: string;
  uploading: string;
  dropzoneTitle: string;
  /** `{size}` is replaced with the max upload size in MB. */
  dropzoneHint: string;
  /** `{size}` is replaced with the max upload size in MB. */
  imageHelp: string;
  previewAlt: string;
  fallbackFileName: string;
  replace: string;
  remove: string;
  promptLabel: string;
  promptPlaceholder: string;
  modelLabel: string;
  durationLegend: string;
  aspectRatioLegend: string;
  generate: string;
  generationPaused: string;
  generationClosed: string;
  sending: string;
  stageEmptyText: string;
  tipsTitle: string;
  tip1: string;
  tip2: string;
  tip3: string;
  noFile: string;
  invalidType: string;
  tooLarge: string;
  signInToUpload: string;
  uploadsUnavailable: string;
  uploadFailed: string;
  generationFailed: string;
}

export const I2V_COPY: { en: I2VCopy; zh: I2VCopy } = {
  en: {
    title: "Image to Video",
    subtitle:
      "Bring a still frame to life with a short, directed camera move.",
    sourceImageLabel: "Source image",
    uploading: "Uploading…",
    dropzoneTitle: "Drop an image or click to browse",
    dropzoneHint: "JPG, PNG, WEBP or GIF, up to {size}MB",
    imageHelp: "One image up to {size}MB. Wide or square frames work best.",
    previewAlt: "Your uploaded keyframe",
    fallbackFileName: "Uploaded image",
    replace: "Replace",
    remove: "Remove",
    promptLabel: "Describe the motion",
    promptPlaceholder: "Slow push in while the subject turns toward the light",
    modelLabel: "Model",
    durationLegend: "Duration",
    aspectRatioLegend: "Aspect ratio",
    generate: "Generate video",
    generationPaused: "Generation is paused",
    generationClosed: "Video generation is not open yet.",
    sending: "Sending…",
    stageEmptyText: "Your video will appear here",
    tipsTitle: "Tips",
    tip1: "Describe the camera move, not only the subject.",
    tip2: "Keep the motion small so the subject stays recognisable.",
    tip3: "Name the light or mood to steer the final look.",
    noFile: "Please choose an image file.",
    invalidType: "That file type is not supported. Use a JPG, PNG, WEBP or GIF.",
    tooLarge: "That image is larger than 10MB. Please choose a smaller file.",
    signInToUpload: "Sign in to upload",
    uploadsUnavailable: "Uploads are not available yet",
    uploadFailed: "Upload failed. Please try again.",
    generationFailed: "Generation request failed. Please try again.",
  },
  zh: {
    title: "图生视频",
    subtitle: "用一段简短、有方向的镜头运动，让静帧活起来。",
    sourceImageLabel: "源图片",
    uploading: "上传中…",
    dropzoneTitle: "拖入图片，或点击选择文件",
    dropzoneHint: "JPG、PNG、WEBP 或 GIF，最大 {size}MB",
    imageHelp: "一张图片，最大 {size}MB。宽画幅或方形构图效果最佳。",
    previewAlt: "你上传的关键帧",
    fallbackFileName: "已上传的图片",
    replace: "替换",
    remove: "删除",
    promptLabel: "描述画面运动",
    promptPlaceholder: "镜头缓慢推近，主体转向光源",
    modelLabel: "模型",
    durationLegend: "时长",
    aspectRatioLegend: "画面比例",
    generate: "生成视频",
    generationPaused: "生成功能已暂停",
    generationClosed: "视频生成功能尚未开放。",
    sending: "发送中…",
    stageEmptyText: "你的视频将在这里显示",
    tipsTitle: "小贴士",
    tip1: "描述镜头运动，而不只是主体。",
    tip2: "运动幅度小一些，主体更容易保持清晰。",
    tip3: "点明光线或氛围，引导最终画面风格。",
    noFile: "请选择一张图片文件。",
    invalidType: "不支持该文件类型。请使用 JPG、PNG、WEBP 或 GIF。",
    tooLarge: "该图片超过 10MB，请选择更小的文件。",
    signInToUpload: "请登录后上传",
    uploadsUnavailable: "上传功能暂不可用",
    uploadFailed: "上传失败，请重试。",
    generationFailed: "生成请求失败，请重试。",
  },
};

/** Returns the copy for a locale, falling back to English. */
export function i2vCopy(locale: string): I2VCopy {
  return locale === "zh" ? I2V_COPY.zh : I2V_COPY.en;
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
/* File validation                                                            */
/* -------------------------------------------------------------------------- */

export interface ImageFileLike {
  type: string;
  size: number;
}

/** Returns an inline error message, or `null` when the file is acceptable. */
export function validateImageFile(
  file: ImageFileLike,
  copy: I2VCopy = I2V_COPY.en,
): string | null {
  if (!file) {
    return copy.noFile;
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return copy.invalidType;
  }

  if (file.size > MAX_BYTES) {
    return copy.tooLarge;
  }

  return null;
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
  error?: { message?: string };
}

/** Maps a raw upload response onto a stable, UI-friendly result. */
export function parseUploadResponse(
  status: number,
  json: unknown,
  copy: I2VCopy = I2V_COPY.en,
): UploadResult {
  if (status === 401) {
    return { ok: false, message: copy.signInToUpload };
  }

  if (status === 503) {
    return { ok: false, message: copy.uploadsUnavailable };
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

  const message = payload?.error?.message;

  return {
    ok: false,
    message:
      typeof message === "string" && message.trim().length > 0
        ? message
        : copy.uploadFailed,
  };
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
  copy: I2VCopy = I2V_COPY.en,
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  try {
    const response = await fetchFn(UPLOAD_ENDPOINT, {
      method: "POST",
      body: form,
    });

    return parseUploadResponse(response.status, await readJson(response), copy);
  } catch {
    return { ok: false, message: copy.uploadFailed };
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
  copy?: I2VCopy;
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
  const copy = options.copy ?? I2V_COPY.en;

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
          : copy.generationFailed,
    };
  } catch {
    return {
      ok: false,
      reason: "error",
      message: copy.generationFailed,
    };
  }
}
