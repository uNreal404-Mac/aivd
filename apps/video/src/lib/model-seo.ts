/**
 * SEO landing page data for the /[locale]/models/[slug] routes.
 *
 * Every string here is written by us. Nothing is copied from a provider's
 * marketing site, and no duration/resolution number is hard-coded in the
 * copy — the page derives those from `getCapabilities`, which reads the
 * real platform configuration in `@/config/credits`.
 */

import { getModelConfig } from "@/config/credits";

export interface ModelSeoFaq {
  q: string;
  a: string;
}

export interface ModelSeoEntry {
  /** Public URL segment: /models/<slug> */
  slug: string;
  /** Backend model id, must exist in CREDITS_CONFIG.models */
  modelId: string;
  /** Display name, matches the model config name */
  name: string;
  /** <title>, max 60 characters, unique */
  title: string;
  /** <meta name="description">, max 155 characters, unique */
  description: string;
  /** One-sentence hero line */
  intro: string;
  /** Exactly three bullet points */
  useCases: string[];
  /** 4–6 question/answer pairs, answers stay general */
  faqs: ModelSeoFaq[];
  /** Simplified Chinese copy rendered on the /zh routes. */
  zh: {
    /** <title>, max 60 characters, unique across both locales */
    title: string;
    /** <meta name="description">, max 155 characters, unique across both locales */
    description: string;
    /** One-sentence hero line */
    intro: string;
    /** Exactly three bullet points */
    useCases: string[];
    /** Same count and meaning as the English FAQs */
    faqs: ModelSeoFaq[];
  };
}

/** Locales a landing page can be rendered in. */
export type ModelSeoLocale = "en" | "zh";

/** Map an arbitrary route locale onto a supported landing page locale. */
export function resolveLocale(locale: string): ModelSeoLocale {
  return locale === "zh" ? "zh" : "en";
}

/** The subset of an entry that differs per locale. */
export interface LocalizedModelSeo {
  slug: string;
  modelId: string;
  name: string;
  title: string;
  description: string;
  intro: string;
  useCases: string[];
  faqs: ModelSeoFaq[];
}

/**
 * Pick the marketing copy for a locale. Everything that is not translated
 * (slug, backend id, display name) is passed through unchanged.
 */
export function localizeModelSeo(
  entry: ModelSeoEntry,
  locale: ModelSeoLocale
): LocalizedModelSeo {
  const copy = locale === "zh" ? entry.zh : entry;

  return {
    slug: entry.slug,
    modelId: entry.modelId,
    name: entry.name,
    title: copy.title,
    description: copy.description,
    intro: copy.intro,
    useCases: [...copy.useCases],
    faqs: copy.faqs.map((faq) => ({ ...faq })),
  };
}

export const MODEL_SEO: ModelSeoEntry[] = [
  {
    slug: "seedance-1-5-pro",
    modelId: "seedance-1.5-pro",
    name: "Seedance 1.5 Pro",
    title: "Seedance 1.5 Pro AI Video Generator",
    description:
      "Generate short videos from text or a still image with Seedance 1.5 Pro. Compare durations, resolutions and aspect ratios, then start creating.",
    intro:
      "Turn a written prompt, or a single reference image, into a short finished clip.",
    useCases: [
      "Short social videos built from a single prompt",
      "Animating a still image into motion",
      "Quick concept tests before a longer shoot",
    ],
    faqs: [
      {
        q: "What can I create with Seedance 1.5 Pro?",
        a: "Short, prompt-driven clips, and clips generated from a single still image when image-to-video is enabled. The options available right now are the ones listed in the capabilities section above.",
      },
      {
        q: "Does Seedance 1.5 Pro support image-to-video?",
        a: "This model accepts a reference image alongside your prompt when image-to-video is enabled for it. The capabilities section above reflects what the platform currently offers.",
      },
      {
        q: "Can I choose the aspect ratio?",
        a: "Yes. The supported aspect ratios for this model are listed in the capabilities section above, and you can pick one in the create panel.",
      },
      {
        q: "How is the credit cost decided?",
        a: "It depends on the model, the length and the quality you select. Open the generator and you will see the estimated cost before you confirm the run.",
      },
      {
        q: "What happens if a generation fails?",
        a: "A failed run does not produce a usable video. You can review the status of each generation in your account and start a new one from there.",
      },
    ],
    zh: {
      title: "Seedance 1.5 Pro AI 视频生成器",
      description:
        "使用 Seedance 1.5 Pro 从文字或单张图片生成短视频。查看支持的时长、分辨率与画面比例，然后开始创作。",
      intro: "把你的提示词或一张参考图，变成一段简短的成片。",
      useCases: [
        "根据一段提示词制作社交媒体短视频",
        "让一张静态图片动起来",
        "在正式拍摄前快速验证创意概念",
      ],
      faqs: [
        {
          q: "用 Seedance 1.5 Pro 可以创作什么？",
          a: "短小的提示词驱动片段，以及在启用图生视频时由单张静态图片生成的片段。当前可用的选项就是上方能力列表中展示的内容。",
        },
        {
          q: "Seedance 1.5 Pro 支持图生视频吗？",
          a: "在启用图生视频时，该模型可以接收一张参考图来补充你的提示词。上方能力列表反映的是平台目前提供的能力。",
        },
        {
          q: "我可以自己选择画面比例吗？",
          a: "可以。该模型支持的画面比例都列在上方能力列表中，你可以在创作面板里挑选一个。",
        },
        {
          q: "积分费用是怎么计算的？",
          a: "这取决于你选择的模型、时长与画质。打开生成器后，你会在确认本次运行之前看到预估费用。",
        },
        {
          q: "如果生成失败会怎样？",
          a: "失败的运行不会产出可用的视频。你可以在账户中查看每次生成的状态，并从那里重新发起一次。",
        },
      ],
    },
  },
];

