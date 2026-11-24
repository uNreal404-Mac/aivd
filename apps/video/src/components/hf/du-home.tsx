"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { HomePricing } from "@/components/hf/home-pricing";
import { BackToCreate, HomeShowcase } from "@/components/hf/home-showcase";
import { localizedHref } from "@/lib/du-home";
import { HOME_TEMPLATES, type HomeTemplate } from "@/lib/home-templates";
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

  // One calm, Jimeng-style external row of slash skills right below the composer.
  const slashSkills: { label: string; templateIndex?: number; href?: string }[] = [
    { label: isChinese ? "创意视频复刻" : "Viral Remake", templateIndex: 0 },
    { label: isChinese ? "电影雨夜大片" : "Neon Rain Film", templateIndex: 2 },
    { label: isChinese ? "秋日叙事跟拍" : "Autumn Follow", templateIndex: 1 },
    { label: isChinese ? "星云视觉特效" : "Cosmic VFX", templateIndex: 4 },
    { label: isChinese ? "高定慢动作棚拍" : "Couture Slow-Mo", templateIndex: 7 },
    { label: isChinese ? "导演分镜 Agent" : "Director Agent", href: "/creative-space" },
    { label: isChinese ? "无限画布" : "Infinite Canvas", href: "/creative-space/canvas" },
  ];

  // A template card or skill pill loads its prompt into the generator and scrolls smoothly up.
  const applyTemplate = (template: HomeTemplate) => {
    setPreset((previous) => ({
      prompt: isChinese ? template.prompt.zh : template.prompt.en,
      aspect: template.aspect,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    document.getElementById("home-generator")?.scrollIntoView({ behavior: scrollMotion(), block: "start" });
  };

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      {/* 1. Calm, Wide Jimeng 6.2:1 × Pollo Velvety Matte Hero Stage */}
      <section className="du-hero">
        <div className="du-hero-glow" aria-hidden="true" />
        <div className="du-hero-inner">
          <h1 className="du-hero-title">{homeSeo(isChinese ? "zh" : "en").h1}</h1>
          <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} showSuggestions={false} />
          <nav className="du-hero-skills" aria-label={isChinese ? "快捷创作技能" : "Quick creative skills"}>
            {slashSkills.map((skill) =>
              skill.href ? (
                <Link key={skill.label} href={href(skill.href)} className="du-hero-skill-pill">
                  <span className="du-hero-skill-slash" aria-hidden="true">/</span>
                  <span>{skill.label}</span>
                </Link>
              ) : (
                <button
                  key={skill.label}
                  type="button"
                  className="du-hero-skill-pill"
                  onClick={() => {
                    const tpl = HOME_TEMPLATES[skill.templateIndex ?? 0];
                    if (tpl) applyTemplate(tpl);
                  }}
                >
                  <span className="du-hero-skill-slash" aria-hidden="true">/</span>
                  <span>{skill.label}</span>
                </button>
              ),
            )}
            <Link href={href("/templates")} className="du-hero-skill-pill du-hero-skill-more">
              <span>{isChinese ? "更多灵感" : "More skills"}</span>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </section>

      {/* 2. Frameless, Unified Gallery-First Showcase */}
      <HomeShowcase lang={lang} onUseTemplate={applyTemplate} />
      {/* 3. Pricing */}
      <HomePricing lang={lang} />
      <BackToCreate lang={lang} anchorId="home-generator" />
    </div>
  );
}
