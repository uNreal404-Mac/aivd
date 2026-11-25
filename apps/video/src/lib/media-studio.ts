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
    case "CONTENT_BLOCKED":
      return fallback;
    default:
      return fallback || (zh ? "生成失败，请稍后再试。" : "Generation failed. Please try again.");
  }
}

// When a request's answer is lost (network error, or the response body broke
// off), the same request sent again keeps its idempotency key, so the server
// returns the job it may already have created and frozen credits for instead
// of creating and charging a second one. Kept per tab in sessionStorage, by a
// hash of the request, so a reload or another job in between does not lose it.
const LOST_ANSWERS_KEY = "aivd:media-lost-answers";
const LOST_ANSWER_TTL_MS = 30 * 60 * 1000;

function requestHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}:${text.length}`;
}

type LostAnswers = Record<string, { key: string; at: number }>;
const memoryLostAnswers: LostAnswers = {};

function readLostAnswers(): LostAnswers {
  try {
    const stored = JSON.parse(sessionStorage.getItem(LOST_ANSWERS_KEY) || "{}") as LostAnswers;
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return memoryLostAnswers;
  }
}

function writeLostAnswers(answers: LostAnswers): void {
  const now = Date.now();
  const fresh = Object.fromEntries(Object.entries(answers).filter(([, item]) => now - item.at < LOST_ANSWER_TTL_MS));
  try {
    sessionStorage.setItem(LOST_ANSWERS_KEY, JSON.stringify(fresh));
  } catch {
    for (const key of Object.keys(memoryLostAnswers)) delete memoryLostAnswers[key];
    Object.assign(memoryLostAnswers, fresh);
  }
}

export async function submitMedia(
  body: SubmitBody,
  zh: boolean,
): Promise<{ ok: true; uuid: string; credits: number } | { ok: false; message: string; needsLogin?: boolean; code?: string; requiredCredits?: number }> {
  const signature = JSON.stringify(body);
  const hash = requestHash(signature);
  const pending = readLostAnswers()[hash];
  const key =
    pending && Date.now() - pending.at < LOST_ANSWER_TTL_MS
      ? pending.key
      : typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
  const rememberLost = () => writeLostAnswers({ ...readLostAnswers(), [hash]: { key, at: Date.now() } });
  const forget = () => {
    const answers = readLostAnswers();
    delete answers[hash];
    writeLostAnswers(answers);
  };
  try {
    const response = await fetch("/api/v1/media/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: signature,
    });
    // Not signed in: nothing was created, whatever the body says.
    if (response.status === 401) {
      forget();
      return { ok: false, message: errorMessage("UNAUTHORIZED", "", zh), needsLogin: true };
    }
    let payload: any = null;
    try {
      payload = await response.json();
    } catch {
      // No readable answer (the body broke off, or an error page): the job
      // may exist, so a retry must reuse this key.
      rememberLost();
      return { ok: false, message: zh ? "网络错误，请稍后再试。" : "Network error. Please try again." };
    }
    forget();
    const uuid = payload?.data?.videoUuid ?? payload?.error?.details?.videoUuid;
    if (payload?.success && uuid) return { ok: true, uuid, credits: payload.data.creditsUsed ?? 0 };
    // 202: submitted, outcome unknown; it still shows up and resolves later.
    if (response.status === 202 && uuid) return { ok: true, uuid, credits: 0 };
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
    rememberLost();
    return { ok: false, message: zh ? "网络错误，请稍后再试。" : "Network error. Please try again." };
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

