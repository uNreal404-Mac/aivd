/**
 * SEO landing copy + structured data for the video app.
 *
 * These entry pages share one content shape:
 *  - /ai-video-generator            (new route)
 *  - /text-to-video                 (existing tool route, landing appended below the tool)
 *  - /image-to-video                (existing tool route, landing appended below the tool)
 *  - /reference-to-video            (existing tool route, landing appended below the tool)
 *  - /frames-to-video               (new route)
 *  - /ai-video-generator-with-audio (new route)
 *  - /ai-short-video-generator      (new route)
 *  - /ai-video-generator-for-tiktok (new route)
 *  - /animate-image-ai              (new route)
 *  - /ai-video-ad-generator         (new route)
 *  - /ai-product-video-generator    (new route)
 *  - /ai-cinematic-video-generator  (new route)
 *  - /ai-b-roll-generator           (new route)
 *
 * Copy rules: original English + Chinese, no invented metrics (no user counts,
 * ratings, speeds or prices), no third-party brands other than the real model
 * names below, and no promise of free generation. Entry points only link to the
 * existing generator.
 */

import {
  EN_AI_SHORT_VIDEO,
  EN_AI_VIDEO_FOR_TIKTOK,
  EN_AI_VIDEO_WITH_AUDIO,
  EN_FRAMES_TO_VIDEO,
  EN_REFERENCE_TO_VIDEO,
  ZH_AI_SHORT_VIDEO,
  ZH_AI_VIDEO_FOR_TIKTOK,
  ZH_AI_VIDEO_WITH_AUDIO,
  ZH_FRAMES_TO_VIDEO,
  ZH_REFERENCE_TO_VIDEO,
} from "./seo-landing-more";
import {
  EN_AI_B_ROLL,
  EN_AI_CINEMATIC_VIDEO,
  EN_AI_PRODUCT_VIDEO,
  EN_AI_VIDEO_AD,
  EN_ANIMATE_IMAGE_AI,
  ZH_AI_B_ROLL,
  ZH_AI_CINEMATIC_VIDEO,
  ZH_AI_PRODUCT_VIDEO,
  ZH_AI_VIDEO_AD,
  ZH_ANIMATE_IMAGE_AI,
} from "./seo-landing-more-3";

export type SeoLandingSlug =
  | "ai-video-generator"
  | "text-to-video"
  | "image-to-video"
  | "reference-to-video"
  | "frames-to-video"
  | "ai-video-generator-with-audio"
  | "ai-short-video-generator"
  | "ai-video-generator-for-tiktok"
  | "animate-image-ai"
  | "ai-video-ad-generator"
  | "ai-product-video-generator"
  | "ai-cinematic-video-generator"
  | "ai-b-roll-generator";

export const SEO_LANDING_SLUGS: readonly SeoLandingSlug[] = [
  "ai-video-generator",
  "text-to-video",
  "image-to-video",
  "reference-to-video",
  "frames-to-video",
  "ai-video-generator-with-audio",
  "ai-short-video-generator",
  "ai-video-generator-for-tiktok",
  "animate-image-ai",
  "ai-video-ad-generator",
  "ai-product-video-generator",
  "ai-cinematic-video-generator",
  "ai-b-roll-generator",
];

export type SeoLocale = "en" | "zh";

export interface SeoLandingStep {
  title: string;
  body: string;
}

export interface SeoLandingCompareRow {
  model: string;
  bestFor: string;
  input: string;
}

export interface SeoLandingFaqItem {
  q: string;
  a: string;
}

export interface SeoLandingRelatedLink {
  label: string;
  path: string;
}

export interface SeoLandingContent {
  path: string;
  title: string;
  description: string;
  h1: string;
  heroSub: string;
  promptPlaceholder: string;
  ctaLabel: string;
  whatTitle: string;
  whatBody: string[];
  stepsTitle: string;
  steps: SeoLandingStep[];
  compareTitle: string;
  compareRows: SeoLandingCompareRow[];
  faqTitle: string;
  faq: SeoLandingFaqItem[];
  related?: SeoLandingRelatedLink[];
}

export interface FaqJsonLd {
  "@context": "https://schema.org";
  "@type": "FAQPage";
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: { "@type": "Answer"; text: string };
  }>;
}

export interface HowToJsonLd {
  "@context": "https://schema.org";
  "@type": "HowTo";
  name: string;
  step: Array<{
    "@type": "HowToStep";
    position: number;
    name: string;
    text: string;
  }>;
}

