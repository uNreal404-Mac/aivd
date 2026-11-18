"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bot, Plus, Send, ShieldCheck, Sparkles } from "lucide-react";

import { localizedHref } from "@/lib/du-home";
import "./home-showcase-sections.css";

type ShowcaseKind = "story" | "motion" | "recast";

type ShowcaseCopy = {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  gallery: string;
};

type ShowcaseSample = { image: string; zh: string; en: string };

const sample = (name: string, zh: string, en: string): ShowcaseSample => ({
  image: `/home/samples/${name}.webp`,
  zh,
  en,
});

const SHOWCASE_SAMPLES: Record<ShowcaseKind, ShowcaseSample[]> = {
  story: [
    sample("boy-and-dog", "雨夜街角", "Rainy Street Corner"),
    sample("autumn-walk", "秋日同行", "Autumn Walk"),
    sample("rain-couple", "雨中重逢", "Reunion in the Rain"),
    sample("mountain-wind", "山顶的风", "Wind on the Summit"),
  ],
  motion: [
    sample("cosmic-bloom", "星云绽放", "Cosmic Bloom"),
    sample("mountain-valley", "云海山谷", "Valley of Clouds"),
    sample("storm-sea", "风暴之海", "Storm Sea"),
  ],
  recast: [
    sample("planet-impact", "星球撞击", "Planet Impact"),
    sample("tomb-light", "古墓之光", "Light in the Tomb"),
    sample("mech-warrior", "机甲战士", "Mech Warrior"),
    sample("dreaming", "梦境", "Dreaming"),
  ],
};

