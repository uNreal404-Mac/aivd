// Models with a dedicated page in KIE's official Market documentation.
// This is a discovery catalogue. A model is only ready to generate when it is
// also present in the app's server-side model mapping and pricing configuration.
export type CatalogModel = {
  id: string;
  name: string;
  family: string;
  icon: string;
  detail: string;
  badge?: "Top" | "New";
};

export const VIDEO_CATALOG: CatalogModel[] = [
  { id: "bytedance/seedance-2-5", name: "Seedance 2.5", family: "Seedance", icon: "S", detail: "Text · image · multimodal", badge: "Top" },
  { id: "bytedance/seedance-2-5-draft", name: "Seedance 2.5 Draft", family: "Seedance", icon: "S", detail: "Draft task required" },
  { id: "bytedance/seedance-2", name: "Seedance 2.0", family: "Seedance", icon: "S", detail: "Text · image" },
  { id: "bytedance/seedance-2-fast", name: "Seedance 2.0 Fast", family: "Seedance", icon: "S", detail: "Fast generation" },
  { id: "bytedance/seedance-2-mini", name: "Seedance 2.0 Mini", family: "Seedance", icon: "S", detail: "Fast generation" },
  { id: "seedance-1.5-pro", name: "Seedance 1.5 Pro", family: "Seedance", icon: "S", detail: "4–12s · 480p–1080p" },
  { id: "kling/v4-reference-to-video", name: "Kling 4.0 Reference", family: "Kling", icon: "K", detail: "Reference to video", badge: "New" },
  { id: "kling/v4-flash-reference-to-video", name: "Kling 4.0 Flash Reference", family: "Kling", icon: "K", detail: "Reference to video", badge: "New" },
  { id: "kling/kling-3-0", name: "Kling 3.0", family: "Kling", icon: "K", detail: "Text · image" },
  { id: "wan/3-0-video-prime", name: "Wan 3.0 Prime", family: "Wan", icon: "W", detail: "Video generation" },
  { id: "wan/3-0-video", name: "Wan 3.0", family: "Wan", icon: "W", detail: "Video generation" },
  { id: "wan2.6", name: "Wan 2.6", family: "Wan", icon: "W", detail: "5–15s · 720p–1080p" },
  { id: "google/gemini-omni-flash-1-1", name: "Gemini Omni Flash 1.1", family: "Gemini Omni Flash", icon: "G", detail: "Multimodal video", badge: "New" },
  { id: "veo-3.1", name: "Veo 3.1", family: "Google Veo", icon: "G", detail: "8s · sound" },
  { id: "minimax-h3/text-to-video", name: "MiniMax H3", family: "MiniMax Hailuo", icon: "M", detail: "Text to video" },
  { id: "hailuo/02-text-to-video-pro", name: "MiniMax Hailuo 02 Pro", family: "MiniMax Hailuo", icon: "M", detail: "Text to video" },
  { id: "hailuo/02-text-to-video-standard", name: "MiniMax Hailuo 02 Standard", family: "MiniMax Hailuo", icon: "M", detail: "Text to video" },
  { id: "grok-imagine/text-to-video", name: "Grok Imagine", family: "Grok Imagine", icon: "X", detail: "Text to video" },
  { id: "happyhorse/text-to-video", name: "HappyHorse", family: "HappyHorse", icon: "H", detail: "Text to video" },
  { id: "sora-2", name: "Sora 2", family: "Sora", icon: "O", detail: "10–15s · sound" },
  { id: "seedance-2-5-flash", name: "Seedance 2.5 Flash", family: "Seedance", icon: "S", detail: "Fast · 480p–720p", badge: "New" },
  { id: "gemini-omni-flash-1-2", name: "Gemini Omni Flash 1.2", family: "Gemini Omni Flash", icon: "G", detail: "Multimodal video · up to 4K", badge: "New" },
  { id: "grok-imagine-1-5", name: "Grok Imagine 1.5", family: "Grok Imagine", icon: "X", detail: "Image to video · sound" },
  { id: "happyhorse-1-1", name: "HappyHorse 1.1", family: "HappyHorse", icon: "H", detail: "Text · image to video" },
];

