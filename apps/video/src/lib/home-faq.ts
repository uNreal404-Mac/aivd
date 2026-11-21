import { LEGAL_CONFIG } from "@/config/legal";
import { CREDIT_PACKAGES, NEW_USER_GIFT, SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";
import { PRICING_UNITS, cheapestUnit, type PricingKind, type PricingUnit } from "@/lib/pricing-units";

export type HomeFaq = { q: string; a: string };

/** "A, B and C" / "A、B和C". */
function list(names: string[], zh: boolean): string {
  if (names.length <= 1) return names.join("");
  const head = names.slice(0, -1).join(zh ? "、" : ", ");
  return `${head}${zh ? "和" : " and "}${names[names.length - 1]}`;
}

const namesOf = (kind: PricingKind) => PRICING_UNITS.filter((unit) => unit.kind === kind).map((unit) => unit.name);
const priced = (unit: PricingUnit, zh: boolean) => (zh ? `${unit.name}（${unit.spec.zh}）` : `${unit.name} (${unit.spec.en})`);

/**
 * The questions under the homepage, in the words people search with (cost,
 * free, commercial use, which model). Every number is read from the pricing
 * and legal config, so an answer cannot disagree with the pricing page.
 */
export function homeFaqs(zh: boolean): HomeFaq[] {
  const cheapVideo = cheapestUnit("video");
  const cheapImage = cheapestUnit("image");
  const veo = PRICING_UNITS.find((unit) => unit.id === "veo-3.1");
  const dearVideo = PRICING_UNITS.filter((unit) => unit.kind === "video").sort((a, b) => b.credits - a.credits)[0];
  const gift = NEW_USER_GIFT.enabled ? NEW_USER_GIFT.credits : 0;
  const freeImages = cheapImage ? Math.floor(gift / cheapImage.credits) : 0;
  const plan = SUBSCRIPTION_PRODUCTS.filter((item) => item.enabled !== false && item.period === "month").sort((a, b) => a.priceUsd - b.priceUsd)[0];
  const pack = CREDIT_PACKAGES.filter((item) => item.enabled !== false).sort((a, b) => a.priceUsd - b.priceUsd)[0];
  const days = LEGAL_CONFIG.refundWindowDays;
  const num = (value: number) => value.toLocaleString("en-US");

  // What the free credits cover, said only as far as the numbers allow.
  const freeAnswer = (() => {
    if (!gift) {
      return zh
        ? `目前没有免费额度。${plan ? `套餐每月 US$${plan.priceUsd} 起，含 ${num(plan.credits)} 积分。` : ""}`
        : `There are no free credits at the moment.${plan ? ` Plans start at US$${plan.priceUsd} a month for ${num(plan.credits)} credits.` : ""}`;
    }
    // Every video model one clip of which the gift pays for, in the pricing
    // table's order (the generator's default model comes first).
    const covers = PRICING_UNITS.filter((unit) => unit.kind === "video" && unit.credits > 0 && unit.credits <= gift).map((unit) => {
      const count = Math.floor(gift / unit.credits);
      return zh
        ? `${count} 条 ${unit.name} 视频（${unit.spec.zh}，每条 ${unit.credits} 积分）`
        : `${count === 1 ? "one" : count} ${unit.name} video${count === 1 ? "" : "s"} (${unit.spec.en}, ${unit.credits} credits${count === 1 ? "" : " each"})`;
    });
    if (cheapImage && freeImages > 0) {
      covers.push(zh ? `约 ${freeImages} 张 ${cheapImage.name} 图片` : `about ${freeImages} ${cheapImage.name} images`);
    }
    const either = (items: string[]) =>
      items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(zh ? "、" : ", ")}${zh ? "或" : " or "}${items[items.length - 1]}`;
    const dearer = PRICING_UNITS.some((unit) => unit.kind === "video" && unit.credits > gift);
    const rest = !dearer
      ? ""
      : zh
        ? `单条超过 ${gift} 积分的视频模型，需要订阅套餐或购买积分包。`
        : ` Video models that cost more than ${gift} credits a clip need a plan or a credit pack.`;
    return zh
      ? `新注册的账号送 ${gift} 积分，${NEW_USER_GIFT.validDays} 天内有效。${covers.length ? `够生成 ${either(covers)}。` : ""}${rest}`
      : `New accounts get ${gift} free credits, valid for ${NEW_USER_GIFT.validDays} days.${covers.length ? ` That covers ${either(covers)}.` : ""}${rest}`;
  })();

  const examples = [cheapVideo, veo, dearVideo].filter((unit, index, all): unit is PricingUnit => Boolean(unit) && all.findIndex((other) => other?.id === unit?.id) === index);
  const costAnswer = zh
    ? `看模型和时长。${examples.map((unit) => `${priced(unit, true)}每条 ${unit.credits} 积分`).join("，")}。${plan ? `套餐每月 US$${plan.priceUsd} 起，含 ${num(plan.credits)} 积分；` : ""}${pack ? `积分包 US$${pack.priceUsd} 起，含 ${num(pack.credits)} 积分。` : ""}每次生成前都会先显示要花多少积分。`
    : `It depends on the model and the length. ${examples.map((unit) => `${priced(unit, false)} costs ${unit.credits} credits a clip`).join(", ")}. ${plan ? `Plans start at US$${plan.priceUsd} a month for ${num(plan.credits)} credits` : ""}${plan && pack ? ", and " : ""}${pack ? `credit packs ${plan ? "" : "start "}at US$${pack.priceUsd} for ${num(pack.credits)}` : ""}. The cost of each generation is shown before you start.`;

  return zh
    ? [
        {
          q: "什么是 AI 视频生成器？",
          a: "AI 视频生成器能把一段文字描述或一张图片变成一段视频。在 aivd.ai，你写下想要的画面，选 Veo 3.1、Seedance 2.5、Kling 4.0 等模型，就能得到一条可以下载的视频。",
        },
        { q: "AI 视频生成器是免费的吗？", a: freeAnswer },
        { q: "生成一条 AI 视频要多少钱？", a: costAnswer },
        {
          q: "可以用哪些 AI 视频模型？",
          a: `视频模型有 ${list(namesOf("video"), true)}；图片模型有 ${list(namesOf("image"), true)}；配音和音乐有 ${list(namesOf("audio"), true)}。所有套餐都能用全部模型。`,
        },
        {
          q: "可以把图片变成视频吗？",
          a: "可以。在生成器里添加一张起始图片，再描述它该怎么动。想让同一个角色在不同视频里保持一致，可以用 Kling 4.0 的参考图功能。",
        },
        {
          q: "生成的视频有声音吗？",
          a: "Veo 3.1 和 Seedance 2.5 可以把声音和画面一起生成，开始前在生成器里打开声音即可。不支持音频的模型生成的是无声视频。",
        },
        { q: "生成的视频可以商用吗？", a: "付费套餐可以：成片没有水印，可以用在商业项目里。" },
        {
          q: "生成一条视频要多久？",
          a: "取决于模型和视频时长。生成在后台进行，你可以离开页面，完成的视频会保存在“我的作品”里。",
        },
        { q: "生成失败了怎么办？", a: "失败的那次所用的积分会自动退回到你的账号。" },
        {
          q: "可以退款吗？",
          a: `积分包在一个积分都没用过的情况下，可以在购买后 ${days} 天内申请退款。订阅可以随时取消，取消后仍可用到当前计费周期结束。已经用掉的积分不能退。`,
        },
      ]
    : [
        {
          q: "What is an AI video generator?",
          a: "An AI video generator turns a written prompt or a photo into a video clip. On aivd.ai you describe a scene, pick a model such as Veo 3.1, Seedance 2.5 or Kling 4.0, and get a clip you can download.",
        },
        { q: "Is the AI video generator free?", a: freeAnswer },
        { q: "How much does an AI video cost?", a: costAnswer },
        {
          q: "Which AI video models can I use?",
          a: `For video: ${list(namesOf("video"), false)}. For images: ${list(namesOf("image"), false)}. For voice and music: ${list(namesOf("audio"), false)}. Every plan can use every model.`,
        },
        {
          q: "Can I turn a photo into a video?",
          a: "Yes. Add a start image in the generator and describe how it should move. To keep one character the same from clip to clip, use reference images with Kling 4.0.",
        },
        {
          q: "Do the videos have sound?",
          a: "Veo 3.1 and Seedance 2.5 can generate sound together with the picture. Turn sound on in the generator before you start. Models without audio make silent clips.",
        },
        { q: "Can I use the videos commercially?", a: "Yes on paid plans: videos come without a watermark and can be used in commercial work." },
        {
          q: "How long does it take to generate a video?",
          a: "That depends on the model and the length of the clip. Generation runs in the background, so you can leave the page; the finished video is saved in My creations.",
        },
        { q: "What happens if a generation fails?", a: "The credits it used go back to your account automatically." },
        {
          q: "Can I get a refund?",
          a: `A credit pack with no credits used can be refunded within ${days} days of purchase. A subscription can be cancelled at any time and stays active until the end of the billing period. Credits that have been used are not refundable.`,
        },
      ];
}
