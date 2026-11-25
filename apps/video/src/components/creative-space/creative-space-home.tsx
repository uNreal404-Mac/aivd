"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AtSign, Bot, Film, Image as ImageIcon, ImagePlus, ListChecks, MessageSquareText, Sparkles, Wand2, type LucideIcon } from "lucide-react";

import { estimateCredits } from "@/lib/ai-video-studio";
import { CarouselArrows, MiniComposer } from "@/components/hf/home-showcase";
import { useCarousel } from "@/components/hf/use-carousel";
import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { CreativeAgentComposer } from "./creative-agent-composer";
import { CREATIVE_SKILL_CATEGORIES, skillsFor, type CreativeSkillCategory } from "@/lib/creative-skills";
import { localizedHref } from "@/lib/du-home";
import { HOME_TEMPLATES } from "@/lib/home-templates";
import { scrollMotion } from "@/lib/reduced-motion";
import "@/components/hf/home-showcase.css";
import "@/components/hf/home-pricing.css";
import "./creative-space-home.css";
import { SlideCover } from "@/components/hf/slide-cover";
import { ScrollReveal } from "@/components/scroll-reveal";

const CANVAS_PATH = "/creative-space/canvas";
const VEO_CREDITS = estimateCredits({ modelId: "veo-3.1", duration: 8, resolution: "720p" });

type Model = { id: string; name: string; durations: number[]; aspects: string[] };
type CreativeMode = "video" | "image" | "agent";

