// Content for the homepage sections below the generator. Media are the site's
// own samples; swap them for real generations as the gallery grows.
import { navModelHref } from "@/lib/nav-models";
import featurePrompts from "@/lib/home-feature-prompts.json";

export type Bi = { zh: string; en: string };
export type ShowMedia = { src: string; video?: boolean; poster?: string; promptId?: string };

const S = (name: string): ShowMedia => ({ src: `/home/samples/${name}.webp` });
const V = (name: string, poster?: string, promptId?: string): ShowMedia => ({ src: `/home/${name}.mp4`, video: true, poster, promptId });

export const MEDIA = {
  marina: V("hero-marina-loop", "/home/hero-marina-poster.webp"),
  // Silent first six seconds of example_videos/日本.mp4 for the homepage card.
  japan: V("example-japan-6s", "/home/example-japan-6s-poster.webp", "japan"),
  showcase2: V("hero-showcase-02"),
  // Silent first seven seconds of example_videos/鲸鱼折纸.mp4 for the carousel.
  whaleOrigami: V("example-whale-origami-7s", "/home/example-whale-origami-7s-poster.webp", "whale"),
  // Silent 22–29s cut of example_videos/炸鸡.mp4 for the carousel.
  friedChicken: V("example-fried-chicken-22-29", "/home/example-fried-chicken-22-29-poster.webp", "friedChicken"),
  // Silent 21–24s cut of example_videos/僵尸小猫.mp4 for the carousel.
  zombieKitten: V("example-zombie-kitten-21-24", "/home/example-zombie-kitten-21-24-poster.webp"),
  dragon: V("example-dragon-full", "/home/example-dragon-full-poster.webp", "dragon"),
  dress: V("example-dress-10-20", "/home/example-dress-10-20-poster.webp", "dress"),
  samuraiCat: V("example-samurai-cat-7s", "/home/example-samurai-cat-7s-poster.webp", "samuraiCat"),
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
    media: MEDIA.japan,
    cover: { main: "+70", sub: { zh: "免费积分", en: "FREE CREDITS" } },
    title: { zh: "新用户注册即送 70 积分", en: "70 free credits for new accounts" },
    body: { zh: "免费生成你的第一条视频", en: "Make your first video free" },
    href: "/pricing",
    accent: true,
  },
  {
    media: MEDIA.whaleOrigami,
    cover: { main: "SEEDANCE 2.5", sub: { zh: "1080P · 有声", en: "1080P · SOUND" } },
    title: { zh: "SEEDANCE 2.5 已上线", en: "SEEDANCE 2.5 IS LIVE" },
    body: { zh: "电影级画面和同步声音，最高 1080p", en: "Cinematic video with synced sound, up to 1080p" },
    href: withPrompt(navModelHref("video", "bytedance/seedance-2-5"), featurePrompts.whale),
  },
  {
    media: MEDIA.friedChicken,
    cover: { main: "VEO 3.1", sub: { zh: "画面 + 声音", en: "WITH SOUND" } },
    title: { zh: "VEO 3.1 有声短片", en: "VEO 3.1 WITH SOUND" },
    body: { zh: "画面和声音一起生成", en: "Picture and sound in one pass" },
    href: navModelHref("video", "veo-3.1"),
  },
  {
    media: MEDIA.zombieKitten,
    cover: { main: "AGENT", sub: { zh: "一句话 · 一条片", en: "ONE LINE · ONE FILM" } },
    title: { zh: "创作空间 AGENT", en: "CREATIVE SPACE AGENT" },
    body: { zh: "说出想法，自动拆成分镜再生成", en: "Say the idea; it plans the shots" },
    href: "/creative-space/canvas",
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
export const PRODUCT_TILES: { title: string | Bi; badge?: Bi; tag?: string; body: Bi; href: string; icon: "film" | "spark" | "image" | "wave" | "layers" | "orbit" }[] = [
  { title: "Seedance 2.5", tag: "1080P", body: { zh: "新一代视频模型", en: "The new video model" }, href: navModelHref("video", "bytedance/seedance-2-5"), icon: "film" },
  { title: "Kling 4.0", badge: { zh: "新", en: "New" }, body: { zh: "参考图生成，人物一致", en: "Reference-driven, consistent characters" }, href: navModelHref("video", "kling/v4-reference-to-video"), icon: "orbit" },
  { title: { zh: "创作空间 Agent", en: "Creative Space Agent" }, badge: { zh: "新", en: "New" }, body: { zh: "一句话拆成分镜并生成", en: "One line becomes a shot plan" }, href: "/creative-space", icon: "spark" },
  { title: "Nano Banana Pro", badge: { zh: "热门", en: "Hot" }, body: { zh: "出色的 4K 图像模型", en: "An excellent 4K image model" }, href: navModelHref("image", "nano-banana-pro"), icon: "image" },
  { title: "Eleven v3", badge: { zh: "新", en: "New" }, body: { zh: "富有表现力的 AI 配音", en: "Expressive AI voiceover" }, href: navModelHref("audio", "elevenlabs-v3"), icon: "wave" },
  { title: "GPT Image 2.6", badge: { zh: "新", en: "New" }, body: { zh: "品质出众，编辑精准", en: "Outstanding quality, precise edits" }, href: navModelHref("image", "gpt-image-2-6-sunburst"), icon: "layers" },
];

/**
 * 4–5. Model galleries, each a title, a line and a masonry of media. Two walls
 * that share no samples, so the same picture does not come round again.
 */
export const MODEL_GALLERIES: { id: string; title: string; heading: Bi; body: Bi; href: string; cta: Bi; media: ShowMedia[] }[] = [
  {
    id: "seedance",
    // The model name is the small label; the heading says what the wall shows.
    title: "Seedance 2.5",
    heading: { zh: "文字生成视频", en: "Text to Video" },
    body: { zh: "新一代 AI 视频模型", en: "The next-generation AI video model" },
    href: navModelHref("video", "bytedance/seedance-2-5"),
    cta: { zh: "用 Seedance 2.5 生成", en: "Create with Seedance 2.5" },
    media: [MEDIA.zombieKitten, MEDIA.japan, MEDIA.whaleOrigami, MEDIA.friedChicken, MEDIA.dragon, MEDIA.dress, MEDIA.samuraiCat],
  },
  {
    id: "nano-banana",
    title: "Nano Banana Pro",
    heading: { zh: "AI 图片生成", en: "AI Image Generator" },
    body: { zh: "4K 图像，细节与文字渲染出色", en: "4K images with fine detail and text" },
    href: navModelHref("image", "nano-banana-pro"),
    cta: { zh: "用 Nano Banana Pro 生成", en: "Create with Nano Banana Pro" },
    // Further down the page, past the canvas banner, so it can carry the
    // story samples the first wall leaves out.
    media: [MEDIA.carpet, MEDIA.rain, MEDIA.dreaming, MEDIA.boyDog, MEDIA.bloom, MEDIA.autumn, MEDIA.wind],
  },
];

/** The three steps under the first screen: what a visitor does to get a video. */
export const HOW_STEPS: { title: Bi; body: Bi }[] = [
  {
    title: { zh: "描述你想要的画面", en: "Describe it" },
    body: { zh: "写一句想看到的画面，或者上传一张起始图片让它动起来。", en: "Type what you want to see, or add a start image for the model to animate." },
  },
  {
    title: { zh: "选一个模型", en: "Pick a model" },
    body: {
      zh: "选 Veo 3.1、Seedance 2.5、Kling 4.0 或其他模型，再定时长、画幅和声音。开始前就能看到要花多少积分。",
      en: "Choose Veo 3.1, Seedance 2.5, Kling 4.0 or another model, then set the length, shape and sound. The credit cost shows before you start.",
    },
  },
  {
    title: { zh: "生成并下载", en: "Generate and download" },
    body: { zh: "视频在后台生成，完成后保存在“我的作品”里，可以直接下载。", en: "The video is made in the background and saved to My creations, where you can download it." },
  },
];

/**
 * "Make one like this" prompts for the sample media: a recipe that produces
 * something in the same spirit, offered on the walls. They describe the
 * picture; they are not the record of how each sample was made.
 */
export const SAMPLE_PROMPTS: Record<string, Bi> = {
  "/home/hero-marina-loop.mp4": { zh: "一群朋友在码头边的船屋甲板上举杯庆祝，香槟飞溅，阴天柔光，手持跟拍", en: "Friends toasting on a houseboat deck by the marina, champagne spraying, soft overcast light, handheld follow shot" },
  "/home/hero-showcase-02.mp4": { zh: "公园树下一对情侣相视而笑、牵起手，男生脸颊上慢慢浮现发光的红色裂纹，变身特效，自然光", en: "A couple in a park smile at each other and hold hands as glowing red cracks slowly spread across his cheek, transformation effect, natural light" },
  "/home/hero-showcase-03.mp4": { zh: "林荫公园里的一对情侣牵着手，皮肤逐渐裂开、泛出绿色荧光，从微笑的普通人变身成丧尸，变身特效", en: "A couple holding hands in a leafy park as their skin cracks and glows green, turning from smiling people into zombies, transformation effect" },
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

/** Keep long example prompts out of the URL; the studio resolves the ID. */
export function withExamplePrompt(href: string, promptId: string | undefined): string {
  if (!promptId) return href;
  return `${href}${href.includes("?") ? "&" : "?"}sample=${encodeURIComponent(promptId)}`;
}
