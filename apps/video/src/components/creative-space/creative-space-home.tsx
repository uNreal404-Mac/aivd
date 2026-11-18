"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUp, Coins, Film, ImagePlus, ListChecks, MessageSquareText, Wand2 } from "lucide-react";

import { estimateCredits } from "@/lib/ai-video-studio";
import {
  CREATIVE_SKILL_CATEGORIES,
  skillsFor,
  type CreativeSkill,
  type CreativeSkillCategory,
} from "@/lib/creative-skills";
import { localizedHref } from "@/lib/du-home";
import { HOME_TEMPLATES } from "@/lib/home-templates";
import "./creative-space-home.css";

const CANVAS_PATH = "/creative-space/canvas";
const VEO_CREDITS = estimateCredits({ modelId: "veo-3.1", duration: 8, resolution: "720p" });

type Library = "skills" | "templates";

export function CreativeSpaceHome({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [brief, setBrief] = useState("");
  const [library, setLibrary] = useState<Library>("skills");
  const [category, setCategory] = useState<CreativeSkillCategory>("story");

  const canvasHref = (text?: string) =>
    localizedHref(lang, text ? `${CANVAS_PATH}?prompt=${encodeURIComponent(text)}` : CANVAS_PATH);

  const applyBrief = (text: string) => {
    setBrief(text);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
  const activeCategory = CREATIVE_SKILL_CATEGORIES.find((item) => item.id === category);

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

        <form className="cs-composer" onSubmit={submit}>
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

      <section className="cs-library" aria-label={zh ? "技能和模板" : "Skills and templates"}>
        <div className="cs-switch" role="tablist">
          <button type="button" role="tab" aria-selected={library === "skills"} className={library === "skills" ? "cs-switch-on" : ""} onClick={() => setLibrary("skills")}>
            {zh ? "技能" : "Skills"}
          </button>
          <button type="button" role="tab" aria-selected={library === "templates"} className={library === "templates" ? "cs-switch-on" : ""} onClick={() => setLibrary("templates")}>
            {zh ? "模板" : "Templates"}
          </button>
        </div>

        {library === "skills" ? (
          <>
            <div className="cs-cats" role="tablist">
              {CREATIVE_SKILL_CATEGORIES.map((item) => (
                <button key={item.id} type="button" role="tab" aria-selected={category === item.id} className={category === item.id ? "cs-cat cs-cat-on" : "cs-cat"} onClick={() => setCategory(item.id)}>
                  {zh ? item.zh : item.en}
                </button>
              ))}
            </div>
            <h2 className="cs-h2">{activeCategory ? (zh ? activeCategory.zh : activeCategory.en) : null}</h2>
            <div className="cs-grid">
              {skillsFor(category).map((item) => (
                <SkillCard key={item.id} zh={zh} skill={item} onUse={applyBrief} />
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="cs-h2">{zh ? "从模板开始" : "Start from a template"}</h2>
            <div className="cs-grid">
              {HOME_TEMPLATES.map((item) => (
                <button key={item.id} type="button" className="cs-card" onClick={() => applyBrief(zh ? item.prompt.zh : item.prompt.en)}>
                  <img src={item.image} alt="" loading="lazy" className="cs-card-img" />
                  <span className="cs-card-shade" aria-hidden="true" />
                  <span className="cs-card-title">{zh ? item.title.zh : item.title.en}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="cs-why" aria-labelledby="cs-why-title">
        <h2 id="cs-why-title" className="cs-h2 cs-center">{zh ? "为什么用创作空间做视频" : "Why make videos in Creative Space"}</h2>
        <Feature
          image="/home/samples/studio-room.webp"
          title={zh ? "把零散素材变成一条完整的视频" : "Turn loose assets into one finished clip"}
          body={zh
            ? "把产品图、人像、参考视频拖到画布上，用 @ 点名要用的素材。Agent 会读懂这些素材，再把你的目标写成可直接生成的提示词。"
            : "Drop product shots, portraits and reference video on the canvas and @-mention the ones to use. The agent reads them and turns your goal into a prompt ready to generate."}
          cta={zh ? "打开画布" : "Open the canvas"}
          href={canvasHref()}
        />
        <Feature
          reverse
          image="/home/samples/mountain-valley.webp"
          title={zh ? "先看计划，再花积分" : "See the plan before you spend credits"}
          body={zh
            ? "Agent 先给出分镜步骤和最终提示词，出计划不扣积分。你满意了再点生成，不满意就改一句话重新规划。"
            : "The agent lays out the shot steps and final prompt first, and planning costs nothing. Generate when you are happy, or change a line and plan again."}
          cta={zh ? "试一个技能" : "Try a skill"}
          href="#"
          onClick={() => applyBrief(zh ? quickSkills[0].brief.zh : quickSkills[0].brief.en)}
        />
        <Feature
          image="/home/samples/cosmic-bloom.webp"
          title={zh ? "从技能出发，不用自己琢磨提示词" : "Start from a skill instead of a blank prompt"}
          body={zh
            ? "故事、广告、社交短视频、电影风格，每个技能都带好了一段写好的目标。点一下填进输入框，改几个词就能用。"
            : "Story, ads, social clips and cinematic looks each come with a written brief. One click puts it in the box; change a few words and go."}
          cta={zh ? "浏览技能" : "Browse skills"}
          href="#"
          onClick={() => {
            setLibrary("skills");
            document.querySelector(".cs-library")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </section>

      <section className="cs-steps" aria-labelledby="cs-steps-title">
        <h2 id="cs-steps-title" className="cs-h2 cs-center">{zh ? "三步把想法变成视频" : "Idea to video in three steps"}</h2>
        <ol className="cs-steps-grid">
          <Step icon={MessageSquareText} n={1} title={zh ? "说出目标，加上素材" : "Say the goal, add assets"} body={zh ? "写一句想要的效果，或选一个技能；需要的话把图片和视频拖到画布上。" : "Write what you want or pick a skill, and drag images or video onto the canvas if you have them."} />
          <Step icon={ListChecks} n={2} title={zh ? "确认 Agent 的计划" : "Approve the agent's plan"} body={zh ? "Agent 给出分镜步骤和最终提示词。不满意就补充一句，再规划一次。" : "The agent returns shot steps and a final prompt. Add a note and plan again if it is not right."} />
          <Step icon={Wand2} n={3} title={zh ? "生成并下载" : "Generate and download"} body={zh ? `确认后用 Veo 3.1 生成 8 秒有声视频，消耗 ${VEO_CREDITS} 积分，完成后在“我的作品”里查看。` : `Veo 3.1 renders an 8-second clip with sound for ${VEO_CREDITS} credits; find it in My creations.`} />
        </ol>
        <div className="cs-center">
          <Link href={canvasHref()} className="cs-cta">
            {zh ? "免费开始创作" : "Start creating free"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}

function SkillCard({ zh, skill, onUse }: { zh: boolean; skill: CreativeSkill; onUse: (brief: string) => void }) {
  return (
    <button type="button" className="cs-card" onClick={() => onUse(zh ? skill.brief.zh : skill.brief.en)}>
      <img src={skill.image} alt="" loading="lazy" className="cs-card-img" />
      <span className="cs-card-shade" aria-hidden="true" />
      <span className="cs-card-hover" aria-hidden="true">
        <span className="cs-card-desc">{zh ? skill.description.zh : skill.description.en}</span>
        <span className="cs-card-use">{zh ? "运用技能" : "Use skill"}</span>
      </span>
      <span className="cs-card-title">{zh ? skill.title.zh : skill.title.en}</span>
    </button>
  );
}

function Feature({
  image,
  title,
  body,
  cta,
  href,
  onClick,
  reverse,
}: {
  image: string;
  title: string;
  body: string;
  cta: string;
  href: string;
  onClick?: () => void;
  reverse?: boolean;
}) {
  return (
    <div className={reverse ? "cs-feature cs-feature-reverse" : "cs-feature"}>
      <img src={image} alt="" loading="lazy" className="cs-feature-img" />
      <div className="cs-feature-text">
        <h3 className="cs-h3">{title}</h3>
        <p className="cs-body">{body}</p>
        {onClick ? (
          <button type="button" className="cs-outline" onClick={onClick}>
            {cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <Link href={href} className="cs-outline">
            {cta}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

function Step({ icon: Icon, n, title, body }: { icon: typeof Film; n: number; title: string; body: string }) {
  return (
    <li className="cs-step">
      <span className="cs-step-icon" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <span className="cs-step-n">{n}</span>
      <h3 className="cs-h3">{title}</h3>
      <p className="cs-body">{body}</p>
    </li>
  );
}
