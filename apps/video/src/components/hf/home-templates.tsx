"use client";

import { ArrowUpRight } from "lucide-react";

import {
  HOME_TEMPLATE_CATEGORIES,
  templatesFor,
  type HomeTemplate,
  type HomeTemplateCategory,
} from "@/lib/home-templates";
import { scrollMotion } from "@/lib/reduced-motion";
import "./home-templates.css";

export function HomeTemplates({
  lang,
  category,
  onCategoryChange,
  onUse,
}: {
  lang: string;
  category: HomeTemplateCategory;
  onCategoryChange: (category: HomeTemplateCategory) => void;
  onUse: (template: HomeTemplate) => void;
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const copy = zh
    ? {
        eyebrow: "从一个想法开始",
        title: "选一个创意，直接开始",
        description: "点击卡片，提示词会填入上方的输入框。画面为站内示例图。",
        use: "使用这个创意",
        tabs: "创意分类",
      }
    : {
        eyebrow: "START FROM AN IDEA",
        title: "Pick an idea and start creating",
        description: "Click a card to load its prompt into the box above. Images are site samples.",
        use: "Use this idea",
        tabs: "Idea categories",
      };
  // Two-tone heading: the last word (or last two characters) takes the accent.
  const splitHeading = (heading: string) => {
    const at = zh ? Math.max(0, heading.length - 2) : heading.lastIndexOf(" ") + 1;
    return [heading.slice(0, at), heading.slice(at)];
  };
  const jumpTo = (id: HomeTemplateCategory) => {
    onCategoryChange(id);
    document
      .getElementById(`home-templates-${id}`)
      ?.scrollIntoView({ behavior: scrollMotion(), block: "start" });
  };

  return (
    <section id="home-templates" className="home-templates" aria-label={copy.tabs}>
      <nav className="home-templates-tabs" aria-label={copy.tabs}>
        {HOME_TEMPLATE_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={category === item.id ? "true" : undefined}
            onClick={() => jumpTo(item.id)}
            className={category === item.id ? "home-templates-tab home-templates-tab-active" : "home-templates-tab"}
          >
            {zh ? item.zh : item.en}
          </button>
        ))}
      </nav>
      <p className="home-templates-description">{copy.description}</p>

      {HOME_TEMPLATE_CATEGORIES.map((group) => {
        const [lead, accent] = splitHeading(zh ? group.zh : group.en);
        return (
          <div key={group.id} id={`home-templates-${group.id}`} className="home-templates-group">
            <h2 className="home-templates-title">
              {lead}
              <span>{accent}</span>
            </h2>
            <div className="home-templates-grid">
              {templatesFor(group.id).map((item) => {
                const title = zh ? item.title.zh : item.title.en;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className="home-templates-card"
                    onClick={() => onUse(item)}
                    aria-label={`${copy.use}: ${title}`}
                    title={zh ? item.prompt.zh : item.prompt.en}
                  >
                    <span className="home-templates-cover">
                      <img src={item.image} alt="" loading="lazy" />
                      <span className="home-templates-use">
                        {copy.use}
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </span>
                    </span>
                    <span className="home-templates-meta">
                      <span className="home-templates-card-title">{title}</span>
                      <span className="home-templates-author">@aivd</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
