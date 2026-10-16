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
}

export const MODEL_SEO: ModelSeoEntry[] = [
  {
    slug: "seedance-1-5-pro",
    modelId: "seedance-1.5-pro",
    name: "Seedance 1.5 Pro",
    title: "Seedance 1.5 Pro AI Video Generator | DreamUtopia",
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
  },
  {
    slug: "wan-2-6",
    modelId: "wan2.6",
    name: "Wan 2.6",
    title: "Wan 2.6 AI Video Generator | DreamUtopia",
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
  },
  {
    slug: "veo-3-1",
    modelId: "veo-3.1",
    name: "Veo 3.1",
    title: "Veo 3.1 AI Video Generator | DreamUtopia",
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
  },
  {
    slug: "sora-2",
    modelId: "sora-2",
    name: "Sora 2",
    title: "Sora 2 AI Video Generator | DreamUtopia",
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
  mainEntity: Array<{
    "@type": "Question";
    name: string;
    acceptedAnswer: {
      "@type": "Answer";
      text: string;
    };
  }>;
}

/** Build a schema.org FAQPage object for the page's structured data. */
export function buildFaqJsonLd(entry: ModelSeoEntry): FaqJsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entry.faqs.map((faq) => ({
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
