"use client";

// Client helpers shared by the image and audio studios: submit a market
// generation, poll it to completion and load the user's recent results.
import { useCallback, useEffect, useRef, useState } from "react";
import { toMillis } from "@/lib/ai-video-studio";

export type MediaKind = "image" | "audio";
export type MediaJobStatus = "queued" | "generating" | "completed" | "failed";

export type MediaJob = {
  uuid: string;
  status: MediaJobStatus;
  urls: string[];
  prompt: string;
  model?: string;
  message?: string | null;
  /** When the job was submitted (ms), for the elapsed timer. */
  createdAt?: number;
};

export type SubmitBody = {
  model: string;
  prompt: string;
  aspectRatio?: string;
  resolution?: string;
  count?: number;
  imageUrls?: string[];
  voice?: string;
  style?: string;
  instrumental?: boolean;
  customMode?: boolean;
  speed?: number;
};

const POLL_MS = 3000;

function toStatus(value: unknown): MediaJobStatus {
  if (value === "COMPLETED") return "completed";
  if (value === "FAILED") return "failed";
  if (value === "GENERATING" || value === "UPLOADING") return "generating";
  return "queued";
}

/** Readable message for an API error code, in the page's language. */
export function errorMessage(code: string | undefined, fallback: string, zh: boolean): string {
  switch (code) {
    case "UNAUTHORIZED":
      return zh ? "请先登录再生成。" : "Sign in to generate.";
    case "INVALID_VIDEO_REFERENCE":
      return zh ? "请选择自己上传的 MP4 或 MOV，每个不超过 10 MB，最多 3 个。" : "Choose up to three of your own MP4 or MOV uploads, 10 MB each.";
    case "INSUFFICIENT_CREDITS":
      return zh ? "积分不够，可以换个省积分的模型，或购买积分" : "Not enough credits. Switch to a lower-cost model or buy credits.";
    case "GENERATION_DISABLED":
      return zh ? "预览站暂未开放生成，没有扣除积分。" : "Generation is not open on this preview. No credits were used.";
    case "NETWORK":
      return zh ? "网络不稳定，没有提交成功，请再试一次。" : "The connection dropped before it went through. Please try again.";
    case "CONCURRENCY_LIMIT": {
      // The server's message carries the plan's limit as its only number.
      const limit = /\d+/.exec(fallback)?.[0];
      if (zh) {
        return limit
          ? `你已有 ${limit} 个视频正在生成。等其中一个完成后再提交，或升级套餐以同时生成更多。`
          : "正在生成的视频数已达套餐上限。等其中一个完成后再提交，或升级套餐以同时生成更多。";
      }
      return fallback || "You have reached your plan's limit of videos generating at once. Wait for one to finish, or upgrade for more at once.";
    }
    case "PROMPT_TOO_LONG":
      return zh ? "提示词太长了，最多 5000 字。" : "The prompt is too long: 5,000 characters at most.";
    case "SOURCE_VIDEO_UNAVAILABLE":
    case "MISSING_SOURCE_VIDEO":
      return zh ? "这段视频现在不能续写：它可能已删除，或还没生成完。" : "This video can't be extended: it may have been deleted or isn't finished yet.";
    case "SOURCE_VIDEO_UNVERIFIED":
      return zh ? "暂时无法确认源视频大小，请稍后重试。" : "Could not verify the source video size. Please try again.";
    case "EXTEND_REJECTED":
      return zh ? "服务商拒绝了这段视频或续写参数，积分已退回。" : "The provider rejected the video or extend options. Your credits were released.";
    case "SOURCE_VIDEO_TOO_LARGE":
      return zh ? "这段视频超过 50 MB，暂时不能续写。" : "This video is larger than 50 MB and can't be extended yet.";
    case "PROMPT_TOO_SHORT":
      return zh ? "再多写几个字，说说接下来发生什么。" : "Write a few more words about what happens next.";
    case "CONTENT_BLOCKED":
      return fallback;
    default:
      return fallback || (zh ? "生成失败，请稍后再试。" : "Generation failed. Please try again.");
  }
}

