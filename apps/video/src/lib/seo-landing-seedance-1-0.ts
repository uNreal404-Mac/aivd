/**
 * Copy for the /seedance-1-0 model page.
 *
 * Only the two enabled Seedance 1.0 Pro models are described. Seedance 1.5 Pro
 * is mentioned once, in a single FAQ answer, as the option for audio, start and
 * end frames and reference images.
 */

import type { SeoLandingContent } from "./seo-landing";

export const EN_SEEDANCE_1_0: SeoLandingContent = {
  path: "/seedance-1-0",
  title: "Seedance 1.0 Pro — Fast and Quality AI Video Models",
  description:
    "Seedance 1.0 Pro comes in Fast and Quality variants for text to video and image to video. Compare them and open the generator to start creating.",
  h1: "Seedance 1.0 Pro",
  heroSub:
    "Two Seedance 1.0 models for text and image prompts: one built for speed, one built for detail.",
  promptPlaceholder: "Describe the video you want to create…",
  ctaLabel: "Open the generator",
  whatTitle: "What is Seedance 1.0 Pro?",
  whatBody: [
    "Seedance 1.0 Pro is a pair of video models. Seedance 1.0 Pro Fast is tuned for quick drafts at a lower cost per second, and Seedance 1.0 Pro Quality is tuned for the most detailed Seedance 1.0 output.",
    "Both accept a written prompt or a single starting image, so you can sketch an idea in text and then animate a still frame once you have one you like.",
    "Both models generate clips of 2, 4, 5, 6, 8, 10 or 12 seconds, in 16:9, 9:16, 1:1, 4:3, 3:4 or 21:9, at 480P, 720P or 1080P.",
  ],
  stepsTitle: "How it works",
  steps: [
    {
      title: "Write a prompt or choose an image",
      body: "Describe the scene in a sentence or two, or start from a single still frame you already have.",
    },
    {
      title: "Pick Fast or Quality",
      body: "Stay on Seedance 1.0 Pro Fast while you explore directions, then switch to Seedance 1.0 Pro Quality for the take worth refining.",
    },
    {
      title: "Generate and compare",
      body: "Open the generator, run the same prompt on both models and keep the version that fits.",
    },
  ],
  compareTitle: "Seedance 1.0 Pro models",
  compareRows: [
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "Quicker drafts at a lower cost per second",
      input: "Text, image",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "The most detailed Seedance 1.0 output",
      input: "Text, image",
    },
  ],
  faqTitle: "Frequently asked questions",
  faq: [
    {
      q: "What is the difference between Seedance 1.0 Pro Fast and Quality?",
      a: "Both take text and image inputs and offer the same durations, aspect ratios and resolutions. Fast targets quicker drafts at a lower cost per second, while Quality targets the most detailed Seedance 1.0 output.",
    },
    {
      q: "Which inputs do the Seedance 1.0 Pro models accept?",
      a: "Text to video and image to video. You can write a prompt, or supply a single starting image and describe how the scene should move.",
    },
    {
      q: "Can I use start and end frames or reference images?",
      a: "Not on Seedance 1.0 Pro. Start and end frames, reference images and audio generation are handled by Seedance 1.5 Pro instead.",
    },
    {
      q: "Do these models generate audio?",
      a: "No. Seedance 1.0 Pro outputs silent clips. The audio page linked below covers the model that supports sound.",
    },
    {
      q: "How do I choose between Fast and Quality?",
      a: "Test wording and framing on Fast, then run the prompt you like best on Quality for the final take.",
    },
  ],
  related: [
    {
      label: "Need audio or frame control? See the model that supports sound",
      path: "/ai-video-generator-with-audio",
    },
    {
      label: "Control the first and last frame with Frames to Video",
      path: "/frames-to-video",
    },
    {
      label: "Start from a written script with Text to Video",
      path: "/text-to-video",
    },
    {
      label: "Start from a still picture with Image to Video",
      path: "/image-to-video",
    },
  ],
};

