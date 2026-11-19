import { localizedHref } from "@/lib/locale-path";

export const EXPLORE_CATEGORIES = [
  "all",
  "cinematic",
  "anime",
  "product",
  "portrait",
  "nature",
  "effects",
] as const;

export type ExploreCategory = (typeof EXPLORE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<
  ExploreCategory,
  { en: string; zh: string }
> = {
  all: { en: "All", zh: "全部" },
  cinematic: { en: "Cinematic", zh: "电影感" },
  anime: { en: "Anime", zh: "动漫" },
  product: { en: "Product", zh: "产品" },
  portrait: { en: "Portrait", zh: "人像" },
  nature: { en: "Nature", zh: "自然" },
  effects: { en: "Effects", zh: "特效" },
};

export const EXPLORE_MODELS = [
  { id: "seedance-1.5-pro", name: "Seedance 1.5 Pro" },
  { id: "wan2.6", name: "Wan 2.6" },
  { id: "veo-3.1", name: "Veo 3.1" },
  { id: "sora-2", name: "Sora 2" },
] as const;

export type ExploreModelId = (typeof EXPLORE_MODELS)[number]["id"];

export type ExploreItem = {
  id: string;
  category: Exclude<ExploreCategory, "all">;
  title: { en: string; zh: string };
  prompt: string;
  modelId: ExploreModelId;
  image: string;
  width: number;
  height: number;
  video?: string;
};

export const EXPLORE_ITEMS: ExploreItem[] = [
  {
    id: "explore-01",
    category: "cinematic",
    title: { en: "Rain-Slicked Alley", zh: "雨夜小巷" },
    prompt:
      "A lone figure walks through a rain-slicked neon alley at night, reflections rippling underfoot as steam rises from the grates.",
    modelId: "seedance-1.5-pro",
    image: "/explore/explore-01.webp",
    width: 640,
    height: 800,
  },
  {
    id: "explore-02",
    category: "anime",
    title: { en: "Skybound Kite", zh: "天空风筝" },
    prompt:
      "A girl runs across a windblown hill chasing a red kite, hair streaming behind her in soft cel-shaded light.",
    modelId: "wan2.6",
    image: "/explore/explore-02.webp",
    width: 640,
    height: 640,
  },
  {
    id: "explore-03",
    category: "product",
    title: { en: "Amber Bottle Spin", zh: "琥珀瓶旋转" },
    prompt:
      "An amber glass bottle rotates slowly on a matte pedestal, warm rim light glinting across its curved surface.",
    modelId: "veo-3.1",
    image: "/explore/explore-03.webp",
    width: 640,
    height: 960,
  },
  {
    id: "explore-04",
    category: "portrait",
    title: { en: "Window Light Portrait", zh: "窗边光影" },
    prompt:
      "A close portrait of a woman lit by a single soft window, dust motes drifting through the beam as she turns toward the camera.",
    modelId: "sora-2",
    image: "/explore/explore-04.webp",
    width: 640,
    height: 480,
  },
  {
    id: "explore-05",
    category: "nature",
    title: { en: "Misty Pine Ridge", zh: "雾中松岭" },
    prompt:
      "Morning fog rolls between pine ridges as the first light spills over the mountain and birds cross the frame.",
    modelId: "seedance-1.5-pro",
    image: "/explore/explore-05.webp",
    width: 640,
    height: 800,
  },
  {
    id: "explore-06",
    category: "effects",
    title: { en: "Liquid Ink Bloom", zh: "墨液绽放" },
    prompt:
      "Drops of black ink bloom into clear water, their tendrils unfurling in slow motion against a bright backlit tank.",
    modelId: "wan2.6",
    image: "/explore/explore-06.webp",
    width: 640,
    height: 640,
  },
  {
    id: "explore-07",
    category: "cinematic",
    title: { en: "Last Train Home", zh: "末班列车" },
    prompt:
      "A traveler watches city lights streak past a night train window, her reflection hovering over the moving blur.",
    modelId: "veo-3.1",
    image: "/explore/explore-07.webp",
    width: 640,
    height: 960,
  },
  {
    id: "explore-08",
    category: "anime",
    title: { en: "Rooftop Ramen", zh: "天台拉面" },
    prompt:
      "Two friends share steaming ramen on a rooftop at dusk, warm lamps glowing as the city fades to blue.",
    modelId: "sora-2",
    image: "/explore/explore-08.webp",
    width: 640,
    height: 480,
  },
  {
    id: "explore-09",
    category: "product",
    title: { en: "Sneaker Suspension", zh: "悬浮球鞋" },
    prompt:
      "A white sneaker floats mid-air and rotates slowly, tiny dust particles catching a hard studio key light.",
    modelId: "seedance-1.5-pro",
    image: "/explore/explore-09.webp",
    width: 640,
    height: 800,
  },
  {
    id: "explore-10",
    category: "portrait",
    title: { en: "Golden Hour Freckles", zh: "金色雀斑" },
    prompt:
      "Sunlight grazes a freckled face during golden hour, a faint smile forming as the camera drifts closer.",
    modelId: "wan2.6",
    image: "/explore/explore-10.webp",
    width: 640,
    height: 640,
  },
  {
    id: "explore-11",
    category: "nature",
    title: { en: "Tidepool Mirror", zh: "潮池之镜" },
    prompt:
      "A shallow tidepool mirrors the clouds while a wave folds over the rocks and settles into glassy stillness.",
    modelId: "veo-3.1",
    image: "/explore/explore-11.webp",
    width: 640,
    height: 960,
  },
  {
    id: "explore-12",
    category: "effects",
    title: { en: "Prism Split", zh: "棱镜分光" },
    prompt:
      "A beam of light passes through a spinning prism, splitting into color bands that sweep across a dark room.",
    modelId: "sora-2",
    image: "/explore/explore-12.webp",
    width: 640,
    height: 480,
  },
  {
    id: "explore-13",
    category: "cinematic",
    title: { en: "Harbor at Blue Hour", zh: "蓝调港湾" },
    prompt:
      "Cranes and masts stand against a deep blue harbor sky while a lone boat drifts out toward the horizon.",
    modelId: "seedance-1.5-pro",
    image: "/explore/explore-13.webp",
    width: 640,
    height: 800,
  },
  {
    id: "explore-14",
    category: "anime",
    title: { en: "Cherry Blossom Chase", zh: "樱花追逐" },
    prompt:
      "Petals swirl around a boy sprinting down a stone stairway, school bag swinging in bright spring light.",
    modelId: "wan2.6",
    image: "/explore/explore-14.webp",
    width: 640,
    height: 640,
  },
  {
    id: "explore-15",
    category: "product",
    title: { en: "Watch on Velvet", zh: "丝绒腕表" },
    prompt:
      "A slim watch rests on dark velvet as light sweeps across the dial, the second hand ticking in macro detail.",
    modelId: "veo-3.1",
    image: "/explore/explore-15.webp",
    width: 640,
    height: 960,
  },
  {
    id: "explore-16",
    category: "portrait",
    title: { en: "Studio Smoke Portrait", zh: "影棚烟雾人像" },
    prompt:
      "A backlit portrait emerges through drifting studio smoke, edges glowing as the subject holds a steady gaze.",
    modelId: "sora-2",
    image: "/explore/explore-16.webp",
    width: 640,
    height: 480,
  },
  {
    id: "explore-17",
    category: "nature",
    title: { en: "Desert Dune Wind", zh: "沙丘之风" },
    prompt:
      "Wind peels fine sand from a dune crest, ribboning across the desert under a low and burning sun.",
    modelId: "seedance-1.5-pro",
    image: "/explore/explore-17.webp",
    width: 640,
    height: 800,
  },
  {
    id: "explore-18",
    category: "effects",
    title: { en: "Ember Storm", zh: "余烬风暴" },
    prompt:
      "Glowing embers spiral upward in a dark frame, flickering orange sparks scattering into black.",
    modelId: "wan2.6",
    image: "/explore/explore-18.webp",
    width: 640,
    height: 640,
  },
  {
    id: "explore-19",
    category: "cinematic",
    title: { en: "Snowfall on the Platform", zh: "月台初雪" },
    prompt:
      "Snow falls steadily over an empty station platform, a single lamp casting long shadows on the tracks.",
    modelId: "veo-3.1",
    image: "/explore/explore-19.webp",
    width: 640,
    height: 960,
  },
  {
    id: "explore-20",
    category: "anime",
    title: { en: "Spirit Lantern Drift", zh: "灵灯漂流" },
    prompt:
      "Paper lanterns drift down a quiet river at night, their warm reflections trembling on the dark water.",
    modelId: "sora-2",
    image: "/explore/explore-20.webp",
    width: 640,
    height: 480,
  },
  {
    id: "explore-21",
    category: "product",
    title: { en: "Coffee Pour Macro", zh: "咖啡微距" },
    prompt:
      "A macro shot of dark coffee pouring into a cup, crema swirling and steam curling in the morning light.",
    modelId: "seedance-1.5-pro",
    image: "/explore/explore-21.webp",
    width: 640,
    height: 800,
  },
  {
    id: "explore-22",
    category: "portrait",
    title: { en: "Rainy Window Gaze", zh: "雨窗凝视" },
    prompt:
      "A man watches the street through a rain-beaded window, city bokeh shifting softly behind the glass.",
    modelId: "wan2.6",
    image: "/explore/explore-22.webp",
    width: 640,
    height: 640,
  },
  {
    id: "explore-23",
    category: "nature",
    title: { en: "Waterfall Breath", zh: "瀑布吐息" },
    prompt:
      "A tall waterfall drops into a mossy basin, mist rising and drifting through shafts of forest light.",
    modelId: "veo-3.1",
    image: "/explore/explore-23.webp",
    width: 640,
    height: 960,
  },
  {
    id: "explore-24",
    category: "effects",
    title: { en: "Chrome Liquid Metal", zh: "液态铬" },
    prompt:
      "A blob of liquid chrome stretches and reforms into a sphere, reflecting a vivid gradient backdrop.",
    modelId: "sora-2",
    image: "/explore/explore-24.webp",
    width: 640,
    height: 480,
  },
];

export function filterExplore(
  items: ExploreItem[],
  category: ExploreCategory,
): ExploreItem[] {
  if (category === "all") return items;
  return items.filter((item) => item.category === category);
}

export function buildUsePromptHref(lang: string, item: ExploreItem): string {
  return localizedHref(lang, `/ai/video?prompt=${encodeURIComponent(item.prompt)}&model=${encodeURIComponent(item.modelId)}`);
}

export function modelName(id: string): string {
  const model = EXPLORE_MODELS.find((m) => m.id === id);
  return model ? model.name : id;
}

export type ExploreCopy = {
  title: string;
  heading: string;
  sub: string;
  use: string;
  empty: string;
};

export const EXPLORE_COPY: Record<"en" | "zh", ExploreCopy> = {
  en: {
    title: "Explore",
    heading: "Explore what people are making",
    sub: "Browse sample clips by style and reuse any prompt in the studio.",
    use: "Use this prompt",
    empty: "Nothing here yet.",
  },
  zh: {
    title: "探索",
    heading: "看看大家在创作什么",
    sub: "按风格浏览示例，任意提示词一键带到创作页。",
    use: "使用此提示词",
    empty: "暂无内容",
  },
};

export type ExploreLocale = keyof typeof EXPLORE_COPY;

export function copyFor(locale: string): ExploreCopy {
  return locale === "zh" ? EXPLORE_COPY.zh : EXPLORE_COPY.en;
}
