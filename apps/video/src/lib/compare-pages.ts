/**
 * Model comparison pages: /compare/<a>-vs-<b>. Each answers "A vs B" in its
 * first paragraph, then lays the two models side by side in a table, says
 * when each one fits, and answers the usual questions. Every figure (lengths,
 * resolutions, sound, references, credits, the cost on a plan) is read from
 * the same model and pricing config as the generator, and the "when to pick"
 * advice is built only from the figures that actually differ, so a page can
 * never claim more than the models do here.
 */
import { getMarketModel } from "@/ai/kie-market";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { STUDIO_MODELS } from "@/lib/ai-video-studio";
import { type LandingModel, getLandingModel, landingPriceRows, landingSpecs } from "@/lib/model-landing";

/** The comparisons, by URL slug; both sides must be live video models. */
const PAIRS = [
  { slug: "veo-3-1-vs-kling-4", a: "veo-3-1", b: "kling-4-0" },
  { slug: "seedance-2-5-vs-kling-4", a: "seedance-2-5", b: "kling-4-0" },
  { slug: "seedance-2-5-vs-veo-3-1", a: "seedance-2-5", b: "veo-3-1" },
] as const;

type Side = {
  model: LandingModel;
  maxSeconds: number;
  maxResolution: number;
  sound: boolean;
  references: number;
  credits: number;
  option: { zh: string; en: string };
  cost: string;
};

export type ComparePage = {
  slug: string;
  a: LandingModel;
  b: LandingModel;
  title: string;
  description: string;
  h1: string;
  answer: string;
  columns: [string, string, string];
  rows: { label: string; a: string; b: string }[];
  pickTitle: (name: string) => string;
  pickA: string[];
  pickB: string[];
  faqs: { q: string; a: string }[];
};

function side(model: LandingModel): Side | null {
  const rows = landingPriceRows(model);
  if (!model.live || model.kind !== "video" || !rows.length) return null;
  const studio = STUDIO_MODELS.find((item) => item.id === model.id);
  const market = getMarketModel(model.id);
  const durations = studio?.durations ?? market?.options.durations ?? [];
  const resolutions = (studio?.resolutions ?? market?.options.resolutions ?? []).map((value) => Number.parseInt(String(value), 10)).filter(Number.isFinite);
  return {
    model,
    maxSeconds: durations.length ? Math.max(...durations) : 0,
    maxResolution: resolutions.length ? Math.max(...resolutions) : 0,
    sound: Boolean(studio?.audio ?? market?.options.audioToggle),
    references: market?.options.maxImages ?? 0,
    credits: rows[0].credits,
    option: rows[0].option,
    cost: rows[0].cost,
  };
}

/** The live comparisons; a pair drops out if either model stops generating. */
export function compareSlugs(): string[] {
  return PAIRS.filter((pair) => {
    const a = getLandingModel(pair.a);
    const b = getLandingModel(pair.b);
    return Boolean(a && b && side(a) && side(b));
  }).map((pair) => pair.slug);
}

/** Comparisons that include a model, for the links on its own page. */
export function comparisonsFor(modelSlug: string): { slug: string; other: LandingModel }[] {
  const live = new Set(compareSlugs());
  return PAIRS.filter((pair) => live.has(pair.slug) && (pair.a === modelSlug || pair.b === modelSlug)).flatMap((pair) => {
    const other = getLandingModel(pair.a === modelSlug ? pair.b : pair.a);
    return other ? [{ slug: pair.slug, other }] : [];
  });
}

