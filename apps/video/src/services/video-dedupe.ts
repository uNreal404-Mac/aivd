import { createHash } from "node:crypto";

export const DEDUPE_WINDOW_SECONDS = 60;

export function buildDedupeKey(input: {
  userId: string;
  model: string;
  mode: string;
  prompt: string;
  duration: number;
  aspectRatio?: string;
  quality?: string;
  imageUrls: string[];
  outputNumber: number;
  generateAudio?: boolean;
}): string {
  const payload = [
    input.userId,
    input.model,
    input.mode,
    input.prompt.trim(),
    input.duration,
    input.aspectRatio ?? null,
    input.quality ?? null,
    input.imageUrls,
    input.outputNumber,
    input.generateAudio ?? null,
  ];

  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
