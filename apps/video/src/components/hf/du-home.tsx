"use client";

import { useState } from "react";

import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { HomePricing } from "@/components/hf/home-pricing";
import { HomeShowcase, MiniComposer } from "@/components/hf/home-showcase";
import type { HomeTemplate } from "@/lib/home-templates";
import { scrollMotion } from "@/lib/reduced-motion";
import "./du-home.css";

type HomeVideoModel = {
  id: string;
  name: string;
  durations: number[];
  aspects: string[];
};

const noop = () => {};

export function DuHome({ lang, models }: { lang: string; models: HomeVideoModel[] }) {
  const isChinese = lang.toLowerCase().startsWith("zh");
  const [preset, setPreset] = useState<HomeGeneratorPreset | null>(null);

  // A template card loads its prompt into the generator and scrolls back up.
  const useTemplate = (template: HomeTemplate) => {
    setPreset((previous) => ({
      prompt: isChinese ? template.prompt.zh : template.prompt.en,
      aspect: template.aspect,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    document.getElementById("home-generator")?.scrollIntoView({ behavior: scrollMotion(), block: "start" });
  };

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      {/* 1. Hero: headline and the generator on a clean canvas */}
      <section className="du-hero">
        <div className="du-hero-glow" aria-hidden="true" />
        <div className="du-hero-inner">
          <h1 className="du-hero-title">{isChinese ? "AI 视频生成器 从创意开始创作" : "AI Video Generator — Create from Your Idea"}</h1>
          <p className="du-hero-sub">
            {isChinese
              ? "写下你的视频想法，探索脚本、视觉、配音、字幕与音乐的创作方向，选择模型开始生成"
              : "Describe your video idea, explore directions for the script, visuals, voiceover, subtitles, and music, then choose a model to start generating."}
          </p>
          <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} />
        </div>
      </section>

      {/* 2. Everything below the generator follows the reference homepage */}
      <HomeShowcase lang={lang} onUseTemplate={useTemplate} />
      {/* 3. Pricing, after the reference sites' pricing pages */}
      <HomePricing lang={lang} />
      <MiniComposer lang={lang} anchorId="home-generator" />
    </div>
  );
}
