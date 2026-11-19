// Landing pages for every model in the nav: /models/<slug>. Everything on the
// page comes from data the site already has — the nav lineup, what each model
// accepts (studio and KIE options), the credit calculator and the sample
// library — plus the hand-written copy in model-seo.ts where it exists.
import { getMarketModel, marketCredits, type MarketModel } from "@/ai/kie-market";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import { MEDIA, SAMPLE_PROMPTS, type Bi, type ShowMedia } from "@/lib/home-showcase";
import { MODEL_SEO, type ModelSeoEntry } from "@/lib/model-seo";
import {
  NAV_AUDIO_MODELS,
  NAV_IMAGE_MODELS,
  NAV_VIDEO_MODELS,
  navModelHref,
  type NavModel,
  type NavModelKind,
} from "@/lib/nav-models";

export type LandingSpec = { label: Bi; value: Bi };

export type LandingModel = {
  slug: string;
  /** Catalogue / nav id, used for the studio link. */
  id: string;
  kind: NavModelKind;
  name: string;
  desc: Bi;
  badge?: NavModel["badge"];
  tag?: string;
  /** Can generate on the site today. */
  live: boolean;
  /** Hand-written SEO copy, for the models that have it. */
  seo?: ModelSeoEntry;
};

/** "GPT Image 2.6 Sunburst" -> "gpt-image-2-6-sunburst". */
export function landingSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const LIVE_VIDEO = new Set(STUDIO_MODELS.filter((model) => model.available).map((model) => model.id));

function isLive(kind: NavModelKind, id: string): boolean {
  if (kind === "video") return LIVE_VIDEO.has(id) || Boolean(getMarketModel(id));
  return Boolean(getMarketModel(id));
}

const SEO_BY_SLUG = new Map(MODEL_SEO.map((entry) => [entry.slug, entry]));

function fromNav(kind: NavModelKind, model: NavModel): LandingModel {
  const slug = landingSlug(model.name);
  return {
    slug,
    id: model.id,
    kind,
    name: model.name,
    desc: model.desc,
    badge: model.badge,
    tag: model.tag,
    live: isLive(kind, model.id),
    seo: SEO_BY_SLUG.get(slug),
  };
}

export const LANDING_MODELS: LandingModel[] = [
  ...NAV_VIDEO_MODELS.map((model) => fromNav("video", model)),
  ...NAV_IMAGE_MODELS.map((model) => fromNav("image", model)),
  ...NAV_AUDIO_MODELS.map((model) => fromNav("audio", model)),
  // Older pages that still have links in the wild; shown as coming soon.
  ...MODEL_SEO.filter((entry) => !NAV_VIDEO_MODELS.some((model) => landingSlug(model.name) === entry.slug)).map(
    (entry): LandingModel => ({
      slug: entry.slug,
      id: entry.modelId,
      kind: "video",
      name: entry.name,
      desc: { zh: entry.zh.intro, en: entry.intro },
      live: LIVE_VIDEO.has(entry.modelId),
      seo: entry,
    }),
  ),
];

export const LANDING_SLUGS: string[] = LANDING_MODELS.map((model) => model.slug);

/** Pages offered to search engines: models that can generate today. */
export const INDEXED_LANDING_SLUGS: string[] = LANDING_MODELS.filter((model) => model.live).map((model) => model.slug);

export function getLandingModel(slug: string): LandingModel | undefined {
  return LANDING_MODELS.find((model) => model.slug === slug);
}

export function landingHref(slug: string): string {
  return `/models/${slug}`;
}

/** Studio link with the model picked, and the prompt when there is one. */
export function studioHref(model: LandingModel, prompt?: string): string {
  const base = navModelHref(model.kind, model.id);
  return prompt ? `${base}&prompt=${encodeURIComponent(prompt)}` : base;
}

const KIND_LABEL: Record<NavModelKind, Bi> = {
  video: { zh: "视频", en: "Video" },
  image: { zh: "图片", en: "Image" },
  audio: { zh: "音频", en: "Audio" },
};

