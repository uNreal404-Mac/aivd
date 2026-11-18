// Content for the homepage sections below the generator. Media are the site's
// own samples; swap them for real generations as the gallery grows.
import { navModelHref } from "@/lib/nav-models";

export type Bi = { zh: string; en: string };
export type ShowMedia = { src: string; video?: boolean; poster?: string };

const S = (name: string): ShowMedia => ({ src: `/home/samples/${name}.webp` });
const V = (name: string, poster?: string): ShowMedia => ({ src: `/home/${name}.mp4`, video: true, poster });

export const MEDIA = {
  marina: V("hero-marina-loop", "/home/hero-marina-poster.webp"),
  showcase2: V("hero-showcase-02"),
  showcase3: V("hero-showcase-03"),
  boyDog: S("boy-and-dog"),
  autumn: S("autumn-walk"),
  rain: S("rain-couple"),
  wind: S("mountain-wind"),
  bloom: S("cosmic-bloom"),
  valley: S("mountain-valley"),
  sea: S("storm-sea"),
  dancer: S("dancer"),
  planet: S("planet-impact"),
  tomb: S("tomb-light"),
  mech: S("mech-warrior"),
  dreaming: S("dreaming"),
  carpet: S("red-carpet"),
  studio: S("studio-room"),
} as const;

/** 1. Large feature cards in the top carousel. */
export const FEATURE_SLIDES: { media: ShowMedia; title: Bi; body: Bi; href: string; accent?: boolean }[] = [
  {
    media: MEDIA.marina,
    title: { zh: "新用户注册即送 70 积分", en: "70 free credits for new accounts" },
    body: { zh: "免费生成你的第一条视频", en: "Make your first video free" },
    href: "/pricing",
    accent: true,
  },
  {
    media: MEDIA.showcase2,
    title: { zh: "SEEDANCE 2.5 已上线", en: "SEEDANCE 2.5 IS LIVE" },
    body: { zh: "最长 30 秒的电影级视频，最高 1080p", en: "Cinematic video up to 30s and 1080p" },
    href: navModelHref("video", "bytedance/seedance-2-5"),
  },
  {
    media: MEDIA.showcase3,
    title: { zh: "VEO 3.1 有声短片", en: "VEO 3.1 WITH SOUND" },
    body: { zh: "画面和声音一起生成", en: "Picture and sound in one pass" },
    href: navModelHref("video", "veo-3.1"),
  },
  {
    media: MEDIA.bloom,
    title: { zh: "创作空间 AGENT", en: "CREATIVE SPACE AGENT" },
    body: { zh: "说出想法，自动拆成分镜再生成", en: "Say the idea; it plans the shots" },
    href: "/creative-space",
  },
  {
    media: MEDIA.carpet,
    title: { zh: "NANO BANANA PRO 4K", en: "NANO BANANA PRO 4K" },
    body: { zh: "Google 出品的高清图像模型", en: "Google's high-resolution image model" },
    href: navModelHref("image", "nano-banana-pro"),
  },
  {
    media: MEDIA.dancer,
    title: { zh: "SUNO V6 一句话写歌", en: "SUNO V6 SONGS" },
    body: { zh: "描述风格，生成完整歌曲", en: "Describe a style, get a full song" },
    href: "/audio?voiceMode=music",
  },
];

/** 2. Product tiles next to the offer card. */
export const PRODUCT_TILES: { title: string; badge?: Bi; tag?: string; body: Bi; href: string; icon: "film" | "spark" | "image" | "wave" | "layers" | "orbit" }[] = [
  { title: "Seedance 2.5", tag: "1080P", body: { zh: "新一代视频模型", en: "The new video model" }, href: navModelHref("video", "bytedance/seedance-2-5"), icon: "film" },
  { title: "Kling 4.0", badge: { zh: "新", en: "New" }, body: { zh: "参考图生成，人物一致", en: "Reference-driven, consistent characters" }, href: navModelHref("video", "kling/v4-reference-to-video"), icon: "orbit" },
  { title: "创作空间 Agent", badge: { zh: "新", en: "New" }, body: { zh: "一句话拆成分镜并生成", en: "One line becomes a shot plan" }, href: "/creative-space", icon: "spark" },
  { title: "Nano Banana Pro", badge: { zh: "热门", en: "Hot" }, body: { zh: "出色的 4K 图像模型", en: "An excellent 4K image model" }, href: navModelHref("image", "nano-banana-pro"), icon: "image" },
  { title: "Eleven v3", badge: { zh: "新", en: "New" }, body: { zh: "富有表现力的 AI 配音", en: "Expressive AI voiceover" }, href: navModelHref("audio", "elevenlabs-v3"), icon: "wave" },
  { title: "GPT Image 2.6", badge: { zh: "新", en: "New" }, body: { zh: "品质出众，编辑精准", en: "Outstanding quality, precise edits" }, href: navModelHref("image", "gpt-image-2-6-sunburst"), icon: "layers" },
];

/** 4–5. Model galleries, each a title, a line and a masonry of media. */
export const MODEL_GALLERIES: { id: string; title: string; body: Bi; href: string; cta: Bi; media: ShowMedia[] }[] = [
  {
    id: "seedance",
    title: "SEEDANCE 2.5",
    body: { zh: "新一代 AI 视频模型", en: "The next-generation AI video model" },
    href: navModelHref("video", "bytedance/seedance-2-5"),
    cta: { zh: "用 Seedance 2.5 生成", en: "Create with Seedance 2.5" },
    media: [MEDIA.showcase2, MEDIA.rain, MEDIA.dancer, MEDIA.autumn, MEDIA.wind, MEDIA.boyDog, MEDIA.carpet, MEDIA.valley],
  },
  {
    id: "nano-banana",
    title: "NANO BANANA PRO",
    body: { zh: "4K 图像，细节与文字渲染出色", en: "4K images with fine detail and text" },
    href: navModelHref("image", "nano-banana-pro"),
    cta: { zh: "用 Nano Banana Pro 生成", en: "Create with Nano Banana Pro" },
    media: [MEDIA.carpet, MEDIA.studio, MEDIA.bloom, MEDIA.dreaming, MEDIA.tomb, MEDIA.planet, MEDIA.mech, MEDIA.sea],
  },
  {
    id: "veo",
    title: "VEO 3.1",
    body: { zh: "浏览社区里带声音的电影级短片", en: "Cinematic clips with sound from the community" },
    href: navModelHref("video", "veo-3.1"),
    cta: { zh: "用 Veo 3.1 生成", en: "Create with Veo 3.1" },
    media: [MEDIA.marina, MEDIA.valley, MEDIA.sea, MEDIA.showcase3, MEDIA.wind, MEDIA.planet, MEDIA.rain, MEDIA.autumn],
  },
  {
    id: "kling",
    title: "KLING 4.0",
    body: { zh: "参考图锁定人物，长达 30 秒", en: "References keep characters steady, up to 30s" },
    href: navModelHref("video", "kling/v4-reference-to-video"),
    cta: { zh: "用 Kling 4.0 生成", en: "Create with Kling 4.0" },
    media: [MEDIA.mech, MEDIA.dancer, MEDIA.tomb, MEDIA.boyDog, MEDIA.dreaming, MEDIA.carpet, MEDIA.bloom, MEDIA.studio],
  },
];
