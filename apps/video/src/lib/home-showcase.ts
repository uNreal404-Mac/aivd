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
export const FEATURE_SLIDES: {
  media: ShowMedia;
  /** Big lettering set on the picture, the way the reference designs its covers. */
  cover: { main: string; sub: Bi };
  title: Bi;
  body: Bi;
  href: string;
  accent?: boolean;
}[] = [
  {
    media: MEDIA.marina,
    cover: { main: "+70", sub: { zh: "免费积分", en: "FREE CREDITS" } },
    title: { zh: "新用户注册即送 70 积分", en: "70 free credits for new accounts" },
    body: { zh: "免费生成你的第一条视频", en: "Make your first video free" },
    href: "/pricing",
    accent: true,
  },
  {
    media: MEDIA.showcase2,
    cover: { main: "SEEDANCE 2.5", sub: { zh: "1080P · 有声", en: "1080P · SOUND" } },
    title: { zh: "SEEDANCE 2.5 已上线", en: "SEEDANCE 2.5 IS LIVE" },
    body: { zh: "电影级画面和同步声音，最高 1080p", en: "Cinematic video with synced sound, up to 1080p" },
    href: navModelHref("video", "bytedance/seedance-2-5"),
  },
  {
    media: MEDIA.valley,
    cover: { main: "VEO 3.1", sub: { zh: "画面 + 声音", en: "WITH SOUND" } },
    title: { zh: "VEO 3.1 有声短片", en: "VEO 3.1 WITH SOUND" },
    body: { zh: "画面和声音一起生成", en: "Picture and sound in one pass" },
    href: navModelHref("video", "veo-3.1"),
  },
  {
    media: MEDIA.bloom,
    cover: { main: "AGENT", sub: { zh: "一句话 · 一条片", en: "ONE LINE · ONE FILM" } },
    title: { zh: "创作空间 AGENT", en: "CREATIVE SPACE AGENT" },
    body: { zh: "说出想法，自动拆成分镜再生成", en: "Say the idea; it plans the shots" },
    href: "/creative-space",
  },
  {
    media: MEDIA.carpet,
    cover: { main: "NANO BANANA", sub: { zh: "PRO · 4K", en: "PRO · 4K" } },
    title: { zh: "NANO BANANA PRO 4K", en: "NANO BANANA PRO 4K" },
    body: { zh: "Google 出品的高清图像模型", en: "Google's high-resolution image model" },
    href: navModelHref("image", "nano-banana-pro"),
  },
  {
    media: MEDIA.dancer,
    cover: { main: "SUNO V6", sub: { zh: "一句话写歌", en: "SONGS FROM ONE LINE" } },
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

/**
 * 4–5. Model galleries, each a title, a line and a masonry of media. Two walls
 * that share no samples, so the same picture does not come round again.
 */
export const MODEL_GALLERIES: { id: string; title: string; body: Bi; href: string; cta: Bi; media: ShowMedia[] }[] = [
  {
    id: "seedance",
    title: "SEEDANCE 2.5",
    body: { zh: "新一代 AI 视频模型", en: "The next-generation AI video model" },
    href: navModelHref("video", "bytedance/seedance-2-5"),
    cta: { zh: "用 Seedance 2.5 生成", en: "Create with Seedance 2.5" },
    media: [MEDIA.showcase2, MEDIA.rain, MEDIA.boyDog, MEDIA.autumn, MEDIA.wind, MEDIA.mech, MEDIA.dancer, MEDIA.valley],
  },
  {
    id: "nano-banana",
    title: "NANO BANANA PRO",
    body: { zh: "4K 图像，细节与文字渲染出色", en: "4K images with fine detail and text" },
    href: navModelHref("image", "nano-banana-pro"),
    cta: { zh: "用 Nano Banana Pro 生成", en: "Create with Nano Banana Pro" },
    media: [MEDIA.carpet, MEDIA.studio, MEDIA.bloom, MEDIA.dreaming, MEDIA.tomb, MEDIA.planet, MEDIA.sea],
  },
];

/**
 * "Make one like this" prompts for the sample media: a recipe that produces
 * something in the same spirit, offered on the walls. They describe the
 * picture; they are not the record of how each sample was made.
 */
export const SAMPLE_PROMPTS: Record<string, Bi> = {
  "/home/hero-marina-loop.mp4": { zh: "一群朋友在码头边的船屋甲板上举杯庆祝，香槟飞溅，阴天柔光，手持跟拍", en: "Friends toasting on a houseboat deck by the marina, champagne spraying, soft overcast light, handheld follow shot" },
  "/home/hero-showcase-02.mp4": { zh: "一对年轻情侣在公园树下对着镜头微笑，自然光，背景虚化，镜头缓慢推近", en: "A young couple smiling at the camera under park trees, natural light, soft background, slow push-in" },
  "/home/hero-showcase-03.mp4": { zh: "一对情侣在林荫公园里并肩站着，相视而笑，午后暖光，轻微环绕运镜", en: "A couple standing side by side in a leafy park, smiling, warm afternoon light, gentle orbit" },
  "/home/samples/boy-and-dog.webp": { zh: "雾气弥漫的老街，穿呢子大衣的小男孩和一只小狗站在石板路上，路灯昏黄，电影感", en: "A misty old street, a small boy in a wool coat and a scruffy dog on wet cobblestones, amber streetlamps, cinematic" },
  "/home/samples/autumn-walk.webp": { zh: "一对白发老人在红枫林小路上并肩散步，落叶铺地，柔和自然光", en: "A white-haired couple walking side by side down a red maple path, fallen leaves, soft natural light" },
  "/home/samples/rain-couple.webp": { zh: "大雨中的一对情侣额头相抵，浑身湿透，背后霓虹虚化，电影感特写", en: "A couple forehead to forehead in heavy rain, soaked, neon bokeh behind, cinematic close-up" },
  "/home/samples/mountain-wind.webp": { zh: "长裙女子坐在山顶岩石上，长发和裙摆被风吹起，远山云海，黄昏侧光", en: "A woman in a flowing dress sitting on a summit rock, hair and dress lifted by wind, distant hills, golden side light" },
  "/home/samples/cosmic-bloom.webp": { zh: "半透明的紫色花朵在深空中发光，花芯金色，周围漂浮光粒，微距景深", en: "A translucent violet flower glowing in deep space, golden core, drifting light particles, macro depth of field" },
  "/home/samples/mountain-valley.webp": { zh: "暴雨将至的高山峡谷，云雾缠绕山峰，前景松树，冷色调广角", en: "An alpine valley before a storm, clouds wrapping the peaks, pines in the foreground, cool wide angle" },
  "/home/samples/storm-sea.webp": { zh: "翻涌的紫蓝色云浪，金色光尘四散，抽象而壮阔", en: "Surging violet-blue waves of cloud, golden dust scattering, abstract and vast" },
  "/home/samples/dancer.webp": { zh: "穿水手服的舞者在影棚里轻盈起跳，干净灰色背景，高速快门", en: "A dancer in a sailor dress leaping lightly in a studio, clean grey backdrop, fast shutter" },
  "/home/samples/planet-impact.webp": { zh: "小行星撞上行星的瞬间，火焰与碎石喷射，太空视角，史诗感", en: "The moment an asteroid strikes a planet, fire and debris bursting out, view from space, epic" },
  "/home/samples/tomb-light.webp": { zh: "古埃及墓室，一束光从顶部洞口照在金色石棺上，壁画斑驳，尘埃漂浮", en: "An ancient Egyptian tomb, a shaft of light from above on a golden sarcophagus, faded murals, floating dust" },
  "/home/samples/mech-warrior.webp": { zh: "身穿银色机甲的女战士持枪站在红色荒漠，身后巨大怪兽张开血口，夕阳光", en: "A woman in silver power armour holding a rifle in a red desert, a giant beast roaring behind her, sunset light" },
  "/home/samples/dreaming.webp": { zh: "卷发女子在昏暗房间里枕着花纹枕头熟睡，一束柔光落在脸上，油画质感", en: "A curly-haired woman asleep on a floral pillow in a dim room, soft light on her face, painterly" },
  "/home/samples/red-carpet.webp": { zh: "红毯上的女演员，粉色高开衩长裙，身后摄影师闪光灯，85mm 人像", en: "An actress on the red carpet in a pink high-slit gown, photographers flashing behind, 85mm portrait" },
  "/home/samples/studio-room.webp": { zh: "夜晚的未来感工作室，落地窗，巨幅屏幕和多屏工作台，冷蓝灯光", en: "A futuristic studio at night, floor-to-ceiling windows, a giant screen and multi-monitor desk, cool blue light" },
};

/** Add a prompt to a studio link, keeping any query it already has. */
export function withPrompt(href: string, prompt: string | undefined): string {
  if (!prompt) return href;
  return `${href}${href.includes("?") ? "&" : "?"}prompt=${encodeURIComponent(prompt)}`;
}
