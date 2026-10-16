/**
 * Image-to-video: shared constants, client-side validation and request
 * helpers. Everything in here is intentionally free of React so it can be
 * unit tested directly.
 */

/** Master switch. While `false` no generation request is ever sent. */
export const I2V_GENERATION_ENABLED: boolean = false;

export const I2V_MODELS = [
  { id: "seedance-1.5-pro", label: "Seedance 1.5 Pro" },
  { id: "wan-2.6", label: "Wan 2.6" },
  { id: "veo-3.1", label: "Veo 3.1" },
  { id: "sora-2", label: "Sora 2" },
] as const;

export type I2VModelId = (typeof I2V_MODELS)[number]["id"];

export const DURATIONS = [5, 10] as const;
export type I2VDuration = (typeof DURATIONS)[number];

export const ASPECT_RATIOS = ["16:9", "9:16", "1:1"] as const;
export type I2VAspectRatio = (typeof ASPECT_RATIOS)[number];

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
export function validateImageFile(file: ImageFileLike): string | null {
  if (!file) {
    return "Please choose an image file.";
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return "That file type is not supported. Use a JPG, PNG, WEBP or GIF.";
  }

  if (file.size > MAX_BYTES) {
    return "That image is larger than 10MB. Please choose a smaller file.";
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
export function parseUploadResponse(status: number, json: unknown): UploadResult {
  if (status === 401) {
    return { ok: false, message: "Sign in to upload" };
  }

  if (status === 503) {
    return { ok: false, message: "Uploads are not available yet" };
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
        : "Upload failed. Please try again.",
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
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);

  try {
    const response = await fetchFn(UPLOAD_ENDPOINT, {
      method: "POST",
      body: form,
    });

    return parseUploadResponse(response.status, await readJson(response));
  } catch {
    return { ok: false, message: "Upload failed. Please try again." };
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

export async function submitImageToVideo(
  body: GenerateVideoBody,
  fetchFn: FetchLike = fetch,
): Promise<SubmitResult> {
  if (!I2V_GENERATION_ENABLED) {
    return { ok: false, reason: "disabled" };
  }

  try {
    const response = await fetchFn(GENERATE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