export const ZH_SEEDANCE_1_0: SeoLandingContent = {
  path: "/seedance-1-0",
  title: "Seedance 1.0 Pro — 快速版与高质量版 AI 视频模型",
  description:
    "Seedance 1.0 Pro 包含快速版与高质量版，支持文字和图片生成视频。对比两种版本，然后打开生成器开始创作。",
  h1: "Seedance 1.0 Pro 视频模型",
  heroSub: "两个 Seedance 1.0 模型：一个面向速度，一个面向细节。",
  promptPlaceholder: "描述你想生成的视频…",
  ctaLabel: "打开生成器",
  whatTitle: "什么是 Seedance 1.0 Pro？",
  whatBody: [
    "Seedance 1.0 Pro 是一组视频模型。Seedance 1.0 Pro Fast 面向快速草稿，每秒成本更低；Seedance 1.0 Pro Quality 面向 Seedance 1.0 中最丰富的细节。",
    "两者都支持文字提示或一张起始图片：可以先用文字快速试想法，再挑一张满意的静态画面让它动起来。",
    "两款模型都可生成 2、4、5、6、8、10 或 12 秒的片段，支持 16:9、9:16、1:1、4:3、3:4、21:9 画面比例，以及 480P、720P、1080P 分辨率。",
  ],
  stepsTitle: "它是怎样工作的",
  steps: [
    {
      title: "写下提示词或选择图片",
      body: "用一两句话描述场景，或者直接用一张已有的静态画面作为起点。",
    },
    {
      title: "在 Fast 和 Quality 之间选择",
      body: "探索方向时用 Seedance 1.0 Pro Fast，确定要精修时再切换到 Seedance 1.0 Pro Quality。",
    },
    {
      title: "生成并对比",
      body: "打开生成器，用同一段提示词分别运行两个模型，保留更合适的那一版。",
    },
  ],
  compareTitle: "Seedance 1.0 Pro 模型",
  compareRows: [
    {
      model: "Seedance 1.0 Pro Fast",
      bestFor: "适合快速出草稿，每秒成本更低",
      input: "文字、图片",
    },
    {
      model: "Seedance 1.0 Pro Quality",
      bestFor: "Seedance 1.0 中细节最丰富的输出",
      input: "文字、图片",
    },
  ],
  faqTitle: "常见问题",
  faq: [
    {
      q: "Seedance 1.0 Pro Fast 和 Quality 有什么区别？",
      a: "两者的输入方式、时长、画面比例和分辨率相同。Fast 面向更快的草稿，每秒成本更低；Quality 追求 Seedance 1.0 中最丰富的细节。",
    },
    {
      q: "Seedance 1.0 Pro 支持哪些输入？",
      a: "文字生成视频和图片生成视频。你可以只写提示词，也可以提供一张起始图片并描述画面如何运动。",
    },
    {
      q: "可以用首尾帧或参考图吗？",
      a: "Seedance 1.0 Pro 不支持。首尾帧、参考图以及音频生成都由 Seedance 1.5 Pro 负责。",
    },
    {
      q: "这些模型会生成音频吗？",
      a: "不会。Seedance 1.0 Pro 输出的是无声片段，需要声音可以查看下方链接的音频页面。",
    },
    {
      q: "如何在 Fast 和 Quality 之间选择？",
      a: "先用 Fast 测试措辞和构图，确定满意的提示词后再用 Quality 生成最终版本。",
    },
  ],
  related: [
    {
      label: "需要音频或首尾帧控制？查看支持音频的模型",
      path: "/ai-video-generator-with-audio",
    },
    {
      label: "用「首尾帧生成视频」控制起止画面",
      path: "/frames-to-video",
    },
    {
      label: "从脚本出发，使用「文字生成视频」",
      path: "/text-to-video",
    },
    {
      label: "从一张图片出发，使用「图片生成视频」",
      path: "/image-to-video",
    },
  ],
};
