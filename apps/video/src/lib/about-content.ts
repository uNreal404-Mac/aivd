/**
 * The /about page: what aivd.ai is, which models it runs, how it charges and
 * where its figures come from, and who to contact. Every number and name is
 * read from the config the generator and the pricing page use; the operator's
 * name appears only once it is configured (NEXT_PUBLIC_COMPANY_NAME).
 */
import { CONTENT_UPDATED } from "@/config/content-dates";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import type { LegalDoc, LegalLocale } from "@/lib/legal-content";
import { LANDING_MODELS } from "@/lib/model-landing";
import { packOffers, planOffers, usd } from "@/lib/pricing-offers";

export type AboutContext = { email?: string; companyName: string };

function list(items: string[], zh: boolean): string {
  if (items.length <= 1) return items.join("");
  return zh ? `${items.slice(0, -1).join("、")}和${items[items.length - 1]}` : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function aboutDoc(locale: LegalLocale, ctx: AboutContext): LegalDoc {
  const zh = locale === "zh";
  const live = (kind: "video" | "image" | "audio") => LANDING_MODELS.filter((model) => model.live && model.kind === kind).map((model) => model.name);
  const video = live("video");
  const image = live("image");
  const audio = live("audio");
  const from = usd(planOffers()[0].monthlyPriceUsd);
  const packFrom = usd(Math.min(...packOffers().map((pack) => pack.priceUsd)));
  const gift = NEW_USER_GIFT.enabled ? NEW_USER_GIFT.credits : 0;
  const operator = ctx.companyName.trim();
  const contact = ctx.email
    ? zh
      ? `有问题、建议或合作，请写信到 ${ctx.email}，我们会用中文或英文回复。`
      : `For questions, feedback or partnerships, email ${ctx.email}. We answer in English or Chinese.`
    : zh
      ? "有问题、建议或合作，请通过联系页找到我们。"
      : "For questions, feedback or partnerships, see the contact page.";

  if (zh) {
    return {
      title: "关于 aivd.ai",
      description: "aivd.ai 是一个多模型 AI 视频生成器：Veo 3.1、Kling 4.0、Seedance 2.5 等模型共用一个积分余额，生成前显示积分，失败自动退回。",
      intro: `aivd.ai 是一个多模型 AI 视频生成器。你可以在一个地方用文字、图片或参考图生成视频，也能生成图片和配音、音乐，所有模型共用一个积分余额。${operator ? `网站由 ${operator} 运营。` : ""}`,
      sections: [
        {
          heading: "为什么做多模型",
          paragraphs: [
            "不同的视频模型各有所长：有的能把声音和画面一起生成，有的擅长保持人物一致，有的更快更便宜。与其在好几个网站分别注册、分别充值，不如在一个地方按需要挑模型，用同一份积分。",
          ],
        },
        {
          heading: "现在能用的模型",
          paragraphs: [
            `视频：${list(video, true)}。`,
            ...(image.length ? [`图片：${list(image, true)}。`] : []),
            ...(audio.length ? [`音频：${list(audio, true)}。`] : []),
            "每个模型都有自己的介绍页，写明它支持的时长、画质和每次要用的积分。",
          ],
        },
        {
          heading: "怎么收费",
          paragraphs: [
            `生成按积分计费，每个模型、每种时长和画质的积分不同，点击生成前按钮上会显示本次要用多少。提交时积分先冻结，生成成功才扣除，失败自动退回。`,
            `订阅套餐每月 ${from} 起；不想订阅，也可以买 ${packFrom} 起的积分包。${gift ? `新注册的账号送 ${gift} 积分，${NEW_USER_GIFT.validDays} 天内有效。` : ""}`,
          ],
        },
        {
          heading: "页面上的数字从哪来",
          paragraphs: [
            `价格、积分、时长和上传大小这些数字，都直接读取生成工具和计费系统用的同一份配置，所以页面上写的和你实际生成时看到的一致。模型或价格有变化时，我们会更新配置和页面上的更新日期；目前的价格和模型信息更新于 ${CONTENT_UPDATED.models}。`,
          ],
        },
        { heading: "联系我们", paragraphs: [contact] },
      ],
    };
  }

  return {
    title: "About aivd.ai",
    description: "aivd.ai is a multi-model AI video generator: Veo 3.1, Kling 4.0, Seedance 2.5 and more on one credit balance, with the cost shown first.",
    intro: `aivd.ai is a multi-model AI video generator. It makes videos from text, images or reference images, plus images, voiceovers and music, in one place, with every model drawing on one credit balance.${operator ? ` The site is operated by ${operator}.` : ""}`,
    sections: [
      {
        heading: "Why several models",
        paragraphs: [
          "Video models are good at different things: some generate sound with the picture, some keep a character consistent, some are faster and cheaper. Rather than sign up and top up on several sites, you pick the model that fits each shot here and pay from the same credits.",
        ],
      },
      {
        heading: "The models you can use today",
        paragraphs: [
          `Video: ${list(video, false)}.`,
          ...(image.length ? [`Image: ${list(image, false)}.`] : []),
          ...(audio.length ? [`Audio: ${list(audio, false)}.`] : []),
          "Each model has its own page with the lengths, qualities and credits it takes.",
        ],
      },
      {
        heading: "How pricing works",
        paragraphs: [
          "Generations are charged in credits, which vary by model, length and quality; the generate button shows the cost before you start. Credits are held when you submit, charged when the result is ready, and returned automatically if the generation fails.",
          `Plans start at ${from} a month, and credit packs from ${packFrom} if you would rather not subscribe.${gift ? ` New accounts get ${gift} free credits for ${NEW_USER_GIFT.validDays} days.` : ""}`,
        ],
      },
      {
        heading: "Where the figures come from",
        paragraphs: [
          `Prices, credits, clip lengths and upload limits on these pages are read from the same configuration the generator and billing use, so what a page says is what you see when you generate. When a model or a price changes, we update it and the date shown on the page; prices and model details were last updated on ${CONTENT_UPDATED.models}.`,
        ],
      },
      { heading: "Contact", paragraphs: [contact] },
    ],
  };
}