export const VIDEO_FEATURED_IDS = [
  // Ready to generate, in menu order.
  "veo-3.1", "wan2.6",
  "bytedance/seedance-2-5", "seedance-2-5-flash", "kling/v4-reference-to-video",
  "kling/v4-flash-reference-to-video", "gemini-omni-flash-1-2", "minimax-h3/text-to-video",
  "wan/3-0-video", "grok-imagine/text-to-video", "grok-imagine-1-5", "happyhorse-1-1",
];

export const IMAGE_CATALOG: CatalogModel[] = [
  { id: "grok-imagine-image-2-0/text-to-image", name: "Grok Imagine Image 2.0", family: "Grok Imagine", icon: "X", detail: "Text to image", badge: "New" },
  { id: "flux3/klein-text-to-image", name: "FLUX.3 Klein", family: "FLUX", icon: "F", detail: "Text to image", badge: "New" },
  { id: "flux2/pro-text-to-image", name: "FLUX.2 Pro", family: "FLUX", icon: "F", detail: "Text to image" },
  { id: "flux2/flex-text-to-image", name: "FLUX.2 Flex", family: "FLUX", icon: "F", detail: "Text to image" },
  { id: "seedream/5-pro-text-to-image", name: "Seedream 5 Pro", family: "Seedream", icon: "S", detail: "Text to image" },
  { id: "seedream/5-flash-text-to-image", name: "Seedream 5 Flash", family: "Seedream", icon: "S", detail: "Text to image" },
  { id: "google/imagen4", name: "Imagen 4", family: "Google Imagen", icon: "G", detail: "Text to image" },
  { id: "google/imagen4-fast", name: "Imagen 4 Fast", family: "Google Imagen", icon: "G", detail: "Text to image" },
  { id: "ideogram/v3-text-to-image", name: "Ideogram V3", family: "Ideogram", icon: "I", detail: "Text to image" },
  { id: "qwen3/text-to-image", name: "Qwen3", family: "Qwen", icon: "Q", detail: "Text to image" },
  { id: "z-image/z-image", name: "Z-Image", family: "Z-Image", icon: "Z", detail: "Text to image" },
  { id: "seedream-5-5", name: "Seedream 5.5", family: "Seedream", icon: "S", detail: "Text · image to image", badge: "New" },
  { id: "gpt-image-2-6-sunburst", name: "GPT Image 2.6 Sunburst", family: "GPT Image", icon: "O", detail: "Text · image to image", badge: "New" },
  { id: "gpt-image-2-6-flare", name: "GPT Image 2.6 Flare", family: "GPT Image", icon: "O", detail: "Text · image to image", badge: "New" },
  { id: "nano-banana-2-1", name: "Nano Banana 2.1", family: "Nano Banana", icon: "G", detail: "Text · image to image" },
  { id: "nano-banana-pro", name: "Nano Banana Pro", family: "Nano Banana", icon: "G", detail: "Up to 4K" },
  { id: "kling-image-4", name: "Kling Image 4.0", family: "Kling", icon: "K", detail: "Up to 8K · up to 9 images", badge: "New" },
  { id: "minimax-h3-image", name: "MiniMax H3 Image", family: "MiniMax Hailuo", icon: "M", detail: "Text · image to image" },
];

export const IMAGE_FEATURED_IDS = [
  // Ready to generate, in menu order.
  "seedream-5-5", "gpt-image-2-6-sunburst", "gpt-image-2-6-flare", "nano-banana-2-1",
  "kling-image-4", "minimax-h3-image", "nano-banana-pro", "flux3/klein-text-to-image",
  "grok-imagine-image-2-0/text-to-image",
];

/** Message key for a model's subtitle under ModelPicker.details (next-intl keys cannot contain "/" or "."). */
export function catalogDetailKey(id: string): string {
  return id.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
