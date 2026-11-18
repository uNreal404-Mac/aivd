"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Download, PenLine, SlidersHorizontal, type LucideIcon } from "lucide-react";

import { GallerySection } from "@/components/gallery/gallery-section";
import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { HomeTemplates } from "@/components/hf/home-templates";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import { localizedHref } from "@/lib/du-home";
import type { HomeTemplate, HomeTemplateCategory } from "@/lib/home-templates";
import "./du-home.css";

type HomeVideoModel = {
  id: string;
  name: string;
  durations: number[];
  aspects: string[];
};

const STEP_ICONS: LucideIcon[] = [PenLine, SlidersHorizontal, Download];

const noop = () => {};

/** Cheapest credit price a model on sale can be run at. */
function startingCredits(modelId: string): number | null {
  const model = STUDIO_MODELS.find((item) => item.id === modelId && item.available);
  if (!model) return null;
  const prices = model.durations.flatMap((duration) =>
    model.resolutions.map((resolution) => estimateCredits({ modelId, duration, resolution })),
  );
  const positive = prices.filter((value) => value > 0);
  return positive.length > 0 ? Math.min(...positive) : null;
}

export function DuHome({ lang, models }: { lang: string; models: HomeVideoModel[] }) {
  const isChinese = lang.toLowerCase().startsWith("zh");
  const [preset, setPreset] = useState<HomeGeneratorPreset | null>(null);
  const [templateCategory, setTemplateCategory] = useState<HomeTemplateCategory>("story");

  const scrollToId = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const useTemplate = (template: HomeTemplate) => {
    setPreset((previous) => ({
      prompt: isChinese ? template.prompt.zh : template.prompt.en,
      aspect: template.aspect,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    scrollToId("home-generator");
  };
  const veoFrom = startingCredits("veo-3.1");
  const wanFrom = startingCredits("wan2.6");
  const from = (credits: number | null) =>
    credits === null ? "" : isChinese ? ` ${credits} 积分起。` : ` From ${credits} credits.`;
  const features = [
    {
      href: "/veo-3-1",
      image: "/home/samples/mountain-valley.webp",
      art: "VEO 3.1",
      title: "VEO 3.1",
      body: (isChinese ? "带同步声音的 8 秒短片。" : "8-second clips with synchronized sound.") + from(veoFrom),
    },
    {
      href: "/wan-2-6",
      image: "/home/samples/storm-sea.webp",
      art: "WAN 2.6",
      title: "WAN 2.6",
      body: (isChinese ? "5 到 15 秒，720p 与 1080p。" : "5 to 15 seconds in 720p and 1080p.") + from(wanFrom),
    },
    {
      href: "/creative-space",
      image: "/home/samples/cosmic-bloom.webp",
      art: isChinese ? "创作空间" : "CREATIVE SPACE",
      title: isChinese ? "创作空间" : "CREATIVE SPACE",
      body: isChinese ? "在画布上整理素材，把想法拆成分镜和提示词。" : "Arrange assets on a canvas and turn an idea into shots and prompts.",
    },
  ];

  const copy = isChinese
    ? {
        title: "AI 视频生成器",
        tagline: "今天想创作什么？",
        subtitle: "写下想法，选一个模型，直接生成视频。",
        stepsEyebrow: "使用方法",
        stepsTitle: "三步完成一条视频",
        steps: [
          { title: "描述画面", body: "写清主体、动作、镜头运动和光线，也可以上传一张起始图。" },
          { title: "选择模型和规格", body: "不同模型在速度、细节和声音上各有侧重。生成前就能看到要消耗多少积分。" },
          { title: "生成并下载", body: "提交后在工作室查看进度，成片会保存在你的作品里。" },
        ],
        ctaTitle: `新用户注册可获得 ${NEW_USER_GIFT.credits} 积分`,
        ctaBody: "积分可用于任意在售模型。生成失败时，冻结的积分会退回。",
        ctaPrimary: "免费注册",
        ctaSecondary: "查看定价",
      }
    : {
        title: "AI Video Generator",
        tagline: "What will you create today?",
        subtitle: "Describe an idea, pick a model, and generate your video.",
        stepsEyebrow: "HOW IT WORKS",
        stepsTitle: "A video in three steps",
        steps: [
          { title: "Describe the shot", body: "Write the subject, motion, camera move and light. Add a start image if you have one." },
          { title: "Pick a model and settings", body: "Models differ in speed, detail and sound. You see the credit cost before you generate." },
          { title: "Generate and download", body: "Follow progress in the studio. Finished clips are kept in your creations." },
        ],
        ctaTitle: `New accounts get ${NEW_USER_GIFT.credits} credits`,
        ctaBody: "Credits work on any model on sale. If a generation fails, the held credits are returned.",
        ctaPrimary: "Sign up free",
        ctaSecondary: "See pricing",
      };

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      {/* 1. Hero: headline and the generator on a clean canvas */}
      <section className="du-hero">
        <div className="du-hero-glow" aria-hidden="true" />
        <div className="du-hero-inner">
          <h1 className="du-hero-eyebrow">{copy.title}</h1>
          <p className="du-hero-tagline">{copy.tagline}</p>
          <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} />
        </div>
      </section>

      {/* 2. Feature cards */}
      <section className="du-features" aria-label={isChinese ? "功能与模型" : "Features and models"}>
        {features.map((item) => (
          <Link key={item.href} href={localizedHref(lang, item.href)} className="du-feature">
            <span className="du-feature-media">
              <img src={item.image} alt="" loading="lazy" />
              <span className="du-feature-art" aria-hidden="true">{item.art}</span>
            </span>
            <span className="du-feature-body">
              <span className="du-feature-title">{item.title}</span>
              <span className="du-feature-text">{item.body}</span>
            </span>
          </Link>
        ))}
      </section>

      {/* 3. Ideas that load a prompt into the generator */}
      <HomeTemplates
        lang={lang}
        category={templateCategory}
        onCategoryChange={setTemplateCategory}
        onUse={useTemplate}
      />

      {/* 3. Community gallery: renders only when there are published works */}
      <GallerySection variant="home" />

      {/* 4. How it works */}
      <section className="du-steps" aria-labelledby="du-steps-title">
        <p className="du-section-eyebrow">{copy.stepsEyebrow}</p>
        <h2 id="du-steps-title" className="du-section-title">{copy.stepsTitle}</h2>
        <ol className="du-steps-grid">
          {copy.steps.map((step, index) => {
            const StepIcon = STEP_ICONS[index] ?? PenLine;
            return (
              <li key={step.title} className="du-glass du-step">
                <span className="du-step-index" aria-hidden="true">
                  <StepIcon className="h-4 w-4" />
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="du-step-title">{step.title}</h3>
                <p className="du-step-body">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* 5. Closing call to action */}
      <section className="du-cta">
        <div className="du-cta-inner">
          <div>
            <h2 className="du-cta-title">{copy.ctaTitle}</h2>
            <p className="du-cta-body">{copy.ctaBody}</p>
          </div>
          <div className="du-cta-actions">
            <Link
              href={localizedHref(lang, "/register")}
              className="inline-flex h-12 items-center gap-2 rounded-xl bg-[var(--du-accent)] px-6 text-sm font-semibold text-[var(--du-on-accent)] transition-colors hover:bg-[var(--du-accent-hover)]"
            >
              {copy.ctaPrimary}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href={localizedHref(lang, "/pricing")}
              className="du-glass-btn inline-flex h-12 items-center px-6 text-sm"
            >
              {copy.ctaSecondary}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
