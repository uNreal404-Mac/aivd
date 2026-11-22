/**
 * The help centre (/help): one question per page, answered in the first
 * sentence with the actual figures, so a search engine or an AI answer can
 * quote it. Every number is read from the config the generator, billing and
 * pricing page use; nothing here is typed by hand.
 *
 * Only questions whose answer is implemented and checked in the code are
 * listed. Left out until they are: generation time (no measured data yet),
 * watermark on free credits, what model providers do with what they receive
 * (their own policies, not ours), deleting stored files from the app (a
 * delete only hides the video), the phone flow, and stuck-task timeouts.
 */
import { CONTENT_UPDATED } from "@/config/content-dates";
import { LEGAL_CONFIG } from "@/config/legal";
import { CREDITS_CONFIG, getProductExpiryDays } from "@/config/credits";
import { CREDIT_EXPIRATION, NEW_USER_GIFT, PLAN_PERKS } from "@/config/pricing-user";
import type { LegalLocale, LegalSection } from "@/lib/legal-content";
import { LANDING_MODELS } from "@/lib/model-landing";
import { FREE_VIDEO_UNIT_ID, generationsFor, packOffers, planCostRange, planOffers, pricingUnit, usd } from "@/lib/pricing-offers";
import { PRICING_UNITS } from "@/lib/pricing-units";

export const HELP_SLUGS = [
  "failed-generation-credits",
  "pay-as-you-go-credits",
  "free-credits",
  "credits-per-video",
  "credit-expiry",
  "refund-policy",
  "cancel-subscription",
  "commercial-use",
  "uploads-and-privacy",
  "available-models",
  "concurrent-generations",
] as const;

export type HelpSlug = (typeof HELP_SLUGS)[number];

export type HelpArticle = {
  slug: HelpSlug;
  /** The question, used as the H1 and the title. */
  question: string;
  /** Meta description, under 160 characters. */
  description: string;
  /** The direct answer, with its figures; the page's first paragraph. */
  answer: string;
  sections: LegalSection[];
  related: HelpSlug[];
  /** Pages of the site the answer points to. */
  links: { label: string; path: string }[];
  /** Day the facts were last checked against the config. */
  updated: string;
};

export function isHelpSlug(value: string): value is HelpSlug {
  return (HELP_SLUGS as readonly string[]).includes(value);
}

function n(value: number): string {
  return value.toLocaleString("en-US");
}

