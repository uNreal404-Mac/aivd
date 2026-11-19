"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ArrowUp, AtSign, Coins, Film, ImagePlus, ListChecks, MessageSquareText, Sparkles, Wand2, type LucideIcon } from "lucide-react";

import { estimateCredits } from "@/lib/ai-video-studio";
import { MiniComposer } from "@/components/hf/home-showcase";
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

export function CreativeSpaceHome({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [brief, setBrief] = useState("");

  const canvasHref = (text?: string) =>
    localizedHref(lang, text ? `${CANVAS_PATH}?prompt=${encodeURIComponent(text)}` : CANVAS_PATH);

  const applyBrief = (text: string) => {
    setBrief(text);
    window.scrollTo({ top: 0, behavior: scrollMotion() });
    inputRef.current?.focus({ preventScroll: true });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = brief.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    router.push(canvasHref(text));
  };

  const quickSkills = CREATIVE_SKILL_CATEGORIES.flatMap((item) => skillsFor(item.id).slice(0, 2));

  return (
    <div className="cs-page">
      <div className="cs-glow" aria-hidden="true" />

      <section className="cs-hero">
        <h1 className="cs-title">{zh ? "说出你的想法，Agent 帮你拆成镜头再生成视频" : "Describe the idea. The agent plans the shots, then makes the video."}</h1>
        <p className="cs-sub">
          {zh
            ? "写一句目标，或上传图片和视频作参考。Agent 先给出分镜和提示词，你确认后再用 Veo 3.1 生成。"
            : "Write a goal, or add images and video as references. The agent drafts the shots and prompt first, and Veo 3.1 generates once you approve."}
        </p>

        <form id="cs-composer-anchor" className="cs-composer" onSubmit={submit}>
          <textarea
            ref={inputRef}
            value={brief}
            onChange={(event) => setBrief(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit(event);
            }}
            rows={3}
            maxLength={2000}
            placeholder={zh ? "例如：用我上传的产品图做一条 8 秒的发布短片，影棚灯光，镜头推近到细节……" : "e.g. Make an 8-second launch clip from my product photo: studio light, push in to the details…"}
            aria-label={zh ? "创作目标" : "Creative goal"}
            className="cs-input"
          />
          <div className="cs-composer-bar">
            <Link href={canvasHref(brief.trim() || undefined)} className="cs-chip-btn" title={zh ? "在画布里上传参考素材" : "Upload references on the canvas"}>
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              {zh ? "添加素材" : "Add assets"}
            </Link>
            <span className="cs-meta">
              <Film className="h-3.5 w-3.5" aria-hidden="true" />
              Veo 3.1 · 8s · {zh ? "有声" : "with sound"}
            </span>
            <span className="cs-meta">
              <ListChecks className="h-3.5 w-3.5" aria-hidden="true" />
              {zh ? "先出计划，确认后生成" : "Plan first, generate on approval"}
            </span>
            <span className="cs-cost" title={zh ? "生成一条视频消耗的积分，出计划不扣积分" : "Credits per video; planning is free"}>
              <Coins className="h-3.5 w-3.5" aria-hidden="true" />
              {VEO_CREDITS}
            </span>
            <button type="submit" className="cs-send" disabled={!brief.trim()} aria-label={zh ? "开始创作" : "Start"}>
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>

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
          <div className="hs-carousel-track">
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
            <img src="/home/samples/studio-room.webp" alt="" className="hs-banner-card hs-banner-card-a" loading="lazy" />
            <img src="/home/samples/red-carpet.webp" alt="" className="hs-banner-card hs-banner-card-b" loading="lazy" />
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
              <button key={template.id} type="button" className="hs-tall" onClick={() => applyBrief(zh ? template.prompt.zh : template.prompt.en)}>
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
