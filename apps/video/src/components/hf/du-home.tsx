"use client";

import { useState } from "react";

import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { HomeShowcase, MiniComposer } from "@/components/hf/home-showcase";
import type { HomeTemplate } from "@/lib/home-templates";
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
    document.getElementById("home-generator")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      {/* 1. Hero: headline and the generator on a clean canvas */}
      <section className="du-hero">
        <div className="du-hero-glow" aria-hidden="true" />
        <div className="du-hero-inner">
          <h1 className="du-hero-eyebrow">{isChinese ? "AI 视频生成器" : "AI Video Generator"}</h1>
          <p className="du-hero-tagline">{isChinese ? "今天想创作什么？" : "What will you create today?"}</p>
          <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} />
        </div>
      </section>

      {/* 2. Everything below the generator follows the reference homepage */}
      <HomeShowcase lang={lang} onUseTemplate={useTemplate} />
      <MiniComposer lang={lang} anchorId="home-generator" />
    </div>
  );
}
