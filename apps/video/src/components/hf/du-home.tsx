"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Download, PenLine, SlidersHorizontal, type LucideIcon } from "lucide-react";

import { GallerySection } from "@/components/gallery/gallery-section";
import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { HomeTemplates } from "@/components/hf/home-templates";
import { NEW_USER_GIFT } from "@/config/pricing-user";
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
  const browseIdeas = (category: HomeTemplateCategory) => {
    setTemplateCategory(category);
    scrollToId("home-templates");
  };

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
          <h1 className="du-hero-title">{copy.title}</h1>
          <p className="du-hero-tagline">{copy.tagline}</p>
          <p className="du-hero-subtitle">{copy.subtitle}</p>
          <HomeGenerator
            lang={lang}
            models={models}
            onModelChange={noop}
            preset={preset}
            onBrowseIdeas={browseIdeas}
          />
        </div>
      </section>

      {/* 2. Ideas that load a prompt into the generator */}
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
