"use client";

import Link from "next/link";
import { useState } from "react";
import { AudioLines, Clapperboard, Film, Layers, Orbit, Sparkles, Wand2 } from "lucide-react";

import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { HomePricing } from "@/components/hf/home-pricing";
import { BackToCreate, HomeShowcase } from "@/components/hf/home-showcase";
import { localizedHref } from "@/lib/du-home";
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
  const href = (path: string) => localizedHref(lang, path);

  const quickTools = [
    { label: isChinese ? "故事短片" : "Story Video", href: "/ai/video?model=bytedance%2Fseedance-2-5", icon: Film },
    { label: isChinese ? "AI 特效库" : "AI Effects", href: "/effects", icon: Wand2 },
    { label: isChinese ? "参考图控图" : "Reference Video", href: "/ai/video?model=kling%2Fv4-reference-to-video", icon: Orbit },
    { label: isChinese ? "无限画布" : "Infinite Canvas", href: "/creative-space/canvas", icon: Layers },
    { label: isChinese ? "导演 Agent" : "Director Agent", href: "/creative-space", icon: Clapperboard },
    { label: isChinese ? "AI 配音与音乐" : "Audio & Music", href: "/audio", icon: AudioLines },
  ];

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
      {/* 1. Pollo × Higgsfield Jewel-Box Hero Stage with Luminous Cyan Studio Aura */}
      <section className="du-hero">
        <div className="du-hero-glow" aria-hidden="true" />
        <div className="du-hero-grid-bg" aria-hidden="true" />
        <div className="du-hero-inner">
          <h1 className="du-hero-title">{homeSeo(isChinese ? "zh" : "en").h1}</h1>
          <p className="du-hero-sub">
            {isChinese
              ? "聚合 Seedance 2.5 · Veo 3.1 · Kling 4.0 · Nano Banana Pro，写下想法或 @引用素材一键成片"
              : "Seedance 2.5 · Veo 3.1 · Kling 4.0 · Nano Banana Pro — describe a scene or @mention assets to create in one click."}
          </p>
          <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} />
          <nav className="du-hero-dock" aria-label={isChinese ? "快捷创作工具" : "Quick creative tools"}>
            {quickTools.map((tool) => {
              const Icon = tool.icon;
              return (
                <Link key={tool.href} href={href(tool.href)} className="du-hero-dock-pill">
                  <Icon className="du-hero-dock-icon" aria-hidden="true" />
                  <span>{tool.label}</span>
                </Link>
              );
            })}
            <Link href={href("/templates")} className="du-hero-dock-pill du-hero-dock-pill-accent">
              <Sparkles className="du-hero-dock-icon" aria-hidden="true" />
              <span>{isChinese ? "全部模板 ↗" : "Templates ↗"}</span>
            </Link>
          </nav>
          <div className="du-hero-trust" aria-label={isChinese ? "平台透明保障" : "Platform highlights"}>
            <span><span className="du-hero-trust-dot" />{isChinese ? "注册即送 75 免费积分" : "75 free credits on sign-up"}</span>
            <span>{isChinese ? "透明按次计费 · 0 隐藏加价" : "Transparent per-run pricing · 0 hidden markup"}</span>
            <span>{isChinese ? "生成失败自动退还积分" : "Auto-refund on failed runs"}</span>
          </div>
        </div>
      </section>

      {/* 2. Higgsfield × Pollo Flagship Visual Showcase */}
      <HomeShowcase lang={lang} onUseTemplate={useTemplate} />
      {/* 3. Pricing */}
      <HomePricing lang={lang} />
      <BackToCreate lang={lang} anchorId="home-generator" />
    </div>
  );
}
