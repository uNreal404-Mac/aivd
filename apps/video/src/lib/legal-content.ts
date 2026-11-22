/**
 * Legal document content for /terms, /privacy, /refund-policy and /contact.
 *
 * The copy is ours (plain English + Simplified Chinese). Anything that belongs
 * to the operator (company name, address, governing law, support email, refund
 * window) is injected through the `ctx` argument so nothing is invented here.
 */

export type LegalLocale = "en" | "zh";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type LegalDoc = {
  title: string;
  description: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalKind = "terms" | "privacy" | "refund" | "contact";

export type LegalContext = {
  email?: string;
  companyName: string;
  companyAddress: string;
  governingLaw: string;
  refundWindowDays: number;
};

const FALLBACK_COMPANY_NAME = "aivd.ai";

/** Neutral fallbacks — used only when the operator has not configured a value. */
function resolveCompanyName(companyName: string): string {
  const value = companyName.trim();
  return value.length > 0 ? value : FALLBACK_COMPANY_NAME;
}

function resolveCompanyAddress(companyAddress: string): string {
  return companyAddress.trim();
}

function resolveGoverningLaw(governingLaw: string, locale: LegalLocale): string {
  const value = governingLaw.trim();
  if (value.length > 0) return value;
  return locale === "zh"
    ? "运营方所在地适用的法律"
    : "the laws applicable where the operator is established";
}

function supportParagraph(
  email: string | undefined,
  build: (email: string) => string,
): string[] {
  const normalized = email?.trim();
  return normalized ? [build(normalized)] : [];
}

const ZH_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二", "十三", "十四", "十五"];
const HEADING_NUMBER = /^(?:[一二三四五六七八九十]+、|\d+\.\s+)/;

/** Drops sections left empty (say, by a missing support address) and renumbers the rest. */
function omitEmptySections(doc: LegalDoc): LegalDoc {
  const kept = doc.sections.filter(
    (section) => section.paragraphs.length > 0 || (section.bullets?.length ?? 0) > 0,
  );
  return {
    ...doc,
    sections: kept.map((section, index) => {
      const prefix = section.heading.match(HEADING_NUMBER)?.[0];
      if (!prefix) return section;
      const number = prefix.endsWith("、") ? `${ZH_NUMERALS[index] ?? index + 1}、` : `${index + 1}. `;
      return { ...section, heading: number + section.heading.slice(prefix.length) };
    }),
  };
}

function termsDoc(locale: LegalLocale, ctx: LegalContext): LegalDoc {
  const company = resolveCompanyName(ctx.companyName);
  const law = resolveGoverningLaw(ctx.governingLaw, locale);

  if (locale === "zh") {
    return {
      title: "服务条款",
      description:
        "使用 aivd.ai 生成 AI 视频的规则，包括积分、计费、内容归属与可接受使用范围。",
      intro: `本条款说明 ${company} 的运作方式，以及你在使用本服务时享有的权利和需要承担的义务。`,
      sections: [
        {
          heading: "一、服务说明",
          paragraphs: [
            `${company} 是一个 AI 视频生成平台。你可以使用文字提示词和图片，通过第三方 AI 模型生成视频。`,
            "我们可能会随时新增、调整或下线某些功能、模型或使用限制。",
          ],
        },
        {
          heading: "二、账号",
          paragraphs: [
            "使用本服务需要注册账号。请确保账号信息准确，并妥善保管登录凭据。",
            "你需要对自己账号下发生的所有活动负责，并且必须在所在地区具备签订有约束力协议的法定能力。",
          ],
        },
        {
          heading: "三、积分与计费",
          paragraphs: [
            "本服务采用积分制。每次生成都会消耗积分，不同功能和模型消耗的积分数量不同。",
            "积分来自一次性积分包或订阅套餐，付款前结算页面会以美元（USD）显示价格。",
            "如果生成失败或出错，该次生成消耗的积分会自动退还到你的账号。",
            "你可以随时取消订阅。取消在当前计费周期结束时生效，此后不再扣费。",
          ],
        },
        {
          heading: "四、你生成的内容",
          paragraphs: [
            "你拥有所生成内容的所有权，但需遵守生成所用模型提供方的条款以及适用法律。",
            "你仅授予我们为托管、处理和展示你的内容所必需的有限许可，以便向你提供本服务。未经你同意，我们不会将你的内容用于其他用途。",
            "商业使用：你在本服务生成的内容都可以用于商业用途，包括用注册赠送的免费积分生成的内容；付费套餐导出没有水印。商用时你仍需对上传的素材拥有相应权利（例如人物照片、商标、视频片段），在发布前检查生成结果，并遵守发布平台的规则，例如对 AI 生成或修改内容的标注要求。",
          ],
        },
        {
          heading: "五、禁止内容",
          paragraphs: ["你不得使用本服务创建、上传或分享以下内容："],
          bullets: [
            "违法内容，或侵犯他人权利的内容；",
            "涉及未成年人的色情内容；",
            "未经同意的私密影像；",
            "骚扰、威胁或仇恨内容；",
            "未经同意冒充他人，或制作真实人物的深度伪造内容；",
            "侵犯知识产权的内容；",
            "恶意软件、网络钓鱼或垃圾信息；",
            "关于选举或医疗的虚假信息。",
          ],
        },
        {
          heading: "六、内容管理与账号处理",
          paragraphs: [
            "对于违反本条款、或给本服务及他人带来风险的内容，我们可能会删除内容、限制功能，或暂停、终止账号。",
          ],
        },
        {
          heading: "七、免责声明与责任限制",
          paragraphs: [
            "本服务按“现状”和“现有可用”状态提供。AI 生成结果可能不准确、不完整或不符合预期，你在使用或发布之前应自行审核。",
            "在法律允许的最大范围内，我们不对间接、附带或后果性损失承担责任，我们的总责任上限为你在此事件发生前十二个月内向我们支付的金额。",
          ],
        },
        {
          heading: "八、适用法律",
          paragraphs: [`本条款受 ${law} 管辖。`],
        },
        {
          heading: "九、条款变更",
          paragraphs: [
            "我们可能会不时更新本条款。如有重大变更，我们会在本页面发布新版本，并更新页面顶部的日期。",
          ],
        },
        {
          heading: "十、联系我们",
          paragraphs: supportParagraph(ctx.email, (email) =>
            `对本条款有疑问？请发送邮件至 ${email}。`,
          ),
        },
      ],
    };
  }

  return {
    title: "Terms of Service",
    description:
      "The rules for using aivd.ai to generate AI videos, including credits, billing, ownership, and acceptable use.",
    intro: `These terms explain how ${company} works and what you can expect from us, as well as what we expect from you.`,
    sections: [
      {
        heading: "1. The service",
        paragraphs: [
          `${company} is an AI video generation platform. You can turn text prompts and images into videos using third-party AI models.`,
          "We may add, change, or retire features, models, or usage limits at any time.",
        ],
      },
      {
        heading: "2. Accounts",
        paragraphs: [
          "You need an account to use the service. Keep your account details accurate and your login credentials secure.",
          "You are responsible for everything that happens under your account, and you must be legally able to enter into a binding agreement where you live.",
        ],
      },
      {
        heading: "3. Credits and billing",
        paragraphs: [
          "The service is credit-based. Every generation consumes credits, and different features and models consume different amounts.",
          "Credits come from one-time packs or from subscriptions, and the price is shown at checkout in US dollars (USD) before you pay.",
          "If a generation fails or errors out, the credits used for that generation are returned to your account automatically.",
          "You can cancel a subscription at any time from your account settings. Cancellation takes effect at the end of the current billing period, and you will not be charged again after that.",
        ],
      },
      {
        heading: "4. Your content",
        paragraphs: [
          "You own the content you generate, subject to the terms of the model providers that power the generation and to applicable law.",
          "You grant us only the limited licence we need to host, process, and display your content so that we can provide the service to you. We do not use your content for anything else without your permission.",
          "Commercial use: content you generate with the service may be used commercially, including content made with the free sign-up credits; paid plans export without a watermark. When you use it commercially, you still need the rights to anything you uploaded (such as photos of people, logos or footage), should check the result before you publish it, and must follow the rules of the platform you publish on, for example disclosure rules for AI-generated or altered content.",
        ],
      },
      {
        heading: "5. Prohibited content",
        paragraphs: ["You may not use the service to create, upload, or share:"],
        bullets: [
          "content that is illegal or that violates anyone's rights;",
          "sexual content involving minors;",
          "non-consensual intimate imagery;",
          "harassment, threats, or hate;",
          "impersonation, or deepfakes of real people without their consent;",
          "content that infringes intellectual property;",
          "malware, phishing, or spam;",
          "election or medical misinformation.",
        ],
      },
      {
        heading: "6. Moderation and account suspension",
        paragraphs: [
          "We may remove content, limit features, or suspend or terminate accounts that break these terms or that put the service or other people at risk.",
        ],
      },
      {
        heading: "7. Disclaimers and limitation of liability",
        paragraphs: [
          'The service is provided "as is" and "as available". AI output can be inaccurate, incomplete, or unexpected, and you are responsible for reviewing it before you use or publish it.',
          "To the fullest extent allowed by law, we are not liable for indirect, incidental, or consequential losses, and our total liability is limited to the amount you paid us in the twelve months before the event giving rise to the claim.",
        ],
      },
      {
        heading: "8. Governing law",
        paragraphs: [`These terms are governed by ${law}.`],
      },
      {
        heading: "9. Changes to these terms",
        paragraphs: [
          "We may update these terms from time to time. If we make a material change, we will post the new version here and update the date at the top of this page.",
        ],
      },
      {
        heading: "10. Contact",
        paragraphs: supportParagraph(
          ctx.email,
          (email) => `Questions about these terms? Email us at ${email}.`,
        ),
      },
    ],
  };
}

function privacyDoc(locale: LegalLocale, ctx: LegalContext): LegalDoc {
  const company = resolveCompanyName(ctx.companyName);

  if (locale === "zh") {
    return {
      title: "隐私政策",
      description:
        "我们如何收集、使用、存储和共享你的信息，以及你可以行使的选择与权利。",
      intro: `${company} 只收集运行服务所必需的信息。本政策说明我们收集哪些信息、为何收集、如何存储、与谁共享，以及你可以做出的选择。`,
      sections: [
        {
          heading: "一、我们收集的信息",
          paragraphs: ["当你使用本服务时，我们会收集以下信息："],
          bullets: [
            "账号信息，例如邮箱地址、姓名和头像；",
            "付款信息——付款由 Stripe 处理，我们不会存储你的银行卡号；",
            "你提供的内容，例如提示词、上传的图片以及生成的视频；",
            "使用与设备信息，例如你浏览的页面、使用的功能、IP 地址以及浏览器和设备类型。",
          ],
        },
        {
          heading: "二、我们为何使用这些信息",
          paragraphs: [
            "我们使用这些信息来提供服务、处理付款、执行并返回你的生成任务、保护账号安全、防止滥用和欺诈，以及了解服务的使用情况以便改进。",
          ],
        },
        {
          heading: "三、我们如何存储你的内容",
          paragraphs: [
            "你上传的内容和生成的视频保存在私有对象存储中。它们不会公开列出，只有在你查看或下载时生成的短期签名链接才能访问。",
          ],
        },
        {
          heading: "四、我们与谁共享信息",
          paragraphs: ["我们只会与运行服务所必需的提供方共享个人信息："],
          bullets: [
            "支付服务商 Stripe，用于收款和处理账单；",
            "AI 模型提供方，用于完成你请求的生成任务；",
            "托管与基础设施提供方，用于运行和存储服务；",
            "我们不会出售你的个人信息。",
          ],
        },
        {
          heading: "五、保留期限",
          paragraphs: [
            "在你的账号存续期间，我们会保留你的信息；账号关闭后，如为履行法律、税务或会计义务所必需，我们会在合理期限内继续保留。信息不再需要时，我们会删除或匿名化处理。",
          ],
        },
        {
          heading: "六、你的权利",
          paragraphs: supportParagraph(ctx.email, (email) =>
            `你可以要求访问、删除或导出你的个人信息，也可以要求我们更正这些信息。请发送邮件至 ${email}，我们会协助你。如法律要求，部分信息可能会被保留。`,
          ),
        },
        {
          heading: "七、Cookie 与分析",
          paragraphs: [
            "我们使用为保持登录状态和运行服务所必需的 Cookie。我们使用注重隐私的分析工具，它们不会建立广告画像，也不会出售你的数据。",
          ],
        },
        {
          heading: "八、儿童",
          paragraphs: [
            "本服务不面向未满 13 岁的儿童，我们不会在知情的情况下收集他们的个人信息。如果你认为未满 13 岁的儿童向我们提供了个人信息，请联系我们，我们会将其删除。",
          ],
        },
        {
          heading: "九、政策变更",
          paragraphs: [
            "我们可能会不时更新本政策。如有重大变更，我们会在本页面发布新版本，并更新页面顶部的日期。",
          ],
        },
        {
          heading: "十、联系我们",
          paragraphs: supportParagraph(ctx.email, (email) =>
            `对隐私有疑问？请发送邮件至 ${email}。`,
          ),
        },
      ],
    };
  }

  return {
    title: "Privacy Policy",
    description:
      "How aivd.ai collects, uses, stores, and shares your information, and the choices and rights you have.",
    intro: `${company} collects only what we need to run the service. This policy explains what we collect, why we collect it, how we store it, who we share it with, and the choices you have.`,
    sections: [
      {
        heading: "1. Information we collect",
        paragraphs: ["When you use the service, we collect:"],
        bullets: [
          "account information, such as your email address, name, and profile picture;",
          "payment information — payments are handled by Stripe, and we do not store your card numbers;",
          "content you provide, such as prompts, uploaded images, and the videos you generate;",
          "usage and device information, such as the pages you view, the features you use, your IP address, and your browser and device type.",
        ],
      },
      {
        heading: "2. Why we use it",
        paragraphs: [
          "We use this information to provide the service, process payments, run and return your generations, keep your account secure, prevent abuse and fraud, and understand how the service is used so we can improve it.",
        ],
      },
      {
        heading: "3. How we store your content",
        paragraphs: [
          "Your uploads and generated videos are kept in private object storage. They are not publicly listed, and access is granted through short-lived signed links that are created for you when you view or download them.",
        ],
      },
      {
        heading: "4. Who we share it with",
        paragraphs: [
          "We share personal information only with the providers we need to run the service:",
        ],
        bullets: [
          "our payment processor, Stripe, to take payments and handle billing;",
          "AI model providers, to fulfil the generations you request;",
          "hosting and infrastructure providers, to run and store the service;",
          "We do not sell your personal information.",
        ],
      },
      {
        heading: "5. How long we keep it",
        paragraphs: [
          "We keep your information for as long as your account is active, and for a reasonable period afterwards where we need it to meet legal, tax, or accounting obligations. When it is no longer needed, we delete it or anonymise it.",
        ],
      },
      {
        heading: "6. Your rights",
        paragraphs: supportParagraph(
          ctx.email,
          (email) =>
            `You can ask to access, delete, or export your personal information, or ask us to correct it. Email us at ${email} and we will help. Some information may be kept where the law requires it.`,
        ),
      },
      {
        heading: "7. Cookies and analytics",
        paragraphs: [
          "We use the cookies that are needed to keep you signed in and to run the service. We use privacy-friendly analytics that do not build advertising profiles and do not sell your data.",
        ],
      },
      {
        heading: "8. Children",
        paragraphs: [
          "The service is not intended for children under 13, and we do not knowingly collect personal information from them. If you believe a child under 13 has given us personal information, contact us and we will delete it.",
        ],
      },
      {
        heading: "9. Changes to this policy",
        paragraphs: [
          "We may update this policy from time to time. If we make a material change, we will post the new version here and update the date at the top of this page.",
        ],
      },
      {
        heading: "10. Contact",
        paragraphs: supportParagraph(
          ctx.email,
          (email) => `Questions about privacy? Email us at ${email}.`,
        ),
      },
    ],
  };
}

function refundDoc(locale: LegalLocale, ctx: LegalContext): LegalDoc {
  if (locale === "zh") {
    return {
      title: "退款政策",
      description: "生成失败时积分如何自动退还，以及未使用积分与订阅的退款方式。",
      intro:
        "我们希望你只为真正可用的生成付费。本政策说明生成失败时积分如何退还，以及你可以在什么时候申请退款。",
      sections: [
        {
          heading: "一、生成失败",
          paragraphs: [
            "如果生成失败或出错，该次生成消耗的积分会自动退还到你的账号。通常在检测到失败后立即退还。",
          ],
        },
        {
          heading: "二、未使用的已购积分",
          paragraphs: [
            `你在本站的第一笔购买（积分包或订阅的首次付款），如果这笔购买得到的积分一点都没有使用，可以在付款后 ${ctx.refundWindowDays} 天内发送邮件申请全额退款。随这笔购买赠送的优惠积分会一并收回。`,
          ],
        },
        {
          heading: "三、已使用积分与部分使用的积分包",
          paragraphs: [
            "已经消耗的积分不予退款，已部分使用的积分包不予退款，但法律另有规定的除外。",
          ],
        },
        {
          heading: "四、订阅",
          paragraphs: [
            "你可以随时取消订阅。你仍可使用至当前计费周期结束，此后不再扣费；除第二条所述的首次付款和法律另有规定的情况外，当前周期不提供部分退款。",
          ],
        },
        {
          heading: "五、如何申请退款",
          paragraphs: supportParagraph(ctx.email, (email) =>
            `请发送邮件至 ${email}，并提供账号邮箱和订单号，同时说明遇到的问题。申请通过后，我们会将退款退回原支付方式。`,
          ),
        },
        {
          heading: "六、联系我们",
          paragraphs: supportParagraph(ctx.email, (email) =>
            `如果对付款还有其他疑问，请发送邮件至 ${email}，我们会为你核实。`,
          ),
        },
      ],
    };
  }

  return {
    title: "Refund Policy",
    description:
      "How refunds and automatic credit returns work for failed generations, unused credits, and subscriptions.",
    intro:
      "We want you to pay only for generations that work. This policy explains how credits are returned when something fails, and when you can ask for a refund.",
    sections: [
      {
        heading: "1. Failed generations",
        paragraphs: [
          "If a generation fails or errors out, the credits used for it are returned to your account automatically. This normally happens as soon as we detect the failure.",
        ],
      },
      {
        heading: "2. Unused purchased credits",
        paragraphs: [
          `For your first purchase on the site (a credit pack or the first payment of a subscription), if none of the credits it gave you have been used, you can request a full refund by emailing us within ${ctx.refundWindowDays} days of paying. Any bonus credits that came with it are removed with the refund.`,
        ],
      },
      {
        heading: "3. Used credits and partly used packs",
        paragraphs: [
          "Credits that have been consumed are not refundable, and a pack that has been partly used is not refundable, except where the law requires otherwise.",
        ],
      },
      {
        heading: "4. Subscriptions",
        paragraphs: [
          "You can cancel a subscription at any time. You keep access until the end of the current billing period, you will not be charged again, and we do not give partial refunds for the current period, except for a first payment as described in section 2 or where the law requires otherwise.",
        ],
      },
      {
        heading: "5. How to request a refund",
        paragraphs: supportParagraph(
          ctx.email,
          (email) =>
            `Email us at ${email} with the email address on your account and your order ID, and tell us what went wrong. If your request is approved, we send the refund to the original payment method.`,
        ),
      },
      {
        heading: "6. Contact",
        paragraphs: supportParagraph(
          ctx.email,
          (email) =>
            `Still have a question about a payment? Email us at ${email} and we will look into it.`,
        ),
      },
    ],
  };
}

function contactDoc(locale: LegalLocale, ctx: LegalContext): LegalDoc {
  const company = resolveCompanyName(ctx.companyName);
  const address = resolveCompanyAddress(ctx.companyAddress);

  if (locale === "zh") {
    const companyParagraphs = [`本服务由 ${company} 运营。`];
    if (address.length > 0) {
      companyParagraphs.push(`注册地址：${address}。`);
    }

    return {
      title: "联系我们",
      description: "如何就账号、付款、生成内容或相关政策联系 aivd.ai 团队。",
      intro: "我们的团队规模不大，发送邮件是与我们联系最有效的方式。",
      sections: [
        {
          heading: "一、支持",
          paragraphs: supportParagraph(ctx.email, (email) =>
            `请发送邮件至 ${email}。我们会尽快回复。`,
          ),
        },
        {
          heading: "二、请提供以下信息",
          paragraphs: ["为了帮助我们更快回复，请在邮件中说明："],
          bullets: [
            "你账号使用的邮箱地址；",
            "如果问题与付款有关，请提供订单号；",
            "简要说明发生了什么；",
            "如有帮助，可附上截图。",
          ],
        },
        {
          heading: "三、公司信息",
          paragraphs: companyParagraphs,
        },
      ],
    };
  }

  const companyParagraphs = [`This service is operated by ${company}.`];
  if (address.length > 0) {
    companyParagraphs.push(`Registered address: ${address}.`);
  }

  return {
    title: "Contact",
    description:
      "How to reach the aivd.ai team about your account, payments, generated content, or these policies.",
    intro: "We are a small team, and email is the best way to reach us.",
    sections: [
      {
        heading: "1. Support",
        paragraphs: supportParagraph(
          ctx.email,
          (email) => `Email us at ${email}. We reply as soon as we can.`,
        ),
      },
      {
        heading: "2. What to include",
        paragraphs: ["To help us answer quickly, please include:"],
        bullets: [
          "the email address on your account;",
          "your order ID, if your question is about a payment;",
          "a short description of what happened;",
          "screenshots, if they help explain the issue.",
        ],
      },
      {
        heading: "3. Company details",
        paragraphs: companyParagraphs,
      },
    ],
  };
}

export function getLegalDoc(
  kind: LegalKind,
  locale: LegalLocale,
  ctx: LegalContext,
): LegalDoc {
  let doc: LegalDoc;

  switch (kind) {
    case "terms":
      doc = termsDoc(locale, ctx);
      break;
    case "privacy":
      doc = privacyDoc(locale, ctx);
      break;
    case "refund":
      doc = refundDoc(locale, ctx);
      break;
    case "contact":
      doc = contactDoc(locale, ctx);
      break;
    default:
      doc = termsDoc(locale, ctx);
  }

  return omitEmptySections(doc);
}
