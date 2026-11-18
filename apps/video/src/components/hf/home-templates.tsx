"use client";

import { ArrowUpRight } from "lucide-react";

import {
  HOME_TEMPLATE_CATEGORIES,
  templatesFor,
  type HomeTemplate,
  type HomeTemplateCategory,
} from "@/lib/home-templates";
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
        description: "点击任意卡片，提示词会填入上方的生成器，你可以修改后再生成。画面为站内示例图。",
        use: "使用这个创意",
        tabs: "创意分类",
      }
    : {
        eyebrow: "START FROM AN IDEA",
        title: "Pick an idea and start creating",
        description: "Click any card to load its prompt into the generator above, then edit it before you generate. Images are site samples.",
        use: "Use this idea",
        tabs: "Idea categories",
      };
  const items = templatesFor(category);

  return (
    <section id="home-templates" className="home-templates" aria-labelledby="home-templates-title">
      <header className="home-templates-header">
        <p className="home-templates-eyebrow">{copy.eyebrow}</p>
        <h2 id="home-templates-title" className="home-templates-title">{copy.title}</h2>
        <p className="home-templates-description">{copy.description}</p>
      </header>

      <div className="home-templates-tabs" role="tablist" aria-label={copy.tabs}>
        {HOME_TEMPLATE_CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`home-templates-tab-${item.id}`}
            aria-selected={category === item.id}
            aria-controls="home-templates-panel"
            onClick={() => onCategoryChange(item.id)}
            className={category === item.id ? "home-templates-tab home-templates-tab-active" : "home-templates-tab"}
          >
            {zh ? item.zh : item.en}
          </button>
        ))}
      </div>

      <div
        id="home-templates-panel"
        role="tabpanel"
        aria-labelledby={`home-templates-tab-${category}`}
        className="home-templates-grid"
      >
        {items.map((item) => {
          const title = zh ? item.title.zh : item.title.en;
          return (
            <button
              key={item.id}
              type="button"
              className="home-templates-card"
              onClick={() => onUse(item)}
              aria-label={`${copy.use}: ${title}`}
            >
              <img src={item.image} alt="" loading="lazy" />
              <span className="home-templates-card-body">
                <span className="home-templates-card-title">{title}</span>
                <span className="home-templates-card-prompt">{zh ? item.prompt.zh : item.prompt.en}</span>
                <span className="home-templates-card-action">
                  {copy.use}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
