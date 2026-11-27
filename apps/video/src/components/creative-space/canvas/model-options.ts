// Per-node model choices, live quotes and request bodies for the node canvas.
// Quotes use the same pricing functions the server freezes credits with, and
// are passed the reference-image count and sound so they match.
import { allowedDuration, getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { estimateCredits, STUDIO_MODELS } from "@/lib/ai-video-studio";
import { maxVideoReferences } from "@/lib/video-references";
import type { GenerateData } from "@/lib/creative-space/canvas-graph";

export const IMAGE_MODELS = marketModelsOf("image");
export const AUDIO_MODELS = marketModelsOf("audio");
export const VIDEO_MODELS = STUDIO_MODELS.filter((model) => model.available);

export type GenKind = GenerateData["kind"];

export function modelsFor(kind: GenKind): { id: string; name: string }[] {
  if (kind === "image") return IMAGE_MODELS.map(({ id, name }) => ({ id, name }));
  if (kind === "audio") return AUDIO_MODELS.map(({ id, name }) => ({ id, name }));
  return VIDEO_MODELS.map(({ id, name }) => ({ id, name }));
}

export interface ModelChoices {
  aspects: string[];
  resolutions: string[];
  durations: number[];
  maxCount: number;
  maxImages: number;
  audio: boolean;
  voices: { id: string; name: string }[];
  requiresImage: boolean;
  style: boolean;
}

export function choicesFor(kind: GenKind, modelId: string): ModelChoices {
  if (kind === "video") {
    const model = VIDEO_MODELS.find((item) => item.id === modelId) ?? VIDEO_MODELS[0];
    const market = getMarketModel(model?.id);
    return {
      aspects: (model?.aspects ?? ["16:9"]).filter((aspect) => aspect !== "Auto"),
      resolutions: model?.resolutions ?? ["720p"],
      durations: model?.durations ?? [5],
      maxCount: 1,
      maxImages: model ? maxVideoReferences(model.id) : 1,
      audio: Boolean(model?.audio),
      voices: [],
      requiresImage: Boolean(market?.options.requiresImage),
      style: false,
    };
  }
  const market = getMarketModel(modelId) ?? (kind === "image" ? IMAGE_MODELS[0] : AUDIO_MODELS[0]);
  const options = market?.options ?? {};
  return {
    aspects: options.aspects ?? [],
    resolutions: options.resolutions ?? [],
    durations: [],
    maxCount: Math.max(1, Math.min(9, options.maxCount ?? 1)),
    maxImages: options.maxImages ?? 0,
    audio: false,
    voices: options.voices ?? [],
    requiresImage: Boolean(options.requiresImage),
    style: kind === "audio",
  };
}

/** The provider mappings for image-conditioned videos specify when the source fixes the aspect. */
export function followsReferenceAspect(modelId: string): boolean {
  const model = getMarketModel(modelId);
  if (model?.kind !== "video" || !model.options.maxImages) return false;
  const probe = model.buildTask({ prompt: "preview", aspectRatio: "9:16", imageUrls: ["reference"] });
  return probe.input.aspect_ratio !== "9:16";
}

/** Settings for a new node of this kind (first model, its first options). */
export function defaultsFor(kind: GenKind, title: string, prompt = ""): GenerateData {
  if (kind === "video") {
    const model = VIDEO_MODELS.find((item) => item.id === "bytedance/seedance-2-5") ?? VIDEO_MODELS[0];
    const choices = choicesFor("video", model?.id ?? "");
    return {
      kind,
      title,
      prompt,
      modelId: model?.id ?? "",
      aspect: choices.aspects.includes("16:9") ? "16:9" : choices.aspects[0],
      resolution: choices.resolutions.includes("480p") ? "480p" : choices.resolutions[0],
      duration: choices.durations.includes(4) ? 4 : choices.durations[0],
      audio: choices.audio,
      status: "idle",
    };
  }
  const model = (kind === "image" ? IMAGE_MODELS : AUDIO_MODELS)[0];
  const choices = choicesFor(kind, model?.id ?? "");
  return {
    kind,
    title,
    prompt,
    modelId: model?.id ?? "",
    ...(choices.aspects.length ? { aspect: choices.aspects.includes("16:9") ? "16:9" : choices.aspects[0] } : {}),
    ...(choices.resolutions.length ? { resolution: model?.options.defaultResolution ?? choices.resolutions[0] } : {}),
    ...(kind === "image" ? { count: 1 } : {}),
    ...(choices.voices.length ? { voice: choices.voices[0].id } : {}),
    status: "idle",
  };
}

/** Keeps a node's options valid after its model changed. */
export function withModel(data: GenerateData, modelId: string): GenerateData {
  const choices = choicesFor(data.kind, modelId);
  const pick = <T,>(value: T | undefined, list: T[]) => (value !== undefined && list.includes(value) ? value : list[0]);
  return {
    ...data,
    modelId,
    aspect: choices.aspects.length ? pick(data.aspect, choices.aspects) : undefined,
    resolution: choices.resolutions.length ? pick(data.resolution, choices.resolutions) : undefined,
    duration: data.kind === "video" ? pick(data.duration, choices.durations) : undefined,
    count: data.kind === "image" ? Math.min(data.count ?? 1, choices.maxCount) : undefined,
    audio: data.kind === "video" ? (choices.audio ? (data.audio ?? true) : false) : undefined,
    voice: choices.voices.length ? pick(data.voice, choices.voices.map((voice) => voice.id)) : undefined,
  };
}

/** Credits this node will freeze with `images` reference images. */
export function quote(data: GenerateData, prompt: string, images: number): number {
  if (data.kind === "video") {
    // Quote exactly what buildRequest sends: a node saved without a length or
    // resolution leaves them to the server's default, and sound is on only when set.
    const market = getMarketModel(data.modelId);
    if (market) {
      return marketCredits(market, {
        prompt: "",
        duration: allowedDuration(market, data.duration),
        resolution: data.resolution && market.options.resolutions?.includes(data.resolution) ? data.resolution : undefined,
        audio: market.options.audioToggle ? Boolean(data.audio) : undefined,
        imageUrls: Array.from({ length: images }, (_, index) => `reference-${index}`),
      });
    }
    return estimateCredits(
      { modelId: data.modelId, duration: data.duration ?? 5, resolution: data.resolution ?? "720p" },
      { images, audio: data.audio },
    );
  }
  const model = getMarketModel(data.modelId);
  if (!model) return 0;
  if (data.kind === "image") {
    return marketCredits(model, {
      prompt,
      aspectRatio: data.aspect,
      resolution: data.resolution,
      count: data.count ?? 1,
      imageUrls: Array.from({ length: images }, (_, index) => `reference-${index}`),
    });
  }
  return marketCredits(model, { prompt, voice: data.voice, style: data.style });
}

export type GenerationRequest = {
  endpoint: "/api/v1/media/generate" | "/api/v1/video/generate";
  body: Record<string, unknown>;
};

/** The request a node sends, given its merged prompt and reference URLs/keys. */
export function buildRequest(data: GenerateData, prompt: string, images: string[]): GenerationRequest {
  if (data.kind === "video") {
    return {
      endpoint: "/api/v1/video/generate",
      body: {
        model: data.modelId,
        prompt,
        duration: data.duration,
        aspectRatio: data.aspect,
        quality: data.resolution,
        generateAudio: Boolean(data.audio),
        ...(images.length === 1 ? { imageUrl: images[0], mode: "image-to-video" } : {}),
        ...(images.length > 1 ? { imageUrls: images, mode: "reference-to-video" } : {}),
      },
    };
  }
  if (data.kind === "image") {
    return {
      endpoint: "/api/v1/media/generate",
      body: {
        model: data.modelId,
        prompt,
        ...(data.aspect ? { aspectRatio: data.aspect } : {}),
        ...(data.resolution ? { resolution: data.resolution } : {}),
        count: data.count ?? 1,
        ...(images.length ? { imageUrls: images } : {}),
      },
    };
  }
  return {
    endpoint: "/api/v1/media/generate",
    body: {
      model: data.modelId,
      prompt,
      ...(data.voice ? { voice: data.voice } : {}),
      ...(data.style?.trim() ? { style: data.style.trim() } : {}),
    },
  };
}
