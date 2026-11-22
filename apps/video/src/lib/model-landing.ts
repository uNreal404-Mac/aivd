// Landing pages for every model in the nav: /models/<slug>. Everything on the
// page comes from data the site already has — the nav lineup, what each model
// accepts (studio and KIE options), the credit calculator and the sample
// library — plus the hand-written copy in model-seo.ts where it exists.
import { getMarketModel, marketCredits, type MarketModel } from "@/ai/kie-market";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import { MEDIA, SAMPLE_PROMPTS, type Bi, type ShowMedia } from "@/lib/home-showcase";
import { MODEL_SEO, type ModelSeoEntry } from "@/lib/model-seo";
import { planCostRange } from "@/lib/pricing-offers";
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

/** A headline number for the spec section: big figure, unit and label. */
export type LandingHighlight = { big: string; unit: Bi; label: Bi };

const RES_RANK = ["360p", "480p", "540p", "720p", "768p", "1080p", "1k", "2k", "4k", "8k"];

function topResolution(values: string[] | undefined): string | null {
  if (!values?.length) return null;
  return [...values].sort((a, b) => RES_RANK.indexOf(b.toLowerCase()) - RES_RANK.indexOf(a.toLowerCase()))[0];
}

/**
 * The few numbers worth printing large, read from what the model accepts on
 * this site. Nothing is shown that the studio does not offer.
 */
export function landingHighlights(model: LandingModel): LandingHighlight[] {
  const market = getMarketModel(model.id);
  const studio = STUDIO_MODELS.find((item) => item.id === model.id);
  const out: LandingHighlight[] = [];
  const durations = studio?.durations ?? market?.options.durations ?? [];
  const resolutions = studio?.resolutions ?? market?.options.resolutions;
  const aspects = (studio?.aspects ?? market?.options.aspects ?? []).filter((value) => value !== "auto");
  if (model.kind === "video" && durations.length) {
    out.push({ big: String(Math.max(...durations)), unit: { zh: "秒", en: "s" }, label: { zh: "单条最长时长", en: "Longest clip" } });
  }
  const top = topResolution(resolutions);
  if (top) out.push({ big: top.toUpperCase().replace("P", "p"), unit: { zh: "", en: "" }, label: { zh: "最高画质", en: "Top resolution" } });
  if (aspects.length > 1) out.push({ big: String(aspects.length), unit: { zh: "种", en: "" }, label: { zh: "画面比例", en: "Aspect ratios" } });
  const refs = market?.options.maxImages ?? 0;
  if (refs > 1) out.push({ big: String(refs), unit: { zh: "张", en: "" }, label: { zh: "参考图", en: "Reference images" } });
  if (market?.options.maxCount && market.options.maxCount > 1) {
    out.push({ big: String(market.options.maxCount), unit: { zh: "张", en: "" }, label: { zh: "单次生成", en: "Per run" } });
  }
  if (model.kind === "video" && (studio?.audio ?? market?.options.audioToggle)) {
    out.push({ big: "♪", unit: { zh: "", en: "" }, label: { zh: "画面和声音一起生成", en: "Sound with the picture" } });
  }
  if (market?.options.voices?.length) {
    out.push({ big: String(market.options.voices.length), unit: { zh: "种", en: "" }, label: { zh: "预设音色", en: "Preset voices" } });
  }
  const price = landingPrice(model);
  if (price) out.push({ big: String(price.credits), unit: { zh: "积分", en: "credits" }, label: { zh: model.kind === "video" ? "每条起" : model.kind === "image" ? "每张起" : "起", en: "from" } });
  return out.slice(0, 5);
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

export type LandingPriceRow = { option: Bi; credits: number; cost: string };

/**
 * What one run costs, option by option (every length and quality the
 * generator offers, cheapest first), with what that comes to on a plan. For
 * the "How much does it cost" section, which answers price searches in a
 * sentence and a table.
 */
export function landingPriceRows(model: LandingModel): LandingPriceRow[] {
  if (!model.live) return [];
  const studio = model.kind === "video" ? STUDIO_MODELS.find((item) => item.id === model.id) : undefined;
  if (studio) {
    const rows: LandingPriceRow[] = [];
    for (const resolution of studio.resolutions) {
      for (const duration of studio.durations) {
        const credits = estimateCredits({ modelId: studio.id, duration, resolution });
        if (credits > 0) rows.push({ option: { zh: `${duration} 秒 · ${resolution}`, en: `${duration}s · ${resolution}` }, credits, cost: planCostRange(credits) });
      }
    }
    return rows.sort((a, b) => a.credits - b.credits).slice(0, 8);
  }
  const price = landingPrice(model);
  if (!price) return [];
  const option =
    model.kind === "image"
      ? { zh: "每张，最低画质", en: "Per image, lowest quality" }
      : model.kind === "audio"
        ? { zh: price.label.zh.includes("200") ? "每 200 字" : "每次", en: price.label.en.includes("200") ? "Per 200 characters" : "Per run" }
        : { zh: "每条，最低配置", en: "Per clip, lowest settings" };
  return [{ option, credits: price.credits, cost: planCostRange(price.credits) }];
}

/** The one-sentence answer above the price table. */
export function landingPriceAnswer(model: LandingModel, zh: boolean, giftCredits: number): string | null {
  const rows = landingPriceRows(model);
  if (!rows.length) return null;
  const first = rows[0];
  const unit = model.kind === "video" ? (zh ? "条" : "clip") : model.kind === "image" ? (zh ? "张" : "image") : zh ? "次" : "run";
  const covered = giftCredits >= first.credits;
  if (zh) {
    return `在 aivd.ai 用 ${model.name} 生成一${unit}，最低 ${first.credits} 积分（${first.option.zh}），按订阅套餐的积分单价约合 ${first.cost}。${covered ? `新注册送的 ${giftCredits} 积分够生成一${unit}。` : ""}生成前按钮上会显示本次要用的积分，失败自动退回。`;
  }
  return `On aivd.ai, one ${model.name} ${unit} starts at ${first.credits} credits (${first.option.en}), about ${first.cost} at subscription credit prices.${covered ? ` The ${giftCredits} free credits new accounts get cover one ${unit}.` : ""} The generate button shows the exact cost first, and failed runs are refunded.`;
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
          a: "可以，包括用免费积分生成的作品。请确保提示词和参考素材不侵犯他人权利。",
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
          a: "Yes, including work made with the free credits. Make sure your prompts and references do not infringe anyone's rights.",
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