export function CreativeSpaceHome({ lang, models }: { lang: string; models: Model[] }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const categoryTrackRef = useRef<HTMLDivElement>(null);
  const categoryCarousel = useCarousel(categoryTrackRef);
  const [brief, setBrief] = useState("");
  const [mode, setMode] = useState<CreativeMode>("video");
  const [preset, setPreset] = useState<HomeGeneratorPreset | null>(null);
  const [draftReady, setDraftReady] = useState(false);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("aivd:creative-mode");
      if (savedMode === "video" || savedMode === "image" || savedMode === "agent") setMode(savedMode);
      setBrief((localStorage.getItem("aivd:creative-agent-brief") ?? "").slice(0, 2000));
    } catch { /* Storage can be unavailable in private browsing. */ }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    try {
      localStorage.setItem("aivd:creative-mode", mode);
      localStorage.setItem("aivd:creative-agent-brief", brief);
    } catch { /* The composer still works without local storage. */ }
  }, [brief, draftReady, mode]);

  const canvasHref = (text?: string) =>
    localizedHref(lang, text ? `${CANVAS_PATH}?prompt=${encodeURIComponent(text)}` : CANVAS_PATH);

  const applyBrief = (text: string, target: CreativeMode = "agent") => {
    setMode(target);
    if (target === "agent") setBrief(text);
    else setPreset((previous) => ({ prompt: text, nonce: (previous?.nonce ?? 0) + 1 }));
    window.scrollTo({ top: 0, behavior: scrollMotion() });
    if (target === "agent") requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const quickSkills = CREATIVE_SKILL_CATEGORIES.flatMap((item) => skillsFor(item.id).slice(0, 2));

  return (
    <div className="cs-page">
      <div className="cs-glow" aria-hidden="true" />

      <section className="cs-hero">
        <h1 className="cs-title">{zh ? "一个创作空间，生成视频、图片和创意计划" : "One creative space for video, images, and ideas"}</h1>
        <p className="cs-sub">
          {zh
            ? "选择视频、图片或 Agent，或直接进入无限画布进行局部重绘、扩图、消除、抠图、超清与多模态连线创作。"
            : "Choose Video, Image, or Agent — or open the Infinite Canvas for Inpaint, Outpaint, Cutout, Upscale, and multimodal workflows."}
        </p>
        <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
          <Link href={canvasHref()} className="hs-btn hs-btn-light">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {zh ? "打开无限画布（生图 · 编辑 · 生视频 · Agent）" : "Open Infinite Canvas (Image · Edit · Video · Agent)"}
          </Link>
        </div>

        <div id="cs-composer-anchor" className="cs-generator-shell">
          <nav className="cs-mode-rail" aria-label={zh ? "创作类型" : "Creation type"}>
            {([ ["video", Film, zh ? "视频" : "Video"], ["image", ImageIcon, zh ? "图片" : "Image"], ["agent", Bot, "Agent"] ] as const).map(([item, Icon, label]) => (
              <button key={item} type="button" className={`cs-mode-button${mode === item ? " cs-mode-button-active" : ""}`} aria-pressed={mode === item} onClick={() => { setPreset(null); setMode(item); }}>
                <Icon className="h-5 w-5" aria-hidden="true" />{label}
              </button>
            ))}
          </nav>
          <div className="cs-generator-main">
            {mode !== "agent" ? <HomeGenerator
              key={mode}
              lang={lang}
              models={models}
              onModelChange={() => {}}
              preset={mode === "video" ? preset : null}
              initialKind={mode}
              initialPrompt={mode === "video" ? preset?.prompt : undefined}
              hideKindTabs
              draftStorageKey={`aivd:creative-${mode}-draft`}
              showSuggestions={false}
            /> : null}
            <CreativeAgentComposer lang={lang} active={mode === "agent"} brief={brief} onBriefChange={setBrief} inputRef={inputRef} />
          </div>
        </div>

        <div className="cs-quick" aria-label={zh ? "常用技能" : "Popular skills"}>
          {quickSkills.map((item) => (
            <button key={item.id} type="button" className="cs-quick-chip" onClick={() => applyBrief(zh ? item.brief.zh : item.brief.en)}>
              {zh ? item.title.zh : item.title.en}
            </button>
          ))}
        </div>
      </section>

      {/* Below the composer the page uses the homepage and pricing styles. */}
      <div className="hs">
        <ScrollReveal />
        {/* 1. Category carousel */}
        <section className="hs-carousel" aria-label={zh ? "技能分类" : "Skill categories"}>
          <div ref={categoryTrackRef} className="hs-carousel-track">
            {CREATIVE_SKILL_CATEGORIES.map((item) => {
              const first = skillsFor(item.id)[0];
              return (
                <a key={item.id} href={`#cs-cat-${item.id}`} className="hs-slide">
                  <span className="hs-slide-media">
                    <img src={first?.image} alt="" loading="lazy" />
                    <SlideCover
                      main={zh ? item.zh : item.en}
                      sub={zh ? `${skillsFor(item.id).length} 个技能` : `${skillsFor(item.id).length} skills`}
                    />
                  </span>
                  <span className="hs-slide-title">{zh ? item.zh : item.en}</span>
                  <span className="hs-slide-body">
                    {zh ? `${skillsFor(item.id).length} 个技能 · ` : `${skillsFor(item.id).length} skills · `}
                    {zh ? first?.description.zh : first?.description.en}
                  </span>
                </a>
              );
            })}
          </div>
          <CarouselArrows zh={zh} {...categoryCarousel} />
        </section>

        {/* 2. How the agent works: offer card and feature tiles */}
        <section className="hs-offer-grid" aria-label={zh ? "Agent 能做什么" : "What the agent does"}>
          <Link href={canvasHref()} className="hs-offer">
            <span className="hs-offer-glow" aria-hidden="true" />
            <span className="hs-offer-kicker">{zh ? "先看计划，再花积分" : "Plan first, pay later"}</span>
            <span className="hs-offer-title">{zh ? "出计划免费" : "Planning is free"}</span>
            <span className="hs-offer-body">
              {zh ? `确认后用 Veo 3.1 生成，${VEO_CREDITS} 积分一条` : `Veo 3.1 renders on approval, ${VEO_CREDITS} credits a clip`}
            </span>
            <span className="hs-offer-cta">{zh ? "打开画布" : "Open the canvas"}</span>
          </Link>
          <div className="hs-tiles">
            {AGENT_TILES.map((tile) => {
              const Icon = tile.icon;
              return (
                <Link key={tile.en} href={canvasHref()} className="hs-tile" data-tilt>
                  <Icon className="hs-tile-icon" aria-hidden="true" />
                  <span className="hs-tile-title">
                    {zh ? tile.zh : tile.en}
                    {tile.isNew ? <span className="hs-badge">{zh ? "新" : "New"}</span> : null}
                  </span>
                  <span className="hs-tile-body">{zh ? tile.bodyZh : tile.bodyEn}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 3. One section per skill category */}
        {CREATIVE_SKILL_CATEGORIES.map((item) => (
          <section key={item.id} id={`cs-cat-${item.id}`} className="hs-section cs-anchor" aria-labelledby={`cs-cat-title-${item.id}`}>
            <div className="hs-head">
              <div>
                <h2 id={`cs-cat-title-${item.id}`} className="hs-title">{zh ? item.zh : item.en}</h2>
                <p className="hs-sub">{zh ? CATEGORY_LINES[item.id].zh : CATEGORY_LINES[item.id].en}</p>
              </div>
            </div>
            <div className="hs-usecase-grid">
              {skillsFor(item.id).map((skill) => (
                <button key={skill.id} type="button" className="hs-usecase cs-skill" onClick={() => applyBrief(zh ? skill.brief.zh : skill.brief.en)}>
                  <img src={skill.image} alt="" loading="lazy" />
                  <span className="hs-usecase-shade" aria-hidden="true" />
                  <span className="cs-skill-hover" aria-hidden="true">
                    <span>{zh ? skill.description.zh : skill.description.en}</span>
                    <span className="cs-skill-use">{zh ? "运用技能" : "Use skill"}</span>
                  </span>
                  <span className="hs-usecase-title">{zh ? skill.title.zh : skill.title.en}</span>
                  <span className="hs-usecase-tags">
                    <span className="hs-chip">{zh ? item.zh : item.en}</span>
                    <span className="hs-chip">{zh ? "Agent 分镜" : "Agent plan"}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* 4. Canvas banner */}
        <section className="hs-banner hs-banner-canvas" aria-labelledby="cs-canvas-title">
          <div className="hs-banner-text">
            <span className="hs-banner-kicker">{zh ? "画布" : "CANVAS"}</span>
            <h2 id="cs-canvas-title" className="hs-banner-title">
              {zh ? <>一块画布。<br />所有素材。</> : <>One canvas.<br />Every asset.</>}
            </h2>
            <p className="hs-banner-body">
              {zh ? "把产品图、人像、参考视频拖进来，用 @ 点名交给 Agent" : "Drop product shots, portraits and reference video in, then @-mention them to the agent"}
            </p>
            <Link href={canvasHref()} className="hs-btn hs-btn-light">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {zh ? "打开画布" : "Open the canvas"}
            </Link>
          </div>
          <div className="hs-banner-art" aria-hidden="true">
            <img src="/canvas/templates/ecom.webp" alt="" className="hs-banner-card hs-banner-card-a" loading="lazy" />
            <img src="/canvas/templates/character.webp" alt="" className="hs-banner-card hs-banner-card-b" loading="lazy" />
            <span className="hs-banner-bubble">{zh ? "@产品图 做一条 8 秒发布短片" : "@product make an 8s launch clip"}</span>
          </div>
        </section>

        {/* 5. Steps as gradient cards, like the pricing plans */}
        <section className="hs-section" aria-labelledby="cs-steps-title">
          <div className="hs-head">
            <div>
              <h2 id="cs-steps-title" className="hs-title">{zh ? "三步把想法变成视频" : "IDEA TO VIDEO IN THREE STEPS"}</h2>
              <p className="hs-sub">{zh ? "从一句话到一条成片，全程不用自己琢磨提示词。" : "From one line to a finished clip without writing prompts yourself."}</p>
            </div>
          </div>
          <div className="hp-plans">
            {STEPS.map((step, index) => (
              <article key={step.en} className={`hp-plan hp-plan-${(["basic", "pro", "ultimate"] as const)[index]}`}>
                <div className="hp-plan-top cs-step-card" data-tilt>
                  <span className="cs-step-n">{index + 1}</span>
                  <p className="hp-plan-name">{zh ? step.zh : step.en}</p>
                  <p className="hp-plan-blurb">{zh ? step.bodyZh : step.bodyEn}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 6. Templates row */}
        <section className="hs-section" aria-labelledby="cs-templates-title">
          <div className="hs-head">
            <div>
              <h2 id="cs-templates-title" className="hs-title">{zh ? "从视频模板开始" : "START FROM A TEMPLATE"}</h2>
              <p className="hs-sub">{zh ? "点一下，模板的描述就填进上方输入框。" : "One click puts the template's brief in the box above."}</p>
            </div>
            <Link href={localizedHref(lang, "/templates")} className="hs-btn hs-btn-dark">
              {zh ? "查看全部模板" : "All templates"}
            </Link>
          </div>
          <div className="hs-tall-row">
            {HOME_TEMPLATES.slice(0, 5).map((template) => (
              <button key={template.id} type="button" className="hs-tall" onClick={() => applyBrief(zh ? template.prompt.zh : template.prompt.en, "video")}>
                <img src={template.image} alt="" loading="lazy" />
                <span className="hs-usecase-shade" aria-hidden="true" />
                <span className="hs-tall-title">{zh ? template.title.zh : template.title.en}</span>
                <span className="hs-tall-use">{zh ? "使用模板" : "Use template"}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <MiniComposer lang={lang} anchorId="cs-composer-anchor" targetPath={CANVAS_PATH} />
    </div>
  );
}

const AGENT_TILES: { zh: string; en: string; bodyZh: string; bodyEn: string; icon: LucideIcon; isNew?: boolean }[] = [
  { zh: "上传素材", en: "Upload assets", bodyZh: "图片和视频拖进画布", bodyEn: "Drag images and video onto the canvas", icon: ImagePlus },
  { zh: "@ 点名素材", en: "@-mention assets", bodyZh: "告诉 Agent 用哪些素材", bodyEn: "Tell the agent which assets to use", icon: AtSign },
  { zh: "自动分镜", en: "Shot plan", bodyZh: "一句话拆成镜头步骤", bodyEn: "One line becomes shot steps", icon: ListChecks, isNew: true },
  { zh: "改一句重来", en: "Revise in a line", bodyZh: "不满意就补充一句再规划", bodyEn: "Add a note and plan again", icon: MessageSquareText },
  { zh: "一键生成", en: "Generate", bodyZh: "确认后用 Veo 3.1 出片", bodyEn: "Veo 3.1 renders once you approve", icon: Wand2 },
  { zh: "我的作品", en: "My creations", bodyZh: "成片自动保存，随时下载", bodyEn: "Clips are saved for download", icon: Film },
];

const CATEGORY_LINES: Record<CreativeSkillCategory, { zh: string; en: string }> = {
  story: { zh: "童话、爱情、冒险和科幻，适合有情节的短片", en: "Fairy tales, romance, adventure and sci-fi with a plot" },
  ads: { zh: "产品发布、时尚、旅行和餐饮，适合品牌和电商", en: "Launches, fashion, travel and food for brands and shops" },
  social: { zh: "竖屏、人像和城市夜景，适合短视频平台", en: "Vertical, portraits and city nights for short-video apps" },
  cinematic: { zh: "黄金时刻、暗调悬疑和史诗自然，一键电影感", en: "Golden hour, dark mystery and epic nature in one click" },
};

const STEPS = [
  { zh: "说出目标", en: "Say the goal", bodyZh: "写一句想要的效果，或选一个技能；有素材就拖进画布。", bodyEn: "Write what you want or pick a skill, and drag in any assets." },
  { zh: "确认计划", en: "Approve the plan", bodyZh: "Agent 给出分镜和最终提示词，出计划不扣积分。", bodyEn: "The agent returns shots and a final prompt; planning is free." },
  { zh: "生成下载", en: "Generate", bodyZh: `用 Veo 3.1 生成有声视频，完成后在我的作品里下载。`, bodyEn: "Veo 3.1 renders a clip with sound; download it from My creations." },
];