/** Input modality is the same for every model we surface: text and image. */
const MODEL_INPUT = "Text, image";

const MODEL_ROWS: Record<SeoLocale, readonly SeoLandingCompareRow[]> = {
  en: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "Lively motion, rich scene detail and audio generation",
      input: MODEL_INPUT,
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Quicker drafts at a lower cost per second",
      input: MODEL_INPUT,
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "The most detailed Seedance 1.0 output",
      input: MODEL_INPUT,
    },
  ],
  zh: [
    {
      model: "Seedance 1.5 Pro",
      bestFor: "运动生动、场景细节丰富，支持生成音频",
      input: MODEL_INPUT,
    },
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合快速出草稿，每秒成本更低",
      input: MODEL_INPUT,
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 中细节最丰富的输出",
      input: MODEL_INPUT,
    },
  ],
};

function modelRows(locale: SeoLocale): SeoLandingCompareRow[] {
  return MODEL_ROWS[locale].map((row) => ({ ...row }));
}

/* ------------------------------------------------------------------ */
/* English                                                             */
/* ------------------------------------------------------------------ */

const EN_AI_VIDEO_GENERATOR: SeoLandingContent = {
  path: "/ai-video-generator",
  title: "AI Video Generator — Create Video From a Prompt",
  description:
    "Turn a written prompt into video with an AI video generator. See how it works, compare models, and open the generator to start creating.",
  h1: "AI Video Generator",
  heroSub:
    "Describe the video you want in plain language, then open the generator to bring it to life.",
  promptPlaceholder: "Describe the video you want to create…",
  ctaLabel: "Open the generator",
  whatTitle: "What is an AI video generator?",
  whatBody: [
    "An AI video generator turns a written description into moving footage. You write what should happen, and the model builds a sequence with matching motion, framing and mood.",
    "Because it starts from language, you can explore many directions quickly: change the subject, the setting or the camera move, and generate a new take without reshooting anything.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Write your prompt",
      body: "Describe the scene, the subject and the camera movement in a sentence or two. Plain language works best.",
    },
    {
      title: "Choose a model",
      body: "Pick the model that fits your idea. Each one has a different feel for motion, detail and realism.",
    },
    {
      title: "Generate and refine",
      body: "Open the generator, run your prompt, then adjust the wording until the result matches what you pictured.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: modelRows("en"),
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "What can an AI video generator create?",
      a: "Short clips built from your description: product shots, scenery, character moments and abstract sequences. Results vary by model and prompt.",
    },
    {
      q: "Which model should I start with?",
      a: "For lively motion or clips with sound, try Seedance 1.5 Pro. For quick drafts, Seedance 1.0 Pro Fast. For the most detail from Seedance 1.0, Seedance 1.0 Pro Quality.",
    },
    {
      q: "Do I need editing experience?",
      a: "No. You write a prompt and generate. If the first result is off, change a few words and run it again.",
    },
    {
      q: "Can I start from a picture instead of text?",
      a: "Yes. Image to video takes a still frame as the starting point and animates it.",
    },
    {
      q: "How long should a prompt be?",
      a: "One or two sentences is usually enough. Describe the subject, the setting and how the camera should move.",
    },
  ],
};

const EN_TEXT_TO_VIDEO: SeoLandingContent = {
  path: "/text-to-video",
  title: "Text to Video — Turn Scripts Into Clips",
  description:
    "A text to video workflow that starts with a written script. Learn how prompts become clips, and open the generator to try your own.",
  h1: "Text to Video",
  heroSub:
    "Paste a script or a single line, then open the generator to turn it into a clip.",
  promptPlaceholder: "Paste the script or line you want to film…",
  ctaLabel: "Open the generator",
  whatTitle: "What does text to video mean?",
  whatBody: [
    "Text to video takes the words you already have — a script, a storyboard note, a single line — and renders them as footage. The text is the whole input.",
    "That makes it a fast way to test an idea before committing to a shoot. Rewrite a line, regenerate, and compare the versions side by side.",
  ],
  stepsTitle: "How text becomes video",
  steps: [
    {
      title: "Prepare the text",
      body: "Keep the line concrete: who or what is on screen, where it happens, and what the camera does.",
    },
    {
      title: "Match it to a model",
      body: "Choose the model whose strengths line up with the scene — motion, detail or speed.",
    },
    {
      title: "Generate and compare",
      body: "Open the generator, run the line, then keep the wording that produced the best clip.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: modelRows("en"),
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "Is text to video the same as prompting a model?",
      a: "Yes. The text is the input and the model produces the clip. A clear script line usually works better than a long description.",
    },
    {
      q: "What kind of text works best?",
      a: "Concrete lines: who or what is on screen, where it happens and what the camera does. Vague lines give vague results.",
    },
    {
      q: "Can I keep a consistent look across clips?",
      a: "Describe the look the same way each time — same lighting, same framing, same palette — and reuse the wording.",
    },
    {
      q: "Can I pair a script with a picture?",
      a: "Yes. Image to video combines a still frame with your written description of the motion.",
    },
    {
      q: "What if the result ignores part of my prompt?",
      a: "Shorten the prompt, keep the most important detail first, and generate again.",
    },
  ],
};

