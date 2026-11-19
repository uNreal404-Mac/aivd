/**
 * SEO landing page data for the /[locale]/models/[slug] routes.
 *
 * Every string here is written by us. Nothing is copied from a provider's
 * marketing site, and no duration/resolution number is hard-coded in the
 * copy — the page derives those from `getCapabilities`, which reads the
 * real platform configuration in `@/config/credits`.
 */

import { getModelConfig } from "@/config/credits";
import { localizedHref } from "@/lib/locale-path";

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
  {
    slug: "wan-2-6",
    modelId: "wan2.6",
    name: "Wan 2.6",
    title: "Wan 2.6 AI Video Generator",
    description:
      "Try Wan 2.6 for text-to-video and image-to-video generation. Review the available settings above and pick what fits your idea.",
    intro:
      "A flexible video model for prompt-driven clips and image-to-video animation.",
    useCases: [
      "Turning story ideas into short clips",
      "Adding motion to a product or portrait photo",
      "Drafting scenes for review with a team",
    ],
    faqs: [
      {
        q: "What is Wan 2.6 best for?",
        a: "Turning a written prompt into a short video, and animating a still image when you want the result to start from a specific frame.",
      },
      {
        q: "Does Wan 2.6 support image-to-video?",
        a: "It does when image-to-video is enabled for this model, which the capabilities section above reports.",
      },
      {
        q: "Which durations and resolutions can I pick?",
        a: "The selectable options come from the platform configuration and are shown in the capabilities section above.",
      },
      {
        q: "Can I upload my own reference image?",
        a: "Yes. Upload a clear image if you want the result to stay close to a particular subject or look.",
      },
      {
        q: "Do I need an account to try it?",
        a: "You can open the generator to look at the settings first, and you will need an account to run a generation.",
      },
    ],
    zh: {
      title: "Wan 2.6 AI 视频生成器",
      description:
        "使用 Wan 2.6 体验文生视频与图生视频。查看上方可用设置，挑选最适合你创意的一项。",
      intro: "一款灵活的视频模型，适用于提示词驱动的片段与图生视频动画。",
      useCases: [
        "把故事创意变成短视频",
        "为产品图或人像照片添加动态",
        "制作场景草稿供团队评审",
      ],
      faqs: [
        {
          q: "Wan 2.6 最擅长什么？",
          a: "把写好的提示词变成短视频；当你希望画面从某一帧开始时，也可以让一张静态图片动起来。",
        },
        {
          q: "Wan 2.6 支持图生视频吗？",
          a: "当该模型启用了图生视频时是支持的，上方能力列表会说明这一点。",
        },
        {
          q: "我可以选择哪些时长和分辨率？",
          a: "可选选项来自平台配置，并展示在上方能力列表中。",
        },
        {
          q: "我可以上传自己的参考图吗？",
          a: "可以。如果你希望结果贴近某个特定的主体或风格，请上传一张清晰的图片。",
        },
        {
          q: "试用需要账号吗？",
          a: "你可以先打开生成器查看设置，而要运行一次生成则需要账号。",
        },
      ],
    },
  },
  {
    slug: "veo-3-1",
    modelId: "veo-3.1",
    name: "Veo 3.1",
    title: "Veo 3.1 AI Video Generator",
    description:
      "Explore Veo 3.1 as an option for AI video generation. Check the capabilities listed above before you decide which model to use.",
    intro:
      "A video model you can compare side by side with the others in the create panel.",
    useCases: [
      "Explainer clips and short ads",
      "Visualising a script idea quickly",
      "Producing variations of the same prompt",
    ],
    faqs: [
      {
        q: "What makes Veo 3.1 worth comparing?",
        a: "It is one of several video models in the create panel, so you can run the same prompt through it and judge the result yourself.",
      },
      {
        q: "Does Veo 3.1 accept an input image?",
        a: "An input image is supported when the capabilities section above lists image to video as available.",
      },
      {
        q: "How long can a Veo 3.1 clip be?",
        a: "The available lengths are listed in the capabilities section above. Pick the one that matches your edit.",
      },
      {
        q: "How do I start a generation?",
        a: "Use the button on this page to open the generator, write your prompt, choose your settings and submit the run.",
      },
    ],
    zh: {
      title: "Veo 3.1 AI 视频生成器",
      description:
        "把 Veo 3.1 作为 AI 视频生成的一个选项来了解。在做决定前，先看看上方列出的能力。",
      intro: "一款可以和创作面板里其他模型并排比较的视频模型。",
      useCases: [
        "讲解视频与短广告",
        "快速把脚本设想可视化",
        "用同一段提示词产出多个变体",
      ],
      faqs: [
        {
          q: "Veo 3.1 有什么值得比较的地方？",
          a: "它是创作面板中多款视频模型之一，你可以把同一段提示词交给它运行，然后自行判断结果。",
        },
        {
          q: "Veo 3.1 接受输入的图片吗？",
          a: "当上方能力列表把图生视频标为可用时，它就支持输入图片。",
        },
        {
          q: "Veo 3.1 的片段可以有多长？",
          a: "可选时长列在上方能力列表中。挑一个适合你剪辑的即可。",
        },
        {
          q: "我该如何开始一次生成？",
          a: "使用本页的按钮打开生成器，写下你的提示词，选择好设置并提交运行。",
        },
      ],
    },
  },
  {
    slug: "sora-2",
    modelId: "sora-2",
    name: "Sora 2",
    title: "Sora 2 AI Video Generator",
    description:
      "See how Sora 2 handles prompt-based and image-based video creation. The settings above show everything this model currently supports.",
    intro: "A prompt-first video model for quick, expressive short clips.",
    useCases: [
      "Fast idea sketches from text",
      "Bringing an illustration to life",
      "Creating scenes for social posts",
    ],
    faqs: [
      {
        q: "What can Sora 2 generate?",
        a: "Short video clips from a text prompt, and from a starting image when image-to-video is enabled for the model.",
      },
      {
        q: "Does Sora 2 support image-to-video?",
        a: "Image-to-video is available for this model. The capabilities section above shows what the platform offers right now.",
      },
      {
        q: "Which settings can I change?",
        a: "Length, resolution where offered, and aspect ratio. The exact options for this model are the ones listed in the capabilities section above.",
      },
      {
        q: "Where do I find the finished video?",
        a: "Generations appear in your account once they finish processing, and you can download the finished clip from there.",
      },
    ],
    zh: {
      title: "Sora 2 AI 视频生成器",
      description:
        "看看 Sora 2 如何处理基于提示词与基于图片的视频创作。上方设置展示了该模型目前支持的全部能力。",
      intro: "一款以提示词为先的视频模型，适合快速、富有表现力的短片。",
      useCases: [
        "从文字快速勾勒创意",
        "让一张插画活起来",
        "为社交帖子制作场景",
      ],
      faqs: [
        {
          q: "Sora 2 可以生成什么？",
          a: "根据文字提示词生成短视频片段；当该模型启用图生视频时，也可以从一张起始图片生成。",
        },
        {
          q: "Sora 2 支持图生视频吗？",
          a: "该模型支持图生视频。上方能力列表展示了平台目前提供的能力。",
        },
        {
          q: "我可以调整哪些设置？",
          a: "时长、提供时的分辨率，以及画面比例。该模型确切的选项就是上方能力列表中列出的那些。",
        },
        {
          q: "我在哪里能找到生成好的视频？",
          a: "生成处理完成后会出现在你的账户中，你可以在那里下载做好的片段。",
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
  return localizedHref(lang, `/ai/video?model=${encodeURIComponent(entry.modelId)}`);
}

/** Canonical path of a landing page. */
export function modelHref(lang: string, slug: string): string {
  return localizedHref(lang, `/models/${slug}`);
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