export function kindLabel(kind: NavModelKind): Bi {
  return KIND_LABEL[kind];
}

/* -------------------------------------------------------------------------- */
/* What the model accepts                                                      */
/* -------------------------------------------------------------------------- */

const list = (values: (string | number)[] | undefined, suffix = "") =>
  values?.length ? values.map((value) => `${value}${suffix}`).join(" / ") : "";

function range(values: number[], suffix: string): string {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min}${suffix}` : values.length > 4 ? `${min}–${max}${suffix}` : list(values, suffix);
}

export function landingSpecs(model: LandingModel): LandingSpec[] {
  const market = getMarketModel(model.id);
  const specs: LandingSpec[] = [];
  const add = (zh: string, en: string, value: string | Bi) => {
    if (!value) return;
    specs.push({ label: { zh, en }, value: typeof value === "string" ? { zh: value, en: value } : value });
  };

  if (model.kind === "video") {
    const studio = STUDIO_MODELS.find((item) => item.id === model.id);
    add("时长", "Length", range(studio?.durations ?? market?.options.durations ?? [], "s"));
    add("分辨率", "Resolution", list(studio?.resolutions ?? market?.options.resolutions));
    add("画面比例", "Aspect ratio", list(studio?.aspects ?? market?.options.aspects));
    if (studio || market) {
      add("声音", "Sound", (studio?.audio ?? market?.options.audioToggle) ? { zh: "可同步生成", en: "Generated with the picture" } : { zh: "无声", en: "Silent" });
    }
    const refs = market?.options.maxImages ?? 0;
    add(
      "输入",
      "Input",
      market?.options.requiresImage
        ? { zh: "需要一张起始帧 + 提示词", en: "A start frame plus a prompt" }
        : refs > 1
          ? { zh: `提示词 + 最多 ${refs} 张参考图`, en: `Prompt plus up to ${refs} references` }
          : { zh: "提示词，可选起始帧", en: "Prompt, optional start frame" },
    );
  } else if (model.kind === "image") {
    const options = market?.options;
    add("分辨率", "Resolution", list(options?.resolutions));
    add("画面比例", "Aspect ratio", list(options?.aspects?.filter((value) => value !== "auto")));
    if (options?.maxCount && options.maxCount > 1) add("单次张数", "Per run", { zh: `最多 ${options.maxCount} 张`, en: `Up to ${options.maxCount}` });
    if (options?.maxImages) add("参考图", "References", { zh: `最多 ${options.maxImages} 张`, en: `Up to ${options.maxImages}` });
  } else {
    const options = market?.options;
    if (options?.voices?.length) add("音色", "Voices", { zh: `${options.voices.length} 种预设音色`, en: `${options.voices.length} preset voices` });
    if (options?.maxPromptLength) add("单次字数", "Text per run", { zh: `最多 ${options.maxPromptLength} 字`, en: `Up to ${options.maxPromptLength} characters` });
  }
  return specs;
}

/* -------------------------------------------------------------------------- */
/* Price                                                                       */
/* -------------------------------------------------------------------------- */

function cheapestMarket(market: MarketModel): number | null {
  const options = market.options;
  const durations = options.durations?.length ? options.durations : [undefined];
  const resolutions = options.resolutions?.length ? options.resolutions : [undefined];
  const prices: number[] = [];
  for (const duration of durations) {
    for (const resolution of resolutions) {
      const credits = marketCredits(market, { prompt: "x".repeat(200), duration, resolution, imageUrls: options.requiresImage ? ["ref"] : [] });
      if (credits > 0) prices.push(credits);
    }
  }
  return prices.length ? Math.min(...prices) : null;
}

/**
 * Lowest credit cost for one run, and what that run is. Audio priced by text
 * length is quoted for 200 characters.
 */
export function landingPrice(model: LandingModel): { credits: number; label: Bi } | null {
  if (!model.live) return null;
  const market = getMarketModel(model.id);
  if (model.kind === "video") {
    const studio = STUDIO_MODELS.find((item) => item.id === model.id);
    const prices: number[] = [];
    if (studio) {
      for (const duration of studio.durations) {
        for (const resolution of studio.resolutions) {
          const credits = estimateCredits({ modelId: studio.id, duration, resolution });
          if (credits > 0) prices.push(credits);
        }
      }
    }
    const fallback = market ? cheapestMarket(market) : null;
    const credits = prices.length ? Math.min(...prices) : fallback;
    return credits ? { credits, label: { zh: `${credits} 积分/条起`, en: `From ${credits} credits per clip` } } : null;
  }
  if (!market) return null;
  const credits = cheapestMarket(market);
  if (!credits) return null;
  if (model.kind === "audio") {
    const short = marketCredits(market, { prompt: "x" });
    const long = marketCredits(market, { prompt: "x".repeat(1000) });
    return short === long
      ? { credits, label: { zh: `${credits} 积分/次`, en: `${credits} credits per run` } }
      : { credits, label: { zh: `每 200 字约 ${credits} 积分`, en: `About ${credits} credits per 200 characters` } };
  }
  return { credits, label: { zh: `${credits} 积分/张起`, en: `From ${credits} credits per image` } };
}

/* -------------------------------------------------------------------------- */
/* Pictures                                                                    */
/* -------------------------------------------------------------------------- */

const VIDEO_POOL: ShowMedia[] = [MEDIA.showcase2, MEDIA.rain, MEDIA.marina, MEDIA.autumn, MEDIA.wind, MEDIA.boyDog, MEDIA.mech, MEDIA.valley, MEDIA.showcase3, MEDIA.dancer, MEDIA.sea, MEDIA.planet];
const IMAGE_POOL: ShowMedia[] = [MEDIA.carpet, MEDIA.studio, MEDIA.bloom, MEDIA.dreaming, MEDIA.tomb, MEDIA.planet, MEDIA.sea, MEDIA.dancer, MEDIA.mech, MEDIA.wind, MEDIA.rain, MEDIA.valley];
const AUDIO_POOL: ShowMedia[] = [MEDIA.dancer, MEDIA.studio, MEDIA.rain, MEDIA.autumn, MEDIA.bloom, MEDIA.dreaming];

/** Samples for the page, rotated per model so neighbouring pages differ. */
export function landingMedia(model: LandingModel, count = 6): { hero: ShowMedia; wall: { media: ShowMedia; prompt?: Bi }[] } {
  const pool = model.kind === "video" ? VIDEO_POOL : model.kind === "image" ? IMAGE_POOL : AUDIO_POOL;
  const offset = Math.max(0, LANDING_MODELS.filter((item) => item.kind === model.kind).findIndex((item) => item.slug === model.slug));
  const pick = (index: number) => pool[(offset + index) % pool.length];
  return {
    hero: pick(0),
    wall: Array.from({ length: Math.min(count, pool.length) }, (_, index) => {
      const media = pick(index + 1);
      return { media, prompt: SAMPLE_PROMPTS[media.src] };
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Words                                                                       */
/* -------------------------------------------------------------------------- */

export function landingTitle(model: LandingModel, zh: boolean): string {
  if (model.seo) return zh ? model.seo.zh.title : model.seo.title;
  const kind = kindLabel(model.kind);
  return zh ? `${model.name} AI ${kind.zh}生成器` : `${model.name} AI ${kind.en} Generator`;
}

export function landingIntro(model: LandingModel, zh: boolean): string {
  if (model.seo) return zh ? model.seo.zh.intro : model.seo.intro;
  return zh ? model.desc.zh : model.desc.en;
}

export function landingDescription(model: LandingModel, zh: boolean): string {
  if (model.seo) return zh ? model.seo.zh.description : model.seo.description;
  const kind = kindLabel(model.kind);
  return zh
    ? `在线使用 ${model.name} 生成 AI ${kind.zh}：${model.desc.zh}。生成前显示积分，失败自动退回。`
    : `Use ${model.name} online to make AI ${kind.en.toLowerCase()}: ${model.desc.en}. See the credit cost first; failed runs are refunded.`;
}

export function landingUseCases(model: LandingModel, zh: boolean): string[] {
  if (model.seo) return zh ? model.seo.zh.useCases : model.seo.useCases;
  const cases: Record<NavModelKind, { zh: string[]; en: string[] }> = {
    video: {
      zh: ["社交媒体短视频和广告素材", "把一张图片变成会动的镜头", "正式拍摄前快速试镜和分镜"],
      en: ["Short social clips and ad creative", "Turning a still image into a moving shot", "Quick tests and storyboards before a shoot"],
    },
    image: {
      zh: ["海报、封面和电商主图", "角色和场景概念设计", "给视频生成准备起始帧"],
      en: ["Posters, covers and product shots", "Character and scene concepts", "Start frames for video generation"],
    },
    audio: {
      zh: ["视频配音和旁白", "背景音乐和音效", "播客和有声内容"],
      en: ["Voiceover and narration for video", "Background music and sound effects", "Podcasts and spoken content"],
    },
  };
  return zh ? cases[model.kind].zh : cases[model.kind].en;
}

export function landingFaqs(model: LandingModel, zh: boolean): { q: string; a: string }[] {
  if (model.seo) return zh ? model.seo.zh.faqs : model.seo.faqs;
  const price = landingPrice(model);
  const kind = kindLabel(model.kind);
  const faqs = zh
    ? [
        {
          q: `${model.name} 能做什么？`,
          a: `${model.desc.zh}。上方的参数表列出了它目前在本站支持的时长、比例和画质等选项。`,
        },
        {
          q: `用 ${model.name} 生成一次要多少积分？`,
          a: price
            ? `${price.label.zh}。具体积分取决于你选的参数，点击生成前按钮上会显示本次消耗。`
            : "这个模型还没有开放生成，开放后会在生成按钮上显示每次消耗的积分。",
        },
        {
          q: "生成失败会扣积分吗？",
          a: "不会。提交时积分会先冻结，生成失败会自动退回。",
        },
        {
          q: `生成的${kind.zh}可以商用吗？`,
          a: "付费套餐生成的作品无水印，可以用于商业用途。请确保提示词和参考素材不侵犯他人权利。",
        },
      ]
    : [
        {
          q: `What can ${model.name} do?`,
          a: `${model.desc.en}. The table above lists the lengths, ratios and quality options it supports on this site today.`,
        },
        {
          q: `How many credits does ${model.name} use?`,
          a: price
            ? `${price.label.en}. The exact cost depends on the options you pick and is shown on the generate button before you start.`
            : "Generation with this model is not open yet. Once it is, the cost shows on the generate button before you start.",
        },
        {
          q: "Are credits taken if a run fails?",
          a: "No. Credits are held when you submit and returned automatically if the run fails.",
        },
        {
          q: `Can I use the ${kind.en.toLowerCase()} commercially?`,
          a: "Work made on a paid plan has no watermark and can be used commercially. Make sure your prompts and references do not infringe anyone's rights.",
        },
      ];
  return faqs;
}

/** Other models of the same kind, live ones first. */
export function relatedModels(model: LandingModel, count = 6): LandingModel[] {
  return LANDING_MODELS.filter((item) => item.kind === model.kind && item.slug !== model.slug && !(!item.live && item.seo && !item.badge))
    .sort((a, b) => Number(b.live) - Number(a.live))
    .slice(0, count);
}

/** A model the visitor can use today instead of one that is not open yet. */
export function liveAlternative(model: LandingModel): LandingModel | undefined {
  return LANDING_MODELS.find((item) => item.kind === model.kind && item.live && item.slug !== model.slug);
}