const EN_IMAGE_TO_VIDEO: SeoLandingContent = {
  path: "/image-to-video",
  title: "Image to Video Tool — Turn Any Image Into a Clip",
  description:
    "Give a still image motion with an image to video workflow. Learn how a picture becomes a clip, then open the generator to begin.",
  h1: "Image to Video",
  heroSub:
    "Start from a still picture and describe the motion you want to see.",
  promptPlaceholder: "Describe how the image should move…",
  ctaLabel: "Open the generator",
  whatTitle: "How image to video works",
  whatBody: [
    "Image to video uses a still frame as its starting point. The frame fixes the subject, the composition and the light, and your description decides what moves.",
    "It is the most controlled way to work, because you already know what the first moment looks like. Add motion to a photograph, a render or a product still.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Pick the frame",
      body: "Choose a clear image with a readable subject. Simple backgrounds leave more room for believable motion.",
    },
    {
      title: "Describe the movement",
      body: "Name the motion: a slow push in, a pan across the scene, drifting light, or a subject turning toward the camera.",
    },
    {
      title: "Generate and adjust",
      body: "Open the generator, run the prompt, then rewrite the movement until the clip feels right.",
    },
  ],
  compareTitle: "Models you can choose",
  compareRows: modelRows("en"),
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "What does image to video do?",
      a: "It takes a still picture and generates motion for it, guided by your description of how the scene should move.",
    },
    {
      q: "What makes a good starting image?",
      a: "A clear subject, a simple background and even lighting. Blurry or cluttered frames leave less room for believable motion.",
    },
    {
      q: "How do I describe the motion?",
      a: "Name the movement directly: a slow push in, a pan across the frame, drifting clouds, or a subject turning toward the camera.",
    },
    {
      q: "Can I add movement to a product photo?",
      a: "Yes. Product images work well for slow turns, light sweeps and gentle camera moves.",
    },
    {
      q: "Can I generate from text alone?",
      a: "Yes. Text to video starts from a written prompt with no image needed.",
    },
  ],
  related: [
    {
      label: "Want an old photo or portrait to move? See Make Your Photo Move",
      path: "/animate-image-ai",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Chinese                                                             */
/* ------------------------------------------------------------------ */

const ZH_AI_VIDEO_GENERATOR: SeoLandingContent = {
  path: "/ai-video-generator",
  title: "AI 视频生成器 — 用提示词生成视频",
  description:
    "用提示词驱动 AI 视频生成器，写下描述即可开始创作。了解它的工作方式与可选模型，然后直接打开生成器。",
  h1: "AI 视频生成器",
  heroSub: "用日常语言描述你想要的画面，再打开生成器把它变成视频。",
  promptPlaceholder: "描述你想生成的视频…",
  ctaLabel: "打开生成器",
  whatTitle: "什么是 AI 视频生成器？",
  whatBody: [
    "AI 视频生成器可以把一段文字描述变成动态画面。你负责写清镜头里的对象与动作，模型负责补上运动、构图和氛围。",
    "因为起点是语言，你可以很快尝试不同方向：换主体、换场景、换运镜，都能生成新的版本，不需要重新拍摄。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "写下提示词",
      body: "用一两句话描述场景、主体和镜头运动。日常语言就足够。",
    },
    {
      title: "选择模型",
      body: "挑选更贴合你想法的模型。不同模型在运动、细节和写实感上各有侧重。",
    },
    {
      title: "生成并微调",
      body: "打开生成器运行提示词，再根据结果调整措辞，直到画面接近你的设想。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: modelRows("zh"),
  faqTitle: "常见问题",
  faq: [
    {
      q: "AI 视频生成器能生成什么？",
      a: "根据你的描述生成短片：产品镜头、风景、人物片段以及抽象画面。效果会随模型和提示词而变化。",
    },
    {
      q: "应该先用哪个模型？",
      a: "想要生动的运动或带声音的片段，可以试试 Seedance 1.5 Pro；快速出草稿选 Seedance 1.0 Pro Fast；想要 Seedance 1.0 中最丰富的细节，选 Seedance 1.0 Pro Quality。",
    },
    {
      q: "需要剪辑经验吗？",
      a: "不需要。写好提示词直接生成，如果第一次不理想，改几个词再试一次即可。",
    },
    {
      q: "可以用图片作为起点吗？",
      a: "可以。图片生成视频会以一张静态画面作为起点，把它变成动态片段。",
    },
    {
      q: "提示词要写多长？",
      a: "通常一两句话就够。写清主体、场景和镜头运动方式。",
    },
  ],
};

const ZH_TEXT_TO_VIDEO: SeoLandingContent = {
  path: "/text-to-video",
  title: "文字生成视频 — 把文案变成画面",
  description:
    "以文字为起点的视频生成流程：了解提示词如何变成片段，再打开生成器把文案写成视频。",
  h1: "文字生成视频",
  heroSub: "粘贴一段脚本或一句话，再打开生成器把它变成片段。",
  promptPlaceholder: "粘贴你想拍成视频的脚本或句子…",
  ctaLabel: "打开生成器",
  whatTitle: "文字生成视频是什么意思？",
  whatBody: [
    "文字生成视频会把你已经写好的文字——脚本、分镜备注、甚至一句话——渲染成画面。文字本身就是全部输入。",
    "这让它在正式拍摄前非常适合试想法：改一句台词、重新生成，就能把不同版本放在一起比较。",
  ],
  stepsTitle: "文字如何变成视频",
  steps: [
    {
      title: "准备好文字",
      body: "尽量写得具体：镜头里是谁或什么、发生在哪里、镜头如何运动。",
    },
    {
      title: "匹配合适的模型",
      body: "根据画面重点选择模型：运动感、细节或生成速度。",
    },
    {
      title: "生成并对比",
      body: "打开生成器运行这句文字，然后保留效果最好的那版措辞。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: modelRows("zh"),
  faqTitle: "常见问题",
  faq: [
    {
      q: "文字生成视频就是给模型写提示词吗？",
      a: "是的。文字是输入，模型负责产出片段。一句清晰的脚本通常比冗长的描述更有效。",
    },
    {
      q: "什么样的文字效果更好？",
      a: "具体的句子：镜头里是谁或什么、发生在哪里、镜头怎么动。描述越模糊，结果就越模糊。",
    },
    {
      q: "多个片段能保持一致的风格吗？",
      a: "每次用同样的方式描述风格——同样的光线、构图和色调——并复用相同的措辞。",
    },
    {
      q: "可以把脚本和图片一起用吗？",
      a: "可以。图片生成视频会把一张静态画面和你的运动描述结合起来。",
    },
    {
      q: "如果结果没有完全遵循提示词怎么办？",
      a: "把提示词写短一些，把最重要的细节放在最前面，然后重新生成。",
    },
  ],
};

const ZH_IMAGE_TO_VIDEO: SeoLandingContent = {
  path: "/image-to-video",
  title: "图片生成视频工具 — 把任意图片转成视频片段",
  description:
    "用图片生成视频给静态画面加上运动：了解一张图片如何变成视频片段，再打开生成器开始创作。",
  h1: "图片生成视频",
  heroSub: "从一张静态图片开始，描述你希望画面如何运动。",
  promptPlaceholder: "描述这张图片应该如何运动…",
  ctaLabel: "打开生成器",
  whatTitle: "图片生成视频是怎么实现的",
  whatBody: [
    "图片生成视频以一张静态画面作为起点。这张图已经确定了主体、构图和光线，而你的描述决定哪些部分会动起来。",
    "这是最可控的一种方式，因为第一帧你已经很熟悉。给照片、渲染图或产品静物加上运动即可。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "选择起始画面",
      body: "挑一张主体清晰、背景简洁的图片，这样更容易得到自然的运动。",
    },
    {
      title: "描述运动方式",
      body: "直接写出运动：缓慢推近、横向摇镜、光影流动，或者主体转向镜头。",
    },
    {
      title: "生成并调整",
      body: "打开生成器运行提示词，再改写运动描述，直到片段符合预期。",
    },
  ],
  compareTitle: "可以选择的模型",
  compareRows: modelRows("zh"),
  faqTitle: "常见问题",
  faq: [
    {
      q: "图片生成视频能做什么？",
      a: "它会把一张静态图片变成动态画面，运动方式由你对场景如何运动的描述决定。",
    },
    {
      q: "什么样的起始图片比较好？",
      a: "主体清晰、背景简洁、光线均匀的图片。模糊或杂乱的画面留给运动的空间更小。",
    },
    {
      q: "运动描述该怎么写？",
      a: "直接写运动本身：缓慢推近、横向摇镜、云层流动，或者主体转向镜头。",
    },
    {
      q: "能给产品图加上运动吗？",
      a: "可以。产品图很适合做缓慢旋转、光线扫过和轻柔的运镜。",
    },
    {
      q: "只用文字也能生成吗？",
      a: "可以。文字生成视频直接从写好的提示词出发，不需要图片。",
    },
  ],
  related: [
    {
      label: "想让老照片或人像动起来？看看「让照片动起来」",
      path: "/animate-image-ai",
    },
  ],
};

export const SEO_LANDING: Record<
  SeoLandingSlug,
  { en: SeoLandingContent; zh: SeoLandingContent }
> = {
  "ai-video-generator": {
    en: EN_AI_VIDEO_GENERATOR,
    zh: ZH_AI_VIDEO_GENERATOR,
  },
  "text-to-video": {
    en: EN_TEXT_TO_VIDEO,
    zh: ZH_TEXT_TO_VIDEO,
  },
  "image-to-video": {
    en: EN_IMAGE_TO_VIDEO,
    zh: ZH_IMAGE_TO_VIDEO,
  },
  "reference-to-video": {
    en: EN_REFERENCE_TO_VIDEO,
    zh: ZH_REFERENCE_TO_VIDEO,
  },
  "frames-to-video": {
    en: EN_FRAMES_TO_VIDEO,
    zh: ZH_FRAMES_TO_VIDEO,
  },
  "ai-video-generator-with-audio": {
    en: EN_AI_VIDEO_WITH_AUDIO,
    zh: ZH_AI_VIDEO_WITH_AUDIO,
  },
  "ai-short-video-generator": {
    en: EN_AI_SHORT_VIDEO,
    zh: ZH_AI_SHORT_VIDEO,
  },
  "ai-video-generator-for-tiktok": {
    en: EN_AI_VIDEO_FOR_TIKTOK,
    zh: ZH_AI_VIDEO_FOR_TIKTOK,
  },
  "animate-image-ai": {
    en: EN_ANIMATE_IMAGE_AI,
    zh: ZH_ANIMATE_IMAGE_AI,
  },
  "ai-video-ad-generator": {
    en: EN_AI_VIDEO_AD,
    zh: ZH_AI_VIDEO_AD,
  },
  "ai-product-video-generator": {
    en: EN_AI_PRODUCT_VIDEO,
    zh: ZH_AI_PRODUCT_VIDEO,
  },
  "ai-cinematic-video-generator": {
    en: EN_AI_CINEMATIC_VIDEO,
    zh: ZH_AI_CINEMATIC_VIDEO,
  },
  "ai-b-roll-generator": {
    en: EN_AI_B_ROLL,
    zh: ZH_AI_B_ROLL,
  },
};

function normalizeLocale(locale: string): SeoLocale {
  return locale === "zh" ? "zh" : "en";
}

export function seoLandingFor(
  slug: SeoLandingSlug,
  locale: string,
): SeoLandingContent {
  return SEO_LANDING[slug][normalizeLocale(locale)];
}

/**
 * Where the entry point sends the visitor: the existing generator routes.
 * `ai-video-generator`, `text-to-video` and the new SEO pages share the text
 * generator, `image-to-video` points at the image entry, and
 * `reference-to-video` points at the reference tool route.
 */
export function generatorHref(
  locale: string,
  slug: SeoLandingSlug,
  prompt?: string,
): string {
  const base =
    slug === "image-to-video"
      ? `/${locale}/image-to-video`
      : slug === "reference-to-video"
        ? `/${locale}/reference-to-video`
        : `/${locale}/ai/video`;

  const trimmed = prompt?.trim();
  return trimmed ? `${base}?prompt=${encodeURIComponent(trimmed)}` : base;
}

export function faqJsonLd(content: SeoLandingContent): FaqJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function howToJsonLd(content: SeoLandingContent): HowToJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: content.stepsTitle,
    step: content.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.title,
      text: step.body,
    })),
  };
}
