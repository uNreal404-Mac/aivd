"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Bot, Plus, Send, ShieldCheck, Sparkles } from "lucide-react";

import { localizedHref } from "@/lib/du-home";
import "./home-showcase-sections.css";

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
    open: "与 AGENT 对话",
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
    open: "Chat with AGENT",
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

// The Story / Motion / Recast panels moved into HomeTemplates, where each
// sample is a clickable idea that loads a prompt into the generator.
export function HomeShowcaseSections({ lang }: { lang: string }) {
  return (
    <div className="home-showcases mx-auto max-w-[1680px] px-4 sm:px-6">
      <CreativeSpacePreview lang={lang} />
    </div>
  );
}