export const MODEL_SLUGS: string[] = MODEL_SEO.map((entry) => entry.slug);

/** Look up a landing page entry by its public slug. */
export function getModelSeo(slug: string): ModelSeoEntry | undefined {
  return MODEL_SEO.find((entry) => entry.slug === slug);
}

export interface ModelCapabilities {
  durations: number[];
  resolutions: string[];
  aspectRatios: string[];
  imageToVideo: boolean;
}

/**
 * Read the real capabilities for a backend model id.
 * Returns null when the model is not part of the credit configuration.
 * Only values that exist in the config are reported — no audio flag,
 * because the backend configuration does not expose one.
 */
export function getCapabilities(modelId: string): ModelCapabilities | null {
  const config = getModelConfig(modelId);
  if (!config) return null;

  return {
    durations: [...config.durations],
    resolutions: [...(config.qualities ?? [])],
    aspectRatios: [...config.aspectRatios],
    imageToVideo: config.supportImageToVideo === true,
  };
}

export interface FaqJsonLd {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  inLanguage: "en" | "zh-CN";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }>;
}

/**
 * Build a schema.org FAQPage object for the page's structured data.
 * Defaults to the English copy so existing callers keep working.
 */
export function buildFaqJsonLd(
  entry: ModelSeoEntry,
  locale: ModelSeoLocale = "en"
): FaqJsonLd {
  const { faqs } = localizeModelSeo(entry, locale);

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: locale === "zh" ? "zh-CN" : "en",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}

/** Deep link into the generator with this model pre-selected. */
export function tryHref(lang: string, entry: ModelSeoEntry): string {
  return `/${lang}/ai/video?model=${encodeURIComponent(entry.modelId)}`;
}

/** Canonical path of a landing page. */
export function modelHref(lang: string, slug: string): string {
  return `/${lang}/models/${slug}`;
}

/** Every visible label on a landing page, per locale. */
export interface ModelPageCopy {
  h1: (name: string) => string;
  tryLabel: (name: string) => string;
  capabilitiesHeading: string;
  durations: string;
  resolutions: string;
  aspectRatios: string;
  imageToVideo: string;
  yes: string;
  no: string;
  secondsSuffix: string;
  useCasesHeading: string;
  howToHeading: string;
  steps: (name: string) => [string, string, string];
  faqHeading: string;
  otherModelsHeading: string;
}

export const MODEL_PAGE_COPY: Record<ModelSeoLocale, ModelPageCopy> = {
  en: {
    h1: (name) => `${name} AI Video Generator`,
    tryLabel: (name) => `Try ${name}`,
    capabilitiesHeading: "Capabilities",
    durations: "Durations",
    resolutions: "Resolutions",
    aspectRatios: "Aspect ratios",
    imageToVideo: "Image to video",
    yes: "Yes",
    no: "No",
    secondsSuffix: "s",
    useCasesHeading: "Use cases",
    howToHeading: "How to use",
    steps: (name) => [
      "Write a prompt",
      `Pick ${name} and settings`,
      "Generate and download",
    ],
    faqHeading: "FAQ",
    otherModelsHeading: "Other models",
  },
  zh: {
    h1: (name) => `${name} AI 视频生成器`,
    tryLabel: (name) => `试用 ${name}`,
    capabilitiesHeading: "能力",
    durations: "时长",
    resolutions: "分辨率",
    aspectRatios: "画面比例",
    imageToVideo: "图生视频",
    yes: "是",
    no: "否",
    secondsSuffix: "秒",
    useCasesHeading: "适用场景",
    howToHeading: "使用方法",
    steps: (name) => ["写下提示词", `选择 ${name} 并调整参数`, "生成并下载"],
    faqHeading: "常见问题",
    otherModelsHeading: "其他模型",
  },
};