export function comparePage(slug: string, zh: boolean): ComparePage | null {
  const pair = PAIRS.find((item) => item.slug === slug);
  const modelA = pair && getLandingModel(pair.a);
  const modelB = pair && getLandingModel(pair.b);
  const a = modelA ? side(modelA) : null;
  const b = modelB ? side(modelB) : null;
  if (!pair || !a || !b) return null;
  const A = a.model.name;
  const B = b.model.name;
  const gift = NEW_USER_GIFT.enabled ? NEW_USER_GIFT.credits : 0;

  const spec = (s: Side, label: string) => {
    const found = landingSpecs(s.model).find((item) => item.label.en === label);
    return found ? (zh ? found.value.zh : found.value.en) : "—";
  };
  const rows = [
    { key: "Length", zh: "时长" },
    { key: "Resolution", zh: "分辨率" },
    { key: "Aspect ratio", zh: "画面比例" },
    { key: "Sound", zh: "声音" },
    { key: "Input", zh: "输入" },
  ].map((row) => ({ label: zh ? row.zh : row.key, a: spec(a, row.key), b: spec(b, row.key) }));
  rows.push(
    {
      label: zh ? "每条最低积分" : "Credits a clip, from",
      a: zh ? `${a.credits}（${a.option.zh}）` : `${a.credits} (${a.option.en})`,
      b: zh ? `${b.credits}（${b.option.zh}）` : `${b.credits} (${b.option.en})`,
    },
    { label: zh ? "套餐内约合" : "Cost on a plan", a: a.cost, b: b.cost },
  );

  // Advice from the figures that differ, nothing else.
  const strengths = (x: Side, y: Side): string[] => {
    const out: string[] = [];
    if (x.sound && !y.sound) out.push(zh ? `需要声音和画面一起生成（环境声、音效或台词）：${x.model.name} 能同步生成声音，${y.model.name} 生成的是无声视频。` : `You need sound generated with the picture (ambience, effects or dialogue): ${x.model.name} makes it, ${y.model.name} makes silent clips.`);
    if (x.credits < y.credits) out.push(zh ? `更在意每条的成本：最低 ${x.credits} 积分一条，${y.model.name} 是 ${y.credits} 积分。` : `Cost per clip matters most: from ${x.credits} credits, against ${y.credits} for ${y.model.name}.`);
    if (x.maxSeconds > y.maxSeconds) out.push(zh ? `需要更长的单条视频：最长 ${x.maxSeconds} 秒，${y.model.name} 最长 ${y.maxSeconds} 秒。` : `You need longer single clips: up to ${x.maxSeconds} seconds, against ${y.maxSeconds} for ${y.model.name}.`);
    if (x.maxResolution > y.maxResolution) out.push(zh ? `需要更高的分辨率：最高 ${x.maxResolution}p，${y.model.name} 最高 ${y.maxResolution}p。` : `You need a higher resolution: up to ${x.maxResolution}p, against ${y.maxResolution}p for ${y.model.name}.`);
    if (x.references > y.references && x.references > 1) out.push(zh ? `想用多张参考图让人物或商品保持一致：最多 ${x.references} 张。` : `You want several reference images to keep a person or product consistent: up to ${x.references}.`);
    out.push(zh ? `你更喜欢它的画面和动作：同一句提示词在两个模型上各试一条，比参数更能说明问题。` : "You prefer its look and motion: one clip of the same prompt on each says more than any table.");
    return out;
  };

  const sound =
    a.sound && b.sound
      ? zh
        ? "两者都能把声音和画面一起生成。"
        : "Both generate sound with the picture."
      : a.sound || b.sound
        ? zh
          ? `${a.sound ? A : B} 能同步生成声音，${a.sound ? B : A} 生成的是无声视频。`
          : `${a.sound ? A : B} generates sound with the picture; ${a.sound ? B : A} makes silent clips.`
        : zh
          ? "两者生成的都是无声视频。"
          : "Both make silent clips.";
  const length =
    a.maxSeconds === b.maxSeconds
      ? zh
        ? `单条都最长 ${a.maxSeconds} 秒。`
        : `Both go up to ${a.maxSeconds} seconds a clip.`
      : zh
        ? `${A} 单条最长 ${a.maxSeconds} 秒，${B} 最长 ${b.maxSeconds} 秒。`
        : `${A} goes up to ${a.maxSeconds} seconds a clip, ${B} up to ${b.maxSeconds}.`;
  const cheaper = a.credits === b.credits ? null : a.credits < b.credits ? a : b;
  const dearer = cheaper === a ? b : a;

  const answer = zh
    ? `在 aivd.ai，${A} 每条最低 ${a.credits} 积分（约合 ${a.cost}），${B} 每条最低 ${b.credits} 积分（约合 ${b.cost}）。${sound}${length}两个模型共用一个积分余额，可以用同一句提示词各生成一条再比较。`
    : `On aivd.ai, ${A} starts at ${a.credits} credits a clip (about ${a.cost}) and ${B} at ${b.credits} credits (about ${b.cost}). ${sound} ${length} Both draw on one credit balance, so you can run the same prompt on each and compare.`;

  const days = NEW_USER_GIFT.validDays;
  const fitsA = gift >= a.credits;
  const fitsB = gift >= b.credits;
  let freeAnswer: string;
  if (!gift) {
    freeAnswer = zh ? "目前没有免费积分，需要订阅套餐或购买积分包。" : "There are no free credits at the moment; both need a plan or a credit pack.";
  } else if (fitsA && fitsB && gift >= a.credits + b.credits) {
    freeAnswer = zh ? `可以。新注册的账号送 ${gift} 积分（${days} 天内有效），够 ${A} 和 ${B} 各生成一条。` : `Yes. New accounts get ${gift} free credits for ${days} days, enough for one clip on each.`;
  } else if (fitsA && fitsB) {
    freeAnswer = zh
      ? `可以试其中一个。新注册的账号送 ${gift} 积分（${days} 天内有效），够 ${A} 或 ${B} 用最低配置生成一条，但不够两个都试。`
      : `One of them. New accounts get ${gift} free credits for ${days} days: enough for one clip on ${A} or ${B} at the lowest settings, not one of each.`;
  } else if (fitsA || fitsB) {
    const fits = fitsA ? a : b;
    const other = fitsA ? b : a;
    freeAnswer = zh
      ? `新注册的账号送 ${gift} 积分（${days} 天内有效），够 ${fits.model.name} 生成一条（${fits.credits} 积分）；${other.model.name} 最低 ${other.credits} 积分，需要订阅套餐或购买积分包。`
      : `New accounts get ${gift} free credits for ${days} days, enough for one ${fits.model.name} clip (${fits.credits} credits). ${other.model.name} starts at ${other.credits} credits, so it needs a plan or a credit pack.`;
  } else {
    freeAnswer = zh
      ? `新注册的账号送 ${gift} 积分，但 ${A} 和 ${B} 最低都要更多积分，需要订阅套餐或购买积分包。`
      : `New accounts get ${gift} free credits, but ${A} and ${B} both start above that, so they need a plan or a credit pack.`;
  }

  const faqs = zh
    ? [
        {
          q: `${A} 和 ${B} 哪个便宜？`,
          a: cheaper ? `${cheaper.model.name} 更便宜：最低 ${cheaper.credits} 积分一条（约合 ${cheaper.cost}），${dearer.model.name} 最低 ${dearer.credits} 积分（约合 ${dearer.cost}）。实际积分随时长和画质变化，生成按钮上会显示。` : `两者最低都是 ${a.credits} 积分一条（约合 ${a.cost}）。实际积分随时长和画质变化，生成按钮上会显示。`,
        },
        { q: `${A} 和 ${B} 哪个能生成更长的视频？`, a: length },
        { q: `${A} 和 ${B} 能生成声音吗？`, a: sound },
        { q: `可以用免费积分试 ${A} 和 ${B} 吗？`, a: freeAnswer },
        { q: `能在同一个账号里用 ${A} 和 ${B} 吗？`, a: "可以。两个模型都在 aivd.ai 的生成器里，用同一个积分余额；生成前按钮上显示本次积分，生成失败自动退回。" },
      ]
    : [
        {
          q: `Is ${A} or ${B} cheaper?`,
          a: cheaper ? `${cheaper.model.name} is cheaper: from ${cheaper.credits} credits a clip (about ${cheaper.cost}), against ${dearer.credits} credits (about ${dearer.cost}) for ${dearer.model.name}. The exact cost changes with length and quality and shows on the generate button.` : `Both start at ${a.credits} credits a clip (about ${a.cost}). The exact cost changes with length and quality and shows on the generate button.`,
        },
        { q: `Which makes longer videos, ${A} or ${B}?`, a: length },
        { q: `Do ${A} and ${B} generate sound?`, a: sound },
        { q: `Can I try ${A} and ${B} with free credits?`, a: freeAnswer },
        { q: `Can I use ${A} and ${B} from one account?`, a: "Yes. Both are in the aivd.ai generator and use the same credit balance; the button shows the cost before you start, and failed generations are refunded." },
      ];

  return {
    slug,
    a: a.model,
    b: b.model,
    title: zh ? `${A} 和 ${B} 对比：价格、时长和声音` : `${A} vs ${B}: Price, Length and Sound`,
    description: zh
      ? `${A} 还是 ${B}？对比每条价格、时长、分辨率和声音：${A} 最低 ${a.credits} 积分，${B} 最低 ${b.credits} 积分，同一个积分余额都能用。`
      : `${A} or ${B}? Compare price, length, resolution and sound: from ${a.credits} and ${b.credits} credits a clip on aivd.ai, both on one credit balance.`,
    h1: zh ? `${A} 和 ${B} 对比` : `${A} vs ${B}`,
    answer,
    columns: [zh ? "对比项" : "Compare", A, B],
    rows,
    pickTitle: (name) => (zh ? `什么时候选 ${name}` : `When to pick ${name}`),
    pickA: strengths(a, b),
    pickB: strengths(b, a),
    faqs,
  };
}
