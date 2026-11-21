import { getMarketModel } from "@/ai/kie-market";

export const MAX_HOME_VIDEO_REFERENCES = 12;

export type UploadedVideoReference = { key: string; name: string; url: string };

// The two legacy video models accept a single start image. Market models
// declare their own limit, which is currently at most four for video.
export function maxVideoReferences(modelId: string): number {
  const marketModel = getMarketModel(modelId);
  return marketModel ? (marketModel.options.maxImages ?? 0) : 1;
}

const REFERENCE_TOKEN = /@(图片|image)(\d+)(?!\d)/gi;

export function prepareVideoReferencePrompt(prompt: string, count: number):
  | { ok: true; prompt: string }
  | { ok: false; index: number } {
  let invalidIndex: number | null = null;
  const prepared = prompt.replace(REFERENCE_TOKEN, (_token, _label: string, number: string) => {
    const index = Number(number);
    if ((index < 1 || index > count) && invalidIndex === null) invalidIndex = index;
    return `image ${index}`;
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
