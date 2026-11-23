"use client";

import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { errorMessage, submitMedia } from "@/lib/media-studio";

import type {
  CanvasEdge,
  CanvasNode,
  CharacterData,
  GenerateData,
  GenStatus,
  MediaData,
  StoryboardData,
  StyleData,
  TextData,
} from "./types";

export interface CollectedInputs {
  texts: string[];
  images: string[];
}

/** What the upstream nodes of `nodeId` contribute to its generation. */
export function collectInputs(nodeId: string, nodes: CanvasNode[], edges: CanvasEdge[]): CollectedInputs {
  const texts: string[] = [];
  const images: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const edge of edges) {
    if (edge.target !== nodeId) continue;
    const source = byId.get(edge.source);
    if (!source) continue;
    switch (source.type) {
      case "text": {
        const text = (source.data as TextData).text.trim();
        if (text) texts.push(text);
        break;
      }
      case "storyboard": {
        const shots = (source.data as StoryboardData).shots.map((s) => s.trim()).filter(Boolean);
        if (shots.length) texts.push(shots.map((s, i) => `Shot ${i + 1}: ${s}`).join("\n"));
        break;
      }
      case "character": {
        const c = source.data as CharacterData;
        const line = [c.name.trim(), c.description.trim()].filter(Boolean).join(": ");
        if (line) texts.push(`Character ${line}`);
        if (c.imageKey || c.imageUrl) images.push((c.imageKey || c.imageUrl) as string);
        break;
      }
      case "style": {
        const s = source.data as StyleData;
        const line = [s.preset, s.custom.trim()].filter(Boolean).join(", ");
        if (line) texts.push(`Style: ${line}`);
        break;
      }
      case "image": {
        const g = source.data as GenerateData;
        if (g.urls[0]) images.push(g.urls[0]);
        else if (g.prompt.trim()) texts.push(g.prompt.trim());
        break;
      }
      case "video":
      case "audio": {
        const g = source.data as GenerateData;
        if (g.prompt.trim()) texts.push(g.prompt.trim());
        break;
      }
      case "media": {
        const m = source.data as MediaData;
        if (m.mediaType === "image" && (m.key || /^https?:/.test(m.url))) images.push(m.key || m.url);
        break;
      }
      default:
        break;
    }
  }
  return { texts, images };
}

export function buildPrompt(own: string, inputs: CollectedInputs): string {
  return [...inputs.texts, own.trim()].filter(Boolean).join("\n").slice(0, 5000);
}

export function estimateCredits(data: GenerateData, inputs: CollectedInputs): number | null {
  const model = getMarketModel(data.model);
  if (!model) return null;
  const maxImages = model.options.maxImages ?? 0;
  return marketCredits(model, {
    prompt: buildPrompt(data.prompt, inputs) || " ",
    aspectRatio: data.aspect,
    resolution: data.resolution,
    duration: data.duration,
    count: 1,
    imageUrls: inputs.images.slice(0, maxImages),
    voice: data.voice,
  });
}

export type SubmitResult =
  | { ok: true; uuid: string; credits: number }
  | { ok: false; message: string; needsLogin?: boolean };

export async function submitGeneration(
  kind: "image" | "video" | "audio",
  data: GenerateData,
  inputs: CollectedInputs,
  zh: boolean,
): Promise<SubmitResult> {
  const model = getMarketModel(data.model);
  const prompt = buildPrompt(data.prompt, inputs);
  if (!model) return { ok: false, message: zh ? "请选择模型" : "Choose a model" };
  if (!prompt) return { ok: false, message: zh ? "请输入提示词或连接文本节点" : "Write a prompt or connect a text node" };
  const imageUrls = inputs.images.slice(0, model.options.maxImages ?? 0);
  if (model.options.requiresImage && imageUrls.length === 0) {
    return { ok: false, message: zh ? "这个模型需要连接一张图片" : "This model needs a connected image" };
  }

  if (kind !== "video") {
    return submitMedia(
      {
        model: model.id,
        prompt,
        aspectRatio: data.aspect,
        resolution: data.resolution,
        count: 1,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        voice: data.voice,
      },
      zh,
    );
  }

  try {
    const response = await fetch("/api/v1/video/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({
        model: model.id,
        prompt,
        duration: data.duration,
        aspectRatio: data.aspect,
        quality: data.resolution,
        imageUrls: imageUrls.length ? imageUrls : undefined,
      }),
    });
    if (response.status === 401) return { ok: false, message: errorMessage("UNAUTHORIZED", "", zh), needsLogin: true };
    const payload = await response.json().catch(() => null);
    const uuid = payload?.data?.videoUuid ?? payload?.error?.details?.videoUuid;
    if ((payload?.success || response.status === 202) && uuid) {
      return { ok: true, uuid, credits: payload?.data?.creditsUsed ?? 0 };
    }
    return {
      ok: false,
      message: errorMessage(payload?.error?.details?.code, payload?.error?.message ?? "", zh),
    };
  } catch {
    return { ok: false, message: errorMessage("NETWORK", "", zh) };
  }
}

function toStatus(value: unknown): GenStatus {
  if (value === "COMPLETED") return "completed";
  if (value === "FAILED") return "failed";
  if (value === "GENERATING" || value === "UPLOADING") return "generating";
  return "queued";
}

export async function fetchJob(
  uuid: string,
): Promise<{ status: GenStatus; urls: string[]; error: string | null } | null> {
  try {
    const response = await fetch(`/api/v1/video/${encodeURIComponent(uuid)}/status`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json())?.data;
    if (!data) return null;
    return {
      status: toStatus(data.status),
      urls: Array.isArray(data.mediaUrls) ? data.mediaUrls : data.videoUrl ? [data.videoUrl] : [],
      error: data.error ?? null,
    };
  } catch {
    return null;
  }
}

export async function uploadImageFile(file: File): Promise<{ key: string; url: string }> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/v1/upload", { method: "POST", body: form });
  const payload = await response.json().catch(() => null);
  if (!payload?.success) throw new Error(payload?.error?.message || "Upload failed");
  return { key: payload.data.key, url: payload.data.signedUrl };
}
