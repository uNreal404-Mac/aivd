// Models listed in the top-nav dropdowns. The lineup and order follow the
// reference site's menus (its own house models are left out). A model that is
// in our KIE catalogue links with its catalogue id; the rest use a slug, open
// the matching studio pre-selected, and show as coming soon there.
import { IMAGE_CATALOG, VIDEO_CATALOG } from "@/lib/kie-model-catalog";

export type NavModelKind = "image" | "video" | "audio";

export type NavModel = {
  /** Catalogue id when we have one, otherwise a stable slug. */
  id: string;
  name: string;
  desc: { zh: string; en: string };
  badge?: "hot" | "new";
  /** Extra tag after the name, e.g. "4K". */
  tag?: string;
};

const m = (id: string, name: string, zh: string, en: string, badge?: NavModel["badge"], tag?: string): NavModel => ({
  id,
  name,
  desc: { zh, en },
  badge,
  tag,
});

export const NAV_VIDEO_MODELS: NavModel[] = [
  // On sale today, so they lead the list.
  m("veo-3.1", "Veo 3.1", "Google 出品，带同步声音的电影级短片", "Google's cinematic clips with synced sound", "hot"),
  m("wan2.6", "Wan 2.6", "5–15 秒，720p 与 1080p，性价比高", "5–15s at 720p or 1080p, good value"),
  m("bytedance/seedance-2-5", "Seedance 2.5", "创作最长 30 秒的电影级视频", "Cinematic video up to 30 seconds", "hot", "4K"),
  m("seedance-2-5-flash", "Seedance 2.5 Flash", "快速创建和编辑最长 30 秒的 720p 视频", "Fast 720p video up to 30 seconds", "new"),
  m("kling/v4-reference-to-video", "Kling 4.0", "从任意输入创建和编辑长达 30 秒的视频", "Create and edit video up to 30s from any input"),
  m("kling/v4-flash-reference-to-video", "Kling 4.0 Flash", "用任意输入快速创建最长 20 秒的 720p 视频", "Fast 720p video up to 20s from any input", "new"),
  m("gemini-omni-flash-1-2", "Gemini Omni Flash 1.2", "从任意输入生成并编辑视频", "Generate and edit video from any input", "new"),
  m("flux-3-video", "FLUX.3 Video", "支持文本、图像和视频生成，并同步音频", "Text, image and video to video with synced audio"),
  m("flux-3-upscale", "FLUX.3 Upscale", "保留原貌或创意增强细节", "Keep the original or enhance detail"),
  m("minimax-h3/text-to-video", "MiniMax H3", "通过文本、关键帧或多模态参考创建 2K 视频", "2K video from text, keyframes or references"),
  m("wan/3-0-video", "Wan 3.0", "用文本、关键帧或多模态参考生成视频", "Video from text, keyframes or references"),
  m("grok-imagine-1-5-lite", "Grok Imagine 1.5 Lite", "从文字或图片快速生成实惠视频", "Fast, affordable video from text or an image"),
  m("grok-imagine/text-to-video", "Grok Imagine 1.5", "音画同步的电影级视频", "Cinematic video with synced sound"),
  m("happyhorse/text-to-video", "HappyHorse", "风格鲜明的趣味短视频", "Playful short clips with a strong style"),
];

export const NAV_IMAGE_MODELS: NavModel[] = [
  m("seedream-5-5", "Seedream 5.5", "智能图像生成，支持透明背景", "Smart image generation with transparent backgrounds", "new"),
  m("gpt-image-2-6-sunburst", "GPT Image 2.6 Sunburst", "品质出众，编辑精准", "Outstanding quality, precise edits", "new"),
  m("gpt-image-2-6-flare", "GPT Image 2.6 Flare", "惊艳的日常图片，快速生成", "Striking everyday images, fast", "new"),
  m("nano-banana-2-1", "Nano Banana 2.1", "Google 新一代旗舰图像模型", "Google's latest flagship image model"),
  m("kling-image-4", "Kling Image 4.0", "最高 8K，支持文字和参考图", "Up to 8K from text and references", "new"),
  m("minimax-h3-image", "MiniMax H3 Image", "用 MiniMax H3 生成图像", "Images from MiniMax H3", "new"),
  m("nano-banana-pro", "Nano Banana Pro", "出色的 4K 图像模型", "An excellent 4K image model", "hot"),
  m("flux3/klein-text-to-image", "FLUX 3 Image", "Black Forest Labs 打造的新一代图片生成与编辑", "Black Forest Labs' latest generation and editing"),
  m("recraft-v4-1", "Recraft V4.1", "逼真且富有表现力的图像生成", "Lifelike, expressive image generation"),
  m("grok-imagine-image-2-0/text-to-image", "Grok Imagine 2.0", "xAI 出品的高分辨率图像生成", "High-resolution images from xAI"),
];

export const NAV_AUDIO_MODELS: NavModel[] = [
  m("seed_audio", "Seed Audio 1.0", "自然流畅的多语种语音", "Natural multilingual speech"),
  m("elevenlabs_v4", "Eleven v4", "ElevenLabs 最新一代语音合成", "ElevenLabs' latest speech model", "new"),
  m("elevenlabs_v4_turbo", "Eleven v4 Turbo", "低延迟、速度更快的语音", "Faster, low-latency speech"),
  m("elevenlabs", "Eleven v3", "富有表现力的情绪化配音", "Expressive, emotional voiceover"),
  m("qwen_audio", "Qwen Audio 3.0", "通义千问语音生成", "Speech from Qwen"),
  m("minimax", "MiniMax Speech 2.8 HD", "高保真中英文配音", "High-fidelity Chinese and English voice"),
  m("seed_speech", "Seed Speech", "字节跳动语音合成", "Speech synthesis from ByteDance"),
];

const LISTS: Record<NavModelKind, NavModel[]> = {
  image: NAV_IMAGE_MODELS,
  video: NAV_VIDEO_MODELS,
  audio: NAV_AUDIO_MODELS,
};

/** Studio URL that opens with this model selected, as the reference does. */
export function navModelHref(kind: NavModelKind, id: string): string {
  const query = encodeURIComponent(id);
  if (kind === "audio") return `/audio?voiceMode=voiceover&audioModel=${query}`;
  return `/ai/${kind}?model=${query}`;
}

/** Look up a nav-listed model by id. */
export function findNavModel(kind: NavModelKind, id: string | undefined | null): NavModel | undefined {
  if (!id) return undefined;
  return LISTS[kind].find((item) => item.id === id);
}

/** True when the id is in our KIE catalogue, so the studio picker knows it. */
export function inCatalog(kind: "image" | "video", id: string): boolean {
  return (kind === "video" ? VIDEO_CATALOG : IMAGE_CATALOG).some((item) => item.id === id);
}
