"use client";

import { useState } from "react";

import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { HomePricing } from "@/components/hf/home-pricing";
import { BackToCreate, HomeShowcase } from "@/components/hf/home-showcase";
import type { HomeTemplate } from "@/lib/home-templates";
import { scrollMotion } from "@/lib/reduced-motion";
import "./du-home.css";
import { homeSeo } from "@/lib/home-seo";

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
          <h1 className="du-hero-title">{homeSeo(isChinese ? "zh" : "en").h1}</h1>
          <p className="du-hero-sub">
            {isChinese
              ? "写下你的想法，添加视频、图片等参考，选择模型一键生成"
              : "Write down your idea, add video, images, and other references, then choose a model to generate in one click."}
          </p>
          <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} />
        </div>
      </section>

      {/* 2. Everything below the generator follows the reference homepage */}
      <HomeShowcase lang={lang} onUseTemplate={useTemplate} />
      {/* 3. Pricing, after the reference sites' pricing pages */}
      <HomePricing lang={lang} />
      <BackToCreate lang={lang} anchorId="home-generator" />
    </div>
  );
}