function ShowcaseFrames({ kind, isChinese }: { kind: ShowcaseKind; isChinese: boolean }) {
  return (
    <div className={`home-showcase-grid home-showcase-grid-${kind}`}>
      {SHOWCASE_SAMPLES[kind].map((item) => {
        const caption = isChinese ? item.zh : item.en;
        return (
          <figure key={item.image} className="home-showcase-card">
            <img src={item.image} alt={caption} loading="lazy" />
            <figcaption>{caption}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function ShowcasePanel({
  id,
  kind,
  copy,
  lang,
}: {
  id: string;
  kind: ShowcaseKind;
  copy: ShowcaseCopy;
  lang: string;
}) {
  return (
    <section className="home-showcase-section" aria-labelledby={id}>
      <div className="home-showcase-frame">
        <div className="home-showcase-inner">
          <header className="home-showcase-header">
            <div>
              <p className="home-showcase-eyebrow">{copy.eyebrow}</p>
              <h2 id={id} className="home-showcase-title">{copy.title}</h2>
              <p className="home-showcase-description">{copy.description}</p>
            </div>
            <Link className="home-showcase-primary" href={localizedHref(lang, "/ai/video")}>
              {copy.cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </header>

          <ShowcaseFrames kind={kind} isChinese={lang.toLowerCase().startsWith("zh")} />

          <div className="home-showcase-footer">
            <Link className="home-showcase-secondary" href={localizedHref(lang, "/gallery")}>
              {copy.gallery}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

const CREATIVE_TABS = ["idea", "storyboard", "assets"] as const;
type CreativeTab = (typeof CREATIVE_TABS)[number];

const CREATIVE_COPY = {
  zh: {
    eyebrow: "创作空间",
    title: "说出想法，和 Agent 一起创作。",
    description: "在画布中整理素材，用对话描述你的构想，再将分镜和提示词带入创作流程。",
    preview: "界面预览",
    agent: "创作 Agent",
    agentSubtitle: "理解 @素材，生成分镜和可执行提示词",
    safety: "素材安全检查",
    safetyBody: "通过检查的素材才能用于 Agent 规划。",
    plan: "Agent 分镜计划",
    composer: "描述你的想法，或用 @ 引用素材…",
    send: "发送给 Agent",
    open: "进入创作空间",
    tabs: { idea: "描述想法", storyboard: "规划分镜", assets: "组合素材" },
    examples: {
      idea: { prompt: "我想做一支有电影氛围的短片。", reply: "先确定场景、情绪和镜头运动，再选择适合的模型。" },
      storyboard: { prompt: "把这个想法拆成几个连贯镜头。", reply: "可以从开场、主体和收尾三个镜头开始规划。" },
      assets: { prompt: "用 @素材 作为画面参考。", reply: "把素材放进画布后，就能在对话中引用并安排它们。" },
    },
  },
  en: {
    eyebrow: "CREATIVE SPACE",
    title: "Describe an idea. Create with an Agent.",
    description: "Arrange assets on the canvas, talk through your concept, and carry a storyboard and prompts into production.",
    preview: "Interface preview",
    agent: "Creative Agent",
    agentSubtitle: "Turn @assets into a storyboard and usable prompts",
    safety: "Asset safety check",
    safetyBody: "Approved assets can be used in Agent planning.",
    plan: "Agent storyboard",
    composer: "Describe your idea or reference @assets…",
    send: "Send to Agent",
    open: "Open Creative Space",
    tabs: { idea: "Describe an idea", storyboard: "Plan shots", assets: "Combine assets" },
    examples: {
      idea: { prompt: "I want to make a short film with a cinematic mood.", reply: "Let's define the scene, mood and camera movement, then choose a suitable model." },
      storyboard: { prompt: "Break this idea into connected shots.", reply: "We can start with an opening, a main shot and a closing shot." },
      assets: { prompt: "Use @assets as visual references.", reply: "Add assets to the canvas, then mention and arrange them in the conversation." },
    },
  },
} as const;

function CreativeSpacePreview({ lang }: { lang: string }) {
  const isChinese = lang.toLowerCase().startsWith("zh");
  const copy = isChinese ? CREATIVE_COPY.zh : CREATIVE_COPY.en;
  const [activeTab, setActiveTab] = useState<CreativeTab>("idea");
  const example = copy.examples[activeTab];

  return (
    <section className="home-creative-section" aria-labelledby="home-creative-title">
      <div className="home-creative-heading">
        <p className="home-showcase-eyebrow">{copy.eyebrow}</p>
        <h2 id="home-creative-title" className="home-creative-title">{copy.title}</h2>
        <p className="home-creative-description">{copy.description}</p>
      </div>

      <div className="home-creative-tabs" role="tablist" aria-label={copy.eyebrow}>
        {CREATIVE_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls="home-creative-preview"
            id={`home-creative-tab-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? "home-creative-tab home-creative-tab-active" : "home-creative-tab"}
          >
            {copy.tabs[tab]}
          </button>
        ))}
      </div>

      <div className="home-showcase-frame home-creative-frame" id="home-creative-preview" role="tabpanel" aria-labelledby={`home-creative-tab-${activeTab}`}>
        <div className="home-creative-layout">
          <div className="home-creative-chat">
            <div className="home-creative-chat-header">
              <span className="home-creative-agent-icon"><Sparkles className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <p className="home-creative-agent-title">{copy.agent}</p>
                <p className="home-creative-agent-subtitle">{copy.agentSubtitle}</p>
              </div>
              <span className="home-creative-preview-label">{copy.preview}</span>
            </div>

            <div className="home-creative-conversation">
              <div className="home-creative-user-message">{example.prompt}</div>
              <div className="home-creative-safety">
                <p><ShieldCheck className="h-4 w-4" aria-hidden="true" />{copy.safety}</p>
                <span>{copy.safetyBody}</span>
              </div>
              <div className="home-creative-agent-message">
                <div className="home-creative-message-label"><Bot className="h-4 w-4" aria-hidden="true" />{copy.plan}</div>
                <p>{example.reply}</p>
              </div>
            </div>

            <div className="home-creative-composer" aria-hidden="true">
              <p>{copy.composer}</p>
              <div>
                <span className="home-creative-plus"><Plus className="h-4 w-4" /></span>
                <span className="home-creative-send"><Send className="h-3.5 w-3.5" />{copy.send}</span>
              </div>
            </div>
          </div>

          <div className="home-creative-video-area" aria-hidden="true">
            <div className="home-creative-video-frame">
              <img src="/home/samples/dancer.webp" alt="" loading="lazy" />
            </div>
          </div>
        </div>
      </div>

      <Link className="home-creative-open" href={localizedHref(lang, "/creative-space")}>
        {copy.open}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}

export function HomeShowcaseSections({ lang }: { lang: string }) {
  const isChinese = lang.toLowerCase().startsWith("zh");
  const panels: { id: string; kind: ShowcaseKind; copy: ShowcaseCopy }[] = isChinese
    ? [
        { id: "home-story-title", kind: "story", copy: { eyebrow: "视频创作 · 01", title: "故事视频", description: "从一个想法出发，为故事安排画面与节奏。", cta: "进入视频工作台", gallery: "浏览画廊" } },
        { id: "home-motion-title", kind: "motion", copy: { eyebrow: "视频创作 · 02", title: "动态创作", description: "用镜头运动和视觉节奏，探索画面的更多可能。", cta: "进入视频工作台", gallery: "浏览画廊" } },
        { id: "home-recast-title", kind: "recast", copy: { eyebrow: "视频创作 · 03", title: "创意重构", description: "以现有构想为起点，尝试新的叙事和视觉表达。", cta: "进入视频工作台", gallery: "浏览画廊" } },
      ]
    : [
        { id: "home-story-title", kind: "story", copy: { eyebrow: "VIDEO CREATION · 01", title: "STORY VIDEO", description: "Start with an idea and give the story its shots and rhythm.", cta: "Open Video Studio", gallery: "Browse Gallery" } },
        { id: "home-motion-title", kind: "motion", copy: { eyebrow: "VIDEO CREATION · 02", title: "MOTION", description: "Explore what movement and visual rhythm can bring to a frame.", cta: "Open Video Studio", gallery: "Browse Gallery" } },
        { id: "home-recast-title", kind: "recast", copy: { eyebrow: "VIDEO CREATION · 03", title: "RECAST", description: "Take an existing concept toward a new story and visual direction.", cta: "Open Video Studio", gallery: "Browse Gallery" } },
      ];

  return (
    <div className="home-showcases mx-auto max-w-[1680px] px-4 sm:px-6">
      {panels.map((panel) => (
        <ShowcasePanel key={panel.id} {...panel} lang={lang} />
      ))}
      <CreativeSpacePreview lang={lang} />
    </div>
  );
}