function list(items: string[], zh: boolean): string {
  if (items.length <= 1) return items.join("");
  // Chinese runs the names together with "、": "和" next to a Latin name reads badly.
  return zh ? items.join("、") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Days the credits of a yearly plan last, as the fulfilment code sets them. */
function yearlyExpiryDays(): number {
  const yearly = Object.values(CREDITS_CONFIG.subscriptions).find((product) => product.billingPeriod === "year");
  return yearly ? getProductExpiryDays(yearly) : CREDIT_EXPIRATION.purchaseDays;
}

function facts() {
  const plans = planOffers();
  const packs = packOffers();
  const freeUnit = pricingUnit(FREE_VIDEO_UNIT_ID);
  const liveModels = (kind: "video" | "image" | "audio") =>
    LANDING_MODELS.filter((model) => model.live && model.kind === kind).map((model) => model.name);
  return {
    plans,
    packs,
    freeUnit,
    cheapestPack: packs.reduce((a, b) => (b.priceUsd < a.priceUsd ? b : a)),
    bestPack: packs.reduce((a, b) => (b.per100Usd < a.per100Usd ? b : a)),
    gift: NEW_USER_GIFT,
    expiry: { ...CREDIT_EXPIRATION, yearlyDays: yearlyExpiryDays() },
    freeConcurrency: PLAN_PERKS.free.concurrency,
    refundDays: LEGAL_CONFIG.refundWindowDays,
    videoUnits: PRICING_UNITS.filter((unit) => unit.kind === "video" && unit.credits > 0).slice(0, 3),
    models: { video: liveModels("video"), image: liveModels("image"), audio: liveModels("audio") },
  };
}

type Copy = Omit<HelpArticle, "slug" | "related" | "links" | "updated">;

function enCopy(slug: HelpSlug, f: ReturnType<typeof facts>): Copy {
  switch (slug) {
    case "failed-generation-credits":
      return {
        question: "Do I get my credits back if a generation fails?",
        description: "Yes. If an AI video, image or audio generation fails or errors out on aivd.ai, the credits it used go back to your balance automatically.",
        answer: "Yes. If a generation fails or errors out, the credits it used are returned to your balance automatically. You do not need to contact us.",
        sections: [
          {
            heading: "How credits are held and charged",
            paragraphs: [
              "When you press Generate, the credits shown on the button are held, not spent. They are charged only when the video, image or audio is ready. If the provider reports a failure, the hold is released and the credits are back in your balance.",
              "The cost is shown on the Generate button before you start, so you always know what a generation will take.",
            ],
          },
          {
            heading: "What is not refunded automatically",
            paragraphs: [
              "A generation that finishes but does not look the way you wanted is not a failure, and its credits are not returned. Try a shorter prompt, a clearer reference image or a different model.",
              "If credits were taken and you never received a result, contact us and we will look into it.",
            ],
          },
        ],
      };
    case "pay-as-you-go-credits":
      return {
        question: "Can I pay as I go instead of subscribing?",
        description: `Yes. Credit packs on aivd.ai start at ${usd(f.cheapestPack.priceUsd)} with no subscription, anyone can buy them, and purchased credits last ${f.expiry.purchaseDays} days.`,
        answer: `Yes. Anyone can buy a one-time credit pack without a subscription. Packs start at ${usd(f.cheapestPack.priceUsd)} for ${n(f.cheapestPack.credits)} credits, and purchased credits stay valid for ${f.expiry.purchaseDays} days.`,
        sections: [
          {
            heading: "Credit packs",
            paragraphs: ["Every pack works with every model. Bigger packs cost less per credit:"],
            bullets: f.packs.map((pack) => `${usd(pack.priceUsd)}: ${n(pack.credits)} credits (${usd(pack.per100Usd, 2)} per 100 credits)`),
          },
          {
            heading: "When a plan is cheaper",
            paragraphs: [
              `If you generate every month, a plan costs less per credit: plans start at ${usd(f.plans[0].monthlyPriceUsd)} a month for ${n(f.plans[0].creditsPerMonth)} credits. If you only need a few videos, a pack is the simpler choice.`,
            ],
          },
        ],
      };
    case "free-credits":
      return {
        question: "How many videos can I make for free?",
        description: `New aivd.ai accounts get ${f.gift.credits} free credits, valid for ${f.gift.validDays} days, with no card needed: enough for a ${f.freeUnit.name} clip.`,
        answer: `New accounts get ${f.gift.credits} free credits, valid for ${f.gift.validDays} days. That is enough for ${generationsFor(f.gift.credits, f.freeUnit.credits)} ${f.freeUnit.name} clip (${f.freeUnit.spec.en}, ${f.freeUnit.credits} credits). You sign up with Google or an email link, and no card is needed.`,
        sections: [
          {
            heading: "What the free credits cover",
            paragraphs: [
              "Free credits work like any other credits: every model is available, and the cost of each generation is shown on the Generate button before you start. Cheaper models and shorter clips leave credits for more tries.",
            ],
          },
          {
            heading: "After the free credits",
            paragraphs: [
              `You can buy a credit pack from ${usd(f.cheapestPack.priceUsd)} without subscribing, or choose a plan from ${usd(f.plans[0].monthlyPriceUsd)} a month.`,
            ],
          },
        ],
      };
    case "credits-per-video":
      return {
        question: "How many credits does one AI video cost?",
        description: "Each video model on aivd.ai has its own credit price per length and quality, shown on the Generate button before you start. Typical clips and costs inside.",
        answer: `It depends on the model, length and quality, and the exact cost is shown on the Generate button before you start. For example, ${list(f.videoUnits.map((unit) => `${unit.name} (${unit.spec.en}) is ${unit.credits} credits`), false)}.`,
        sections: [
          {
            heading: "What a clip costs in dollars",
            paragraphs: ["One credit costs less on bigger plans, so the dollar cost of the same clip depends on how you bought your credits:"],
            bullets: f.videoUnits.map((unit) => `${unit.name}, ${unit.spec.en}: ${unit.credits} credits, about ${planCostRange(unit.credits)} on a plan`),
          },
          {
            heading: "Where to see every price",
            paragraphs: ["Each model page lists every length and quality with its credits, and the pricing page has the full table."],
          },
        ],
      };
    case "credit-expiry":
      return {
        question: "Do credits expire?",
        description: `Yes. On aivd.ai, purchased credit packs last ${f.expiry.purchaseDays} days, monthly plan credits ${f.expiry.subscriptionDays} days and free sign-up credits ${f.gift.validDays} days.`,
        answer: `Yes. Credits from a credit pack last ${f.expiry.purchaseDays} days, credits from a monthly plan last ${f.expiry.subscriptionDays} days, credits from a yearly plan last ${f.expiry.yearlyDays} days, and the free sign-up credits last ${f.gift.validDays} days.`,
        sections: [
          {
            heading: "Which credits are used first",
            paragraphs: ["When you generate, the credits closest to expiring are used first, so newer credits are kept for later."],
          },
        ],
      };
    case "refund-policy":
      return {
        question: "Can I get a refund?",
        description: `On aivd.ai, a first purchase whose credits are all unused can be refunded within ${f.refundDays} days. Failed generations refund their credits automatically.`,
        answer: `Yes, for your first purchase: if none of its credits have been used, you can ask for a full refund within ${f.refundDays} days of paying. Credits from failed generations are returned automatically at any time.`,
        sections: [
          {
            heading: "How to ask",
            paragraphs: [
              "Email us from the address on your account and say which purchase it is. Any bonus credits that came with the purchase are removed with the refund.",
              "The refund policy page has the full rules for later purchases and subscriptions.",
            ],
          },
        ],
      };
    case "cancel-subscription":
      return {
        question: "How do I cancel my subscription?",
        description: "Cancel an aivd.ai plan any time from your Account page. The plan runs to the end of the period you paid for and is not charged again.",
        answer: "Open your Account page, choose Cancel subscription under Current plan and confirm. Your plan stays active until the end of the period you already paid for, and you are not charged again.",
        sections: [
          {
            heading: "Step by step",
            paragraphs: [],
            bullets: [
              "Sign in and open Account from the menu.",
              "Under Current plan, choose Cancel subscription.",
              "Check the date your plan runs until, then choose Yes, cancel. The plan card then shows the end date and that the plan will not renew.",
            ],
          },
          {
            heading: "Changed your mind?",
            paragraphs: ["Until that date, Resume subscription on the same card turns renewal back on. Nothing is charged until the next renewal date."],
          },
          {
            heading: "What happens to your credits",
            paragraphs: [
              `Credits you already received stay in your balance until they expire: ${f.expiry.subscriptionDays} days for a monthly plan, ${f.expiry.yearlyDays} days for a yearly plan. No new credits are added after the plan ends.`,
              "Cancelling does not refund the current period by itself. The refund policy explains when a payment can be refunded.",
            ],
          },
        ],
      };
    case "commercial-use":
      return {
        question: "Can I use the videos commercially?",
        description: "Yes, free credits included: what you generate on aivd.ai can be used commercially. You own it, subject to the model providers' terms and the law.",
        answer: "Yes. Everything you generate on aivd.ai can be used commercially, whether you made it with a plan, a credit pack or the free sign-up credits, and paid plans export without a watermark. You own the content you generate, subject to the terms of the model providers that power the generation and to applicable law.",
        sections: [
          {
            heading: "What stays your responsibility",
            paragraphs: [
              "You need the rights to anything you upload, such as photos of people, logos or footage. Check the generated result before you publish it, and follow the rules of the platform you publish on, for example disclosure rules for AI-generated or altered content.",
            ],
          },
        ],
      };
    case "uploads-and-privacy":
      return {
        question: "Do you use my uploads to train AI models?",
        description: "No. aivd.ai uses your prompts, uploads and videos only to provide the service to you. They are kept in private storage and are not publicly listed.",
        answer: "No. aivd.ai does not train AI models on your prompts, uploaded images or generated videos: under our terms we use your content only to host, process and show it to you while providing the service, and for nothing else without your permission.",
        sections: [
          {
            heading: "Where your files are kept",
            paragraphs: [
              "Your uploads and generated videos are kept in private object storage. They are not publicly listed, and they can be opened only through short-lived signed links created for you when you view or download them.",
            ],
          },
          {
            heading: "Who receives them",
            paragraphs: [
              "To run a generation, your prompt and any images you add are sent to the AI model provider that makes the video, image or audio. How that provider handles them is governed by its own policy. Payments go through Stripe, and hosting providers run and store the service. We do not sell your personal information.",
            ],
          },
          {
            heading: "Removing your content",
            paragraphs: [
              "Deleting a video in My creations removes it from your account. To have your stored files and account data erased, contact us; some information may be kept where the law requires it.",
            ],
          },
        ],
      };
    case "available-models":
      return {
        question: "Which AI models can I use?",
        description: `aivd.ai runs ${f.models.video.slice(0, 3).join(", ")} and other AI video models, plus image and audio models, on one credit balance.`,
        answer: `Video: ${list(f.models.video, false)}.${f.models.image.length ? ` Image: ${list(f.models.image, false)}.` : ""}${f.models.audio.length ? ` Audio: ${list(f.models.audio, false)}.` : ""} All of them use the same credit balance.`,
        sections: [
          {
            heading: "Choosing a model",
            paragraphs: [
              "Each model has its own page with the lengths, qualities and credits it takes. You can switch models in the generator at any time, and every plan and credit pack works with every model.",
            ],
          },
        ],
      };
    case "concurrent-generations":
      return {
        question: "How many videos can I generate at the same time?",
        description: `On aivd.ai, free accounts run ${videos(f.freeConcurrency)} at a time; ${f.plans.map((plan) => `${cap(plan.tier)} runs ${plan.concurrency}`).join(", ")}. Images and audio do not count.`,
        answer: `Free accounts run ${videos(f.freeConcurrency)} at a time. On the plans: ${f.plans.map((plan) => `${cap(plan.tier)} runs ${videos(plan.concurrency)}`).join(", ")} at once. Images and audio do not count towards the limit.`,
        sections: [
          {
            heading: "When you reach the limit",
            paragraphs: ["Starting another video shows a message instead of charging you. Wait for one to finish, or move to a bigger plan to run more at once."],
          },
        ],
      };
  }
}

function zhCopy(slug: HelpSlug, f: ReturnType<typeof facts>): Copy {
  switch (slug) {
    case "failed-generation-credits":
      return {
        question: "生成失败会退积分吗？",
        description: "会。在 aivd.ai 生成视频、图片或音频失败或报错时，这次用掉的积分会自动退回账户，不需要联系客服。",
        answer: "会。生成失败或报错时，这次用掉的积分会自动退回你的账户，不需要联系我们。",
        sections: [
          {
            heading: "积分是怎么冻结和扣除的",
            paragraphs: [
              "点击生成时，按钮上显示的积分先被冻结，不会马上扣掉；视频、图片或音频生成完成后才正式扣除。如果模型服务返回失败，冻结会解除，积分回到余额。",
              "每次生成要用多少积分，点击之前就显示在生成按钮上。",
            ],
          },
          {
            heading: "哪些情况不会自动退",
            paragraphs: [
              "生成成功但效果不满意，不算失败，积分不会退回。可以换一个更简短的提示词、更清晰的参考图，或者换个模型再试。",
              "如果积分被扣了却没有拿到结果，请联系我们，我们会核查处理。",
            ],
          },
        ],
      };
    case "pay-as-you-go-credits":
      return {
        question: "不订阅，可以按次付费吗？",
        description: `可以。aivd.ai 的积分包 ${usd(f.cheapestPack.priceUsd)} 起，不用订阅，所有人都能买，购买的积分 ${f.expiry.purchaseDays} 天内有效。`,
        answer: `可以。所有人都能单独购买一次性积分包，不需要订阅。积分包 ${usd(f.cheapestPack.priceUsd)} 起（${n(f.cheapestPack.credits)} 积分），购买的积分 ${f.expiry.purchaseDays} 天内有效。`,
        sections: [
          {
            heading: "积分包",
            paragraphs: ["每个积分包都能用于所有模型，买得越多，每积分越便宜："],
            bullets: f.packs.map((pack) => `${usd(pack.priceUsd)}：${n(pack.credits)} 积分（每 100 积分 ${usd(pack.per100Usd, 2)}）`),
          },
          {
            heading: "什么时候订阅更划算",
            paragraphs: [
              `如果每个月都要生成，订阅的每积分价格更低：套餐每月 ${usd(f.plans[0].monthlyPriceUsd)} 起，含 ${n(f.plans[0].creditsPerMonth)} 积分。只做几条视频的话，买积分包更简单。`,
            ],
          },
        ],
      };
    case "free-credits":
      return {
        question: "免费能生成几条视频？",
        description: `aivd.ai 新注册账号送 ${f.gift.credits} 积分，${f.gift.validDays} 天内有效，不需要绑卡，够生成一条 ${f.freeUnit.name} 视频。`,
        answer: `新注册的账号送 ${f.gift.credits} 积分，${f.gift.validDays} 天内有效，够生成 ${generationsFor(f.gift.credits, f.freeUnit.credits)} 条 ${f.freeUnit.name} 视频（${f.freeUnit.spec.zh}，${f.freeUnit.credits} 积分）。用 Google 账号或邮箱链接注册，不需要绑卡。`,
        sections: [
          {
            heading: "免费积分能用来做什么",
            paragraphs: [
              "免费积分和其他积分一样，所有模型都能用，每次生成要用多少积分，点击之前就显示在按钮上。选便宜的模型、短一点的时长，就能多试几次。",
            ],
          },
          {
            heading: "免费积分用完以后",
            paragraphs: [`可以不订阅，直接买 ${usd(f.cheapestPack.priceUsd)} 起的积分包；也可以选每月 ${usd(f.plans[0].monthlyPriceUsd)} 起的套餐。`],
          },
        ],
      };
    case "credits-per-video":
      return {
        question: "生成一条 AI 视频要多少积分？",
        description: "aivd.ai 的每个视频模型按时长和画质计价，生成前按钮上就会显示要用的积分。这里列出常见视频的积分和价格。",
        answer: `取决于模型、时长和画质，具体积分在点击生成前就显示在按钮上。例如${f.videoUnits.map((unit) => `${unit.name}（${unit.spec.zh}）${unit.credits} 积分`).join("，")}。`,
        sections: [
          {
            heading: "折合多少钱",
            paragraphs: ["套餐越大，每积分越便宜，所以同一条视频折合的价格取决于你的积分是怎么买的："],
            bullets: f.videoUnits.map((unit) => `${unit.name}，${unit.spec.zh}：${unit.credits} 积分，用套餐约 ${planCostRange(unit.credits)}`),
          },
          {
            heading: "在哪看全部价格",
            paragraphs: ["每个模型的介绍页列出了所有时长和画质对应的积分，定价页有完整的价格表。"],
          },
        ],
      };
    case "credit-expiry":
      return {
        question: "积分会过期吗？",
        description: `会。aivd.ai 积分包的积分 ${f.expiry.purchaseDays} 天有效，月付套餐积分 ${f.expiry.subscriptionDays} 天，注册赠送的积分 ${f.gift.validDays} 天。`,
        answer: `会。积分包的积分 ${f.expiry.purchaseDays} 天内有效，月付套餐的积分 ${f.expiry.subscriptionDays} 天内有效，年付套餐的积分 ${f.expiry.yearlyDays} 天内有效，注册赠送的积分 ${f.gift.validDays} 天内有效。`,
        sections: [
          {
            heading: "先用哪部分积分",
            paragraphs: ["生成时会先用最快过期的积分，新到账的积分留到后面用。"],
          },
        ],
      };
    case "refund-policy":
      return {
        question: "可以退款吗？",
        description: `aivd.ai 的第一笔购买如果积分完全没用，可以在 ${f.refundDays} 天内申请全额退款；生成失败的积分会自动退回。`,
        answer: `第一笔购买可以：如果这笔购买得到的积分一点都没用，可以在付款后 ${f.refundDays} 天内申请全额退款。生成失败的积分则随时自动退回。`,
        sections: [
          {
            heading: "怎么申请",
            paragraphs: [
              "用注册账号的邮箱写信给我们，说明是哪一笔购买。随这笔购买赠送的优惠积分会一并收回。",
              "之后的购买和订阅怎么处理，退款政策页有完整说明。",
            ],
          },
        ],
      };
    case "cancel-subscription":
      return {
        question: "怎么取消订阅？",
        description: "aivd.ai 套餐可以随时在账户页取消。已付费的这一期照常可用，到期后不再扣款。",
        answer: "打开账户页，在“当前套餐”下点“取消订阅”并确认即可。已经付费的这一期照常可用，到期后不会再扣款。",
        sections: [
          {
            heading: "操作步骤",
            paragraphs: [],
            bullets: [
              "登录后从菜单打开“账户”。",
              "在“当前套餐”下点“取消订阅”。",
              "看一下套餐能用到哪天，再点“确认取消”。之后套餐卡片会显示到期日期和“到期后不再续费”。",
            ],
          },
          {
            heading: "改主意了？",
            paragraphs: ["到期之前，在同一张卡片上点“恢复订阅”就会恢复自动续费，下一个续费日之前不会扣款。"],
          },
          {
            heading: "积分怎么办",
            paragraphs: [
              `已经发放的积分会留在余额里，到期为止：月付套餐的积分 ${f.expiry.subscriptionDays} 天，年付套餐的积分 ${f.expiry.yearlyDays} 天。套餐结束后不再发放新积分。`,
              "取消本身不会退还当期费用。哪些付款可以退款，见退款政策。",
            ],
          },
        ],
      };
    case "commercial-use":
      return {
        question: "生成的视频可以商用吗？",
        description: "可以。无论用套餐、积分包还是注册送的免费积分生成，内容都可以商用。生成的内容归你所有，但要遵守模型提供方的条款和法律。",
        answer: "可以。在 aivd.ai 生成的内容都可以商用，不论是用套餐、积分包还是注册送的免费积分生成的；付费套餐导出没有水印。你生成的内容归你所有，但要遵守提供生成能力的模型方的条款和适用法律。",
        sections: [
          {
            heading: "你需要自己负责的部分",
            paragraphs: [
              "你上传的素材（人物照片、商标、视频片段等）要有相应的权利。发布前请检查生成结果，并遵守发布平台的规则，比如对 AI 生成或修改内容的标注要求。",
            ],
          },
        ],
      };
    case "uploads-and-privacy":
      return {
        question: "会用我上传的素材训练 AI 吗？",
        description: "不会。aivd.ai 只把你的提示词、上传素材和生成的视频用于为你提供服务，文件存放在私有存储中，不会公开列出。",
        answer: "不会。aivd.ai 不会用你的提示词、上传的图片或生成的视频训练 AI 模型：按照我们的条款，你的内容只用于在提供服务时托管、处理和展示给你，未经你同意不会用于其他用途。",
        sections: [
          {
            heading: "文件存在哪里",
            paragraphs: ["你上传的素材和生成的视频保存在私有对象存储中，不会公开列出，只有在你查看或下载时生成的短时效签名链接才能打开。"],
          },
          {
            heading: "谁会收到这些内容",
            paragraphs: [
              "为了完成生成，你的提示词和添加的图片会发送给负责生成视频、图片或音频的 AI 模型服务商，服务商如何处理以其自身政策为准。付款由 Stripe 处理，托管服务商负责运行和存储服务。我们不会出售你的个人信息。",
            ],
          },
          {
            heading: "怎么删除",
            paragraphs: ["在“我的作品”里删除视频后，它会从你的账号中移除。如果需要彻底删除存储的文件和账号数据，请联系我们；法律要求保留的部分信息可能会被保留。"],
          },
        ],
      };
    case "available-models":
      return {
        question: "可以用哪些 AI 模型？",
        description: `aivd.ai 可以用 ${f.models.video.slice(0, 3).join("、")} 等 AI 视频模型，还有图片和音频模型，共用一个积分余额。`,
        answer: `视频：${list(f.models.video, true)}。${f.models.image.length ? `图片：${list(f.models.image, true)}。` : ""}${f.models.audio.length ? `音频：${list(f.models.audio, true)}。` : ""}所有模型共用一个积分余额。`,
        sections: [
          {
            heading: "怎么选模型",
            paragraphs: ["每个模型都有自己的介绍页，写明支持的时长、画质和每次要用的积分。生成器里可以随时切换模型，所有套餐和积分包都能用于所有模型。"],
          },
        ],
      };
    case "concurrent-generations":
      return {
        question: "可以同时生成几条视频？",
        description: `aivd.ai 免费账号一次可以同时生成 ${f.freeConcurrency} 条视频，${f.plans.map((plan) => `${cap(plan.tier)} ${plan.concurrency} 条`).join("，")}，图片和音频不计入。`,
        answer: `免费账号一次可以同时生成 ${f.freeConcurrency} 条视频；套餐里 ${f.plans.map((plan) => `${cap(plan.tier)} ${plan.concurrency} 条`).join("，")}。图片和音频不计入这个限制。`,
        sections: [
          {
            heading: "到上限以后",
            paragraphs: ["再提交一条视频会提示已达上限，不会扣积分。等其中一条完成，或者换更大的套餐，就能同时跑更多。"],
          },
        ],
      };
  }
}

function videos(count: number): string {
  return `${count} video${count === 1 ? "" : "s"}`;
}

function cap(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const RELATED: Record<HelpSlug, HelpSlug[]> = {
  "failed-generation-credits": ["credits-per-video", "refund-policy", "credit-expiry"],
  "pay-as-you-go-credits": ["credit-expiry", "credits-per-video", "free-credits"],
  "free-credits": ["pay-as-you-go-credits", "credits-per-video", "available-models"],
  "credits-per-video": ["pay-as-you-go-credits", "failed-generation-credits", "available-models"],
  "credit-expiry": ["pay-as-you-go-credits", "refund-policy", "free-credits"],
  "refund-policy": ["cancel-subscription", "failed-generation-credits", "credit-expiry"],
  "cancel-subscription": ["refund-policy", "credit-expiry", "pay-as-you-go-credits"],
  "commercial-use": ["uploads-and-privacy", "available-models", "pay-as-you-go-credits"],
  "uploads-and-privacy": ["commercial-use", "cancel-subscription", "refund-policy"],
  "available-models": ["credits-per-video", "concurrent-generations", "free-credits"],
  "concurrent-generations": ["available-models", "pay-as-you-go-credits", "credits-per-video"],
};

const PAGES = {
  pricing: { path: "/pricing", en: "Pricing", zh: "定价" },
  refund: { path: "/refund-policy", en: "Refund policy", zh: "退款政策" },
  terms: { path: "/terms", en: "Terms of service", zh: "服务条款" },
  privacy: { path: "/privacy", en: "Privacy policy", zh: "隐私政策" },
  contact: { path: "/contact", en: "Contact", zh: "联系我们" },
  account: { path: "/account", en: "Account", zh: "账户" },
  generator: { path: "/text-to-video", en: "Text to video generator", zh: "文字生成视频" },
} as const;

const LINKS: Record<HelpSlug, (keyof typeof PAGES)[]> = {
  "failed-generation-credits": ["generator", "contact"],
  "pay-as-you-go-credits": ["pricing"],
  "free-credits": ["generator", "pricing"],
  "credits-per-video": ["pricing", "generator"],
  "credit-expiry": ["pricing", "terms"],
  "refund-policy": ["refund", "contact"],
  "cancel-subscription": ["account", "refund"],
  "commercial-use": ["terms", "pricing"],
  "uploads-and-privacy": ["privacy", "terms", "contact"],
  "available-models": ["generator", "pricing"],
  "concurrent-generations": ["pricing"],
};

export function helpArticle(slug: HelpSlug, locale: LegalLocale): HelpArticle {
  const f = facts();
  const copy = locale === "zh" ? zhCopy(slug, f) : enCopy(slug, f);
  const links = LINKS[slug].map((key) => ({ label: PAGES[key][locale], path: PAGES[key].path }));
  return { slug, ...copy, related: RELATED[slug], links, updated: CONTENT_UPDATED.pricing };
}

export function helpArticles(locale: LegalLocale): HelpArticle[] {
  return HELP_SLUGS.map((slug) => helpArticle(slug, locale));
}
