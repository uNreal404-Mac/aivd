import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { calculateModelCredits } from "@/config/credits";

export type PricingKind = "video" | "image" | "audio";

/** One typical generation and what it costs. */
export type PricingUnit = {
  id: string;
  kind: PricingKind;
  name: string;
  spec: { zh: string; en: string };
  credits: number;
};

const market = (id: string, req: Parameters<typeof marketCredits>[1]) => {
  const model = getMarketModel(id);
  return model ? marketCredits(model, req) : 0;
};

/**
 * What one generation costs on each model, from the same pricing the studios
 * charge. The pricing tables and the homepage FAQ both read these, so a number
 * quoted in one place cannot drift from the other.
 *
 * Within each kind the rows run from the most searched model down (Google
 * search volume, October 2026): the tables show the first three by default.
 */
export const PRICING_UNITS: PricingUnit[] = [
  { id: "bytedance/seedance-2-5", kind: "video", name: "Seedance 2.5", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: market("bytedance/seedance-2-5", { prompt: "", duration: 5, resolution: "720p" }) },
  { id: "kling/v4-reference-to-video", kind: "video", name: "Kling 4.0", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: market("kling/v4-reference-to-video", { prompt: "", duration: 5, resolution: "720p" }) },
  { id: "veo-3.1", kind: "video", name: "Veo 3.1", spec: { zh: "8 秒 · 720p · 有声", en: "8s · 720p · sound" }, credits: calculateModelCredits("veo-3.1", { duration: 8, quality: "720p" }) },
  { id: "seedance-2-5-flash", kind: "video", name: "Seedance 2.5 Flash", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: market("seedance-2-5-flash", { prompt: "", duration: 5, resolution: "720p" }) },
  { id: "kling/v4-flash-reference-to-video", kind: "video", name: "Kling 4.0 Flash", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: market("kling/v4-flash-reference-to-video", { prompt: "", duration: 5, resolution: "720p" }) },
  { id: "wan2.6", kind: "video", name: "Wan 2.6", spec: { zh: "5 秒 · 720p", en: "5s · 720p" }, credits: calculateModelCredits("wan2.6", { duration: 5, quality: "720p" }) },
  { id: "grok-imagine/text-to-video", kind: "video", name: "Grok Imagine", spec: { zh: "6 秒 · 720p", en: "6s · 720p" }, credits: market("grok-imagine/text-to-video", { prompt: "", duration: 6, resolution: "720p" }) },
  { id: "nano-banana-2-1", kind: "image", name: "Nano Banana 2.1", spec: { zh: "1K · 每张", en: "1K · per image" }, credits: market("nano-banana-2-1", { prompt: "", resolution: "1K" }) },
  { id: "nano-banana-pro", kind: "image", name: "Nano Banana Pro", spec: { zh: "1K · 每张", en: "1K · per image" }, credits: market("nano-banana-pro", { prompt: "", resolution: "1K" }) },
  { id: "gpt-image-2-6-sunburst", kind: "image", name: "GPT Image 2.6", spec: { zh: "1K · 每张", en: "1K · per image" }, credits: market("gpt-image-2-6-sunburst", { prompt: "", resolution: "1K" }) },
  { id: "flux3/klein-text-to-image", kind: "image", name: "FLUX 3", spec: { zh: "1K · 每张", en: "1K · per image" }, credits: market("flux3/klein-text-to-image", { prompt: "", resolution: "1K" }) },
  { id: "grok-imagine-image-2-0/text-to-image", kind: "image", name: "Grok Imagine 2.0", spec: { zh: "每张", en: "per image" }, credits: market("grok-imagine-image-2-0/text-to-image", { prompt: "" }) },
  { id: "elevenlabs-turbo-2-5", kind: "audio", name: "Eleven Turbo 2.5", spec: { zh: "每 1000 字", en: "per 1,000 chars" }, credits: market("elevenlabs-turbo-2-5", { prompt: "x".repeat(1000) }) },
  { id: "elevenlabs-v3", kind: "audio", name: "Eleven v3", spec: { zh: "每 1000 字", en: "per 1,000 chars" }, credits: market("elevenlabs-v3", { prompt: "x".repeat(1000) }) },
  { id: "suno-music", kind: "audio", name: "Suno V6", spec: { zh: "每首歌", en: "per song" }, credits: market("suno-music", { prompt: "" }) },
];

/** The cheapest generation of a kind, ignoring models with no price yet. */
export function cheapestUnit(kind: PricingKind): PricingUnit | undefined {
  return PRICING_UNITS.filter((unit) => unit.kind === kind && unit.credits > 0).sort((a, b) => a.credits - b.credits)[0];
}
