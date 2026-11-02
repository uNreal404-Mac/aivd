/**
 * Marketing copy for /[locale]/seedance-2-0-mini.
 * Studio links only. This module does not enable generation or quote a price.
 */

export const SEEDANCE_2_MINI_PATH = "/seedance-2-0-mini";

export interface Seedance2MiniCta {
  label: string;
  href: string;
}

export interface Seedance2MiniCopy {
  locale: "en" | "zh";
  title: string;
  description: string;
  keywords: string[];
  eyebrow: string;
  h1: string;
  lede: string;
  whatHeading: string;
  whatBody: string;
  differHeading: string;
  differences: { title: string; body: string }[];
  sunsetHeading: string;
  sunsetBody: string;
  studioHeading: string;
  studioBody: string;
  ctas: Seedance2MiniCta[];
  previousHref: string;
  previousLabel: string;
}

const KEYWORDS = [
  "Seedance 2.0 mini",
  "Seedance",
  "AI video generator",
  "AI image generator",
  "AI music generator",
  "aivd.ai",
];

const EN: Seedance2MiniCopy = {
  locale: "en",
  title: "Seedance 2.0 mini AI Video Generator",
  description:
    "Seedance 2.0 mini is the next AI video generator on aivd.ai. See how it differs from Seedance 1.5 Pro, which sunsets around November 11, 2026.",
  keywords: KEYWORDS,
  eyebrow: "aivd.ai · Seedance",
  h1: "Seedance 2.0 mini",
  lede: "Universe-level motion, aimed at the next Seedance model. Video, image, and music direction from one studio — without turning preview generation on.",
  whatHeading: "What it is",
  whatBody:
    "Seedance 2.0 mini is the Seedance model aivd.ai is moving toward next. It is the compact sibling meant for everyday universe-level clips: a prompt, a still, or a short direction for video, image, and music. This page introduces it. It does not start a generation or spend credits.",
  differHeading: "How it differs from Seedance 1.5 Pro",
  differences: [
    {
      title: "Role",
      body: "Seedance 1.5 Pro is the professional model the studio already knows. Seedance 2.0 mini is the lighter model the product is pointing at next.",
    },
    {
      title: "Timing",
      body: "1.5 Pro sunsets around November 11, 2026. New storytelling on aivd.ai should start from Seedance and Seedance 2.0 mini.",
    },
    {
      title: "Credits",
      body: "Retail credits for 2.0 mini are not published. A draft mapping exists for review only, and checkout is unchanged.",
    },
  ],
  sunsetHeading: "Seedance 1.5 Pro is sunsetting",
  sunsetBody:
    "Seedance 1.5 Pro sunsets around November 11, 2026. The current 1.5 pages stay available so you can see what is leaving. They are no longer the front door.",
  studioHeading: "Open the studio",
  studioBody:
    "Look through text to video, image to video, and the studio. Preview generation stays gated, so opening a tool does not run a paid model or use credits.",
  ctas: [
    { label: "Open the studio", href: "/ai/video" },
    { label: "Text to video", href: "/text-to-video" },
    { label: "Image to video", href: "/image-to-video" },
  ],
  previousHref: "/seedance-1-5",
  previousLabel: "Read the Seedance 1.5 sunset note",
};

const ZH: Seedance2MiniCopy = {
  locale: "zh",
  title: "Seedance 2.0 mini AI 视频生成器",
  description:
    "Seedance 2.0 mini 是 aivd.ai 的下一代 AI 视频生成器。了解它与即将于 2026 年 11 月 11 日前后停用的 Seedance 1.5 Pro 有何不同。",
  keywords: KEYWORDS,
  eyebrow: "aivd.ai · Seedance",
  h1: "Seedance 2.0 mini",
  lede: "面向下一代 Seedance 的宇宙级动态。视频、图像与音乐方向集中在同一工作室，预览站不会因此打开真实生成。",
  whatHeading: "它是什么",
  whatBody:
    "Seedance 2.0 mini 是 aivd.ai 接下来要走向的 Seedance 模型。它更轻，用来完成日常的宇宙级片段：一句提示、一张静图，或一段关于视频、图像与音乐的短方向。本页只做介绍，不会发起生成，也不会消耗积分。",
  differHeading: "它和 Seedance 1.5 Pro 有何不同",
  differences: [
    {
      title: "角色",
      body: "Seedance 1.5 Pro 是工作室已经熟悉的专业模型。Seedance 2.0 mini 是产品下一步指向的更轻模型。",
    },
    {
      title: "时间",
      body: "1.5 Pro 约于 2026 年 11 月 11 日停用。aivd.ai 上的新故事应从 Seedance 与 Seedance 2.0 mini 开始。",
    },
    {
      title: "积分",
      body: "2.0 mini 的零售积分尚未公布。代码里只有一份供审阅的草稿映射，结账方式没有改动。",
    },
  ],
  sunsetHeading: "Seedance 1.5 Pro 即将停用",
  sunsetBody:
    "Seedance 1.5 Pro 约于 2026 年 11 月 11 日停用。现有的 1.5 页面会保留，方便查看即将离开的能力，但它们不再是首页入口。",
  studioHeading: "进入工作室",
  studioBody:
    "可以先看看文生视频、图生视频和工作室。预览站的生成仍然关闭，打开工具不会调用付费模型，也不会扣积分。",
  ctas: [
    { label: "打开工作室", href: "/ai/video" },
    { label: "文生视频", href: "/text-to-video" },
    { label: "图生视频", href: "/image-to-video" },
  ],
  previousHref: "/seedance-1-5",
  previousLabel: "查看 Seedance 1.5 停用说明",
};

export function getSeedance2MiniCopy(locale: string): Seedance2MiniCopy {
  return locale === "zh" ? ZH : EN;
}

export function localizedStudioHref(locale: string, href: string): string {
  return `/${locale}${href}`;
}