const MEDIA_ENDPOINT = "/api/v1/media/generate";
const UUID_KEY = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function legacyRequestHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}:${text.length}`;
}

// Older clients indexed by the JSON body in the studio's field order.
function legacyMediaKey(signature: string): string | null {
  const stored = sessionStorage.getItem("aivd:media-lost-answers");
  if (!stored) return null;
  const records = JSON.parse(stored);
  let record = records[legacyRequestHash(signature)];
  if (record === undefined) {
    const body = JSON.parse(signature);
    const oldSignature = JSON.stringify(body, [
      "model", "prompt", "aspectRatio", "resolution", "count", "imageUrls",
      "voice", "style", "instrumental", "customMode", "speed", ...Object.keys(body),
    ]);
    record = records[legacyRequestHash(oldSignature)];
  }
  if (record === undefined) return null;
  if (typeof record?.key !== "string") throw new Error("Invalid legacy retry key");
  return record.key;
}

/** Body for the video route's extend tool (see lib/video-extend.ts). */
export type ExtendSubmitBody = {
  model: string;
  prompt: string;
  sourceVideoUuid: string;
  duration: number;
  quality: string;
  generateAudio: boolean;
};

type SubmitResult = { ok: true; uuid: string; credits: number } | { ok: false; message: string; needsLogin?: boolean; code?: string; requiredCredits?: number };

type RetryReservation = {
  key: string;
  forget: () => void;
};

function saveRetryKey(slot: string, key: string): void {
  sessionStorage.setItem(slot, key);
  if (sessionStorage.getItem(slot) !== key) throw new Error("Retry key was not saved");
}

async function reserveRetryKey(
  accountId: string,
  endpoint: string,
  parameters: string,
  legacyMediaSignature: string | null,
): Promise<RetryReservation> {
  const identity = new TextEncoder().encode(JSON.stringify([accountId, endpoint, parameters]));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", identity));
  const isExtend = legacyMediaSignature === null;
  const prefix = isExtend ? "aivd:extend:" : "aivd:media:";
  const slot = prefix + Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const legacy = !isExtend && endpoint === MEDIA_ENDPOINT ? legacyMediaKey(legacyMediaSignature) : null;
  // The server scopes keys by user. Each account may need the old key once,
  // even if another account already recovered its own job in this tab.
  const migratedSlot = slot + ":legacy";
  const unmigrated = legacy && sessionStorage.getItem(migratedSlot) !== legacy ? legacy : null;
  const stored = sessionStorage.getItem(slot);
  const key = stored ?? unmigrated ?? crypto.randomUUID();
  if (!UUID_KEY.test(key) && (isExtend || !/^\d{1,16}$/.test(key))) {
    throw new Error("Invalid retry key");
  }
  if (stored === null) saveRetryKey(slot, key);
  if (key === unmigrated) saveRetryKey(migratedSlot, key);
  return {
    key,
    forget: () => {
      // A late response must not clear a newer reservation.
      try {
        if (sessionStorage.getItem(slot) === key) sessionStorage.removeItem(slot);
      } catch {
        // The outcome is still known. Leaving the key behind only replays it.
      }
    },
  };
}

export async function submitMedia(
  body: SubmitBody | ExtendSubmitBody,
  zh: boolean,
  endpoint = MEDIA_ENDPOINT,
): Promise<SubmitResult> {
  const isExtend = "sourceVideoUuid" in body;
  const original = JSON.stringify(body);
  // Preserve the existing extend slot format. Media options are flat fields
  // or arrays of strings, so sorting field names preserves reference order.
  const signature = isExtend ? original : JSON.stringify(body, Object.keys(body).sort());
  let retry: RetryReservation;
  const networkError = zh ? "网络错误，请稍后重试。" : "Network error. Please try again.";
  let accountId: string | undefined;
  try {
    const { getSession } = await import("@/lib/auth/client");
    const session = await getSession();
    if (session.error) return { ok: false, message: networkError };
    accountId = session.data?.user.id;
  } catch {
    return { ok: false, message: networkError };
  }
  if (!accountId) return { ok: false, message: errorMessage("UNAUTHORIZED", "", zh), needsLogin: true };
  try {
    retry = await reserveRetryKey(accountId, endpoint, signature, isExtend ? null : original);
  } catch {
    return { ok: false, code: "RETRY_KEY_UNAVAILABLE", message: zh ? "无法在当前标签页保存重试信息，本次未提交。" : "This tab could not save the retry key. No request was sent." };
  }
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": retry.key,
        [isExtend ? "X-Extend-Account" : "X-Media-Account"]: accountId,
      },
      body: signature,
    });
    if (response.status === 401) {
      // The cookie may have expired during a retry of an accepted job.
      return { ok: false, message: errorMessage("UNAUTHORIZED", "", zh), needsLogin: true };
    }
    const payload = await response.json().catch(() => null);
    const uuid = payload?.data?.videoUuid ?? payload?.error?.details?.videoUuid;
    if (response.ok && typeof uuid === "string" && uuid && (payload?.success || response.status === 202)) {
      retry.forget();
      return { ok: true, uuid, credits: payload?.data?.creditsUsed ?? 0 };
    }
    const accountChanged = payload?.error?.details?.code === "ACCOUNT_CHANGED";
    if (payload?.success === false && response.status >= 400 && response.status < 500 && response.status !== 408 && !accountChanged) {
      retry.forget();
    }
    if (!payload) return { ok: false, message: networkError };
    // Errors look like { success: false, error: { message, details: { code } } }.
    const code = payload?.error?.details?.code;
    const message = payload?.error?.message ?? "";
    const requiredCredits = payload?.error?.details?.requiredCredits;
    return {
      ok: false,
      message: errorMessage(code, typeof message === "string" ? message : "", zh),
      code: typeof code === "string" ? code : undefined,
      requiredCredits: typeof requiredCredits === "number" ? requiredCredits : undefined,
    };
  } catch {
    return { ok: false, message: networkError };
  }
}

async function fetchStatus(uuid: string): Promise<Partial<MediaJob> | null> {
  try {
    const response = await fetch(`/api/v1/video/${encodeURIComponent(uuid)}/status`, { cache: "no-store" });
    if (response.status !== 200) return null;
    const payload = await response.json();
    const data = payload?.data;
    if (!data) return null;
    return {
      status: toStatus(data.status),
      urls: Array.isArray(data.mediaUrls) ? data.mediaUrls : data.videoUrl ? [data.videoUrl] : [],
      message: data.error ?? null,
    };
  } catch {
    return null;
  }
}

async function fetchHistory(kind: MediaKind, limit = 24): Promise<MediaJob[]> {
  try {
    const response = await fetch(`/api/v1/video/list?type=${kind}&limit=${limit}`, { cache: "no-store" });
    if (response.status !== 200) return [];
    const payload = await response.json();
    const rows: unknown[] = Array.isArray(payload?.data?.videos) ? payload.data.videos : [];
    return rows.map((row) => {
      const item = row as {
        uuid: string;
        status: string;
        mediaUrls?: string[];
        videoUrl?: string | null;
        prompt?: string;
        model?: string;
        errorMessage?: string | null;
        createdAt?: string | number | null;
      };
      return {
        uuid: item.uuid,
        status: toStatus(item.status),
        urls: item.mediaUrls ?? (item.videoUrl ? [item.videoUrl] : []),
        prompt: item.prompt ?? "",
        model: item.model,
        message: item.errorMessage ?? null,
        createdAt: toMillis(item.createdAt),
      };
    });
  } catch {
    return [];
  }
}

/** Jobs for one studio: history on load, new submissions, and polling. */
export function useMediaJobs(kind: MediaKind, enabled = true) {
  const [jobs, setJobs] = useState<MediaJob[]>([]);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchHistory(kind).then((history) => {
      if (!cancelled && history.length > 0) {
        setJobs((current) => [...current, ...history.filter((item) => !current.some((job) => job.uuid === item.uuid))]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [kind, enabled]);

  const pendingKey = jobs
    .filter((job) => job.status === "queued" || job.status === "generating")
    .map((job) => job.uuid)
    .join(",");

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      if (document.visibilityState === "hidden") return;
      const pending = jobsRef.current.filter((job) => job.status === "queued" || job.status === "generating");
      const updates = await Promise.all(pending.map(async (job) => ({ uuid: job.uuid, update: await fetchStatus(job.uuid) })));
      if (cancelled) return;
      setJobs((current) =>
        current.map((job) => {
          const found = updates.find((item) => item.uuid === job.uuid)?.update;
          return found ? { ...job, ...found, urls: found.urls?.length ? found.urls : job.urls } : job;
        }),
      );
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pendingKey]);

  const add = useCallback((job: MediaJob) => setJobs((current) => [job, ...current]), []);
  return { jobs, add };
}

