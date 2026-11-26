import { getMarketModel } from "@/ai/kie-market";

export const MAX_HOME_REFERENCES = 12;

export type UploadedVideoReference = { key: string; name: string; url: string; mimeType?: string; sourceId?: string };

// The two legacy video models accept a single start image. Market models
// declare their own limit, which is currently at most four for video.
export function maxVideoReferences(modelId: string): number {
  const marketModel = getMarketModel(modelId);
  return marketModel ? (marketModel.options.maxImages ?? 0) : 1;
}

const REFERENCE_TOKEN = /@(图片|image|视频|video)(\d+)(?!\d)/gi;

// Models whose prompts bind a reference image by their own tag. Every other
// model reads a plain "image 2".
const MODEL_IMAGE_TAGS: Record<string, (index: number) => string> = {
  "kling-4-0/long-image": (index) => `@image_${index}`,
  "grok-imagine/text-to-image": (index) => `@image${index}`,
};

export function prepareVideoReferencePrompt(prompt: string, count: number, kind: "image" | "video" = "image", modelId?: string):
  | { ok: true; prompt: string }
  | { ok: false; index: number } {
  let invalidIndex: number | null = null;
  const tag = kind === "image" && modelId ? MODEL_IMAGE_TAGS[modelId] : undefined;
  const prepared = prompt.replace(REFERENCE_TOKEN, (_token, label: string, number: string) => {
    const index = Number(number);
    const tokenKind = /^(video|视频)$/i.test(label) ? "video" : "image";
    if ((index < 1 || index > count || tokenKind !== kind) && invalidIndex === null) invalidIndex = index;
    return tag ? tag(index) : `${kind} ${index}`;
  });
  return invalidIndex !== null ? { ok: false, index: invalidIndex } : { ok: true, prompt: prepared };
}

export function removeVideoReferenceToken(prompt: string, removedIndex: number): string {
  return prompt.replace(REFERENCE_TOKEN, (token, label: string, number: string) => {
    const index = Number(number);
    if (index === removedIndex) return "";
    if (index > removedIndex) return `@${label}${index - 1}`;
    return token;
  });
}
