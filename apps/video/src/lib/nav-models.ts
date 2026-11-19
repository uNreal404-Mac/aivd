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
  m("bytedance/seedance-2-5", "Seedance 2.5", "电影级画面和同步声音，最高 1080p", "Cinematic video with synced sound, up to 1080p", "hot", "1080P"),
  m("seedance-2-5-flash", "Seedance 2.5 Flash", "更快更省的 720p 视频，带同步声音", "Faster, cheaper 720p video with synced sound", "new"),
  m("kling/v4-reference-to-video", "Kling 4.0", "最多 4 张参考图，锁定人物和风格", "Up to 4 references keep characters and style steady"),
  m("kling/v4-flash-reference-to-video", "Kling 4.0 Flash", "参考图驱动的快速 720p 视频", "Fast 720p video driven by references", "new"),
  m("gemini-omni-flash-1-2", "Gemini Omni Flash 1.2", "从任意输入生成并编辑视频", "Generate and edit video from any input", "new"),
  m("minimax-h3/text-to-video", "MiniMax H3", "用文本或起始帧生成最高 2K 的视频", "Up to 2K video from text or a start frame"),
  m("wan/3-0-video", "Wan 3.0", "用文本或起始帧生成带声音的视频", "Video with sound from text or a start frame"),
  m("grok-imagine/text-to-video", "Grok Imagine", "从文字或图片快速生成实惠视频", "Fast, affordable video from text or an image"),
  m("grok-imagine-1-5", "Grok Imagine 1.5", "以一张图片为起点，音画同步的电影级视频", "Cinematic video with synced sound from a start image"),
  m("happyhorse-1-1", "HappyHorse 1.1", "风格鲜明的趣味短视频", "Playful short clips with a strong style"),
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
  m("grok-imagine-image-2-0/text-to-image", "Grok Imagine 2.0", "xAI 出品的高分辨率图像生成", "High-resolution images from xAI"),
];

export const NAV_AUDIO_MODELS: NavModel[] = [
  m("elevenlabs-v3", "Eleven v3", "富有表现力的情绪化配音", "Expressive, emotional voiceover", "new"),
  m("elevenlabs-multilingual-v2", "Eleven Multilingual v2", "自然流畅的多语种语音", "Natural multilingual speech"),
  m("elevenlabs-turbo-2-5", "Eleven Turbo 2.5", "低延迟、速度更快的语音", "Faster, low-latency speech"),
  m("gemini-3-8-flash-tts", "Gemini 3.8 Flash TTS", "Google 语音合成，支持 100 多种语言", "Google speech in 100+ languages", "new"),
  m("suno-music", "Suno V6", "一句话生成完整歌曲", "A full song from one line", "hot"),
  m("suno-sounds", "Suno Sounds", "用文字生成音效和氛围声", "Sound effects and ambience from text"),
  m("suno-speech", "Suno Speech", "描述场景，生成带情绪的人声", "Describe a scene, get an expressive voice"),
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
