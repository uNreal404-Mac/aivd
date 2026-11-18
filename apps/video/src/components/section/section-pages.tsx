"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Image as ImageIcon, Search, Sparkles } from "lucide-react";

import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import { localizedHref } from "@/lib/du-home";
import {
  HOME_TEMPLATE_CATEGORIES,
  HOME_TEMPLATES,
  templatesFor,
  type HomeTemplate,
} from "@/lib/home-templates";
import { IMAGE_CATALOG, VIDEO_CATALOG, type CatalogModel } from "@/lib/kie-model-catalog";
import "./section-pages.css";

type ComposerModel = { id: string; name: string; durations: number[]; aspects: string[] };
const noop = () => {};

function isZh(lang: string) {
  return lang.toLowerCase().startsWith("zh");
}

function startingCredits(modelId: string): number | null {
  const model = STUDIO_MODELS.find((item) => item.id === modelId && item.available);
  if (!model) return null;
  const prices = model.durations
    .flatMap((duration) => model.resolutions.map((resolution) => estimateCredits({ modelId, duration, resolution })))
    .filter((value) => value > 0);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** "一键打造爆款内容" promo card followed by a scrolling row of template cards. */
function TemplateRow({ lang, onUse }: { lang: string; onUse: (template: HomeTemplate) => void }) {
  const zh = isZh(lang);
  const scroll = (direction: number) =>
    document.getElementById("section-template-row")?.scrollBy({ left: direction * 640, behavior: "smooth" });
  return (
    <section className="sp-row" aria-label={zh ? "模板" : "Templates"}>
      <Link href={localizedHref(lang, "/templates")} className="sp-promo">
        <span className="sp-promo-title">
          {zh ? "一键打造" : "Make it "}
          <span>{zh ? "爆款" : "viral"}</span>
          {zh ? "内容" : " in one click"}
        </span>
        <span className="sp-promo-cta">{zh ? "试试模板" : "Try templates"}</span>
      </Link>
      <div className="sp-row-track">
        <div id="section-template-row" className="sp-row-scroll">
          {HOME_TEMPLATES.map((item) => (
            <button key={item.id} type="button" className="sp-row-card" onClick={() => onUse(item)} title={zh ? item.prompt.zh : item.prompt.en}>
              <img src={item.image} alt="" loading="lazy" />
              <span>{zh ? item.title.zh : item.title.en}</span>
            </button>
          ))}
        </div>
        <button type="button" className="sp-row-arrow sp-row-arrow-left" onClick={() => scroll(-1)} aria-label={zh ? "向左" : "Scroll left"}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" className="sp-row-arrow sp-row-arrow-right" onClick={() => scroll(1)} aria-label={zh ? "向右" : "Scroll right"}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

function ModelCardBody({ zh, kind, item, live, credits }: { zh: boolean; kind: "video" | "image"; item: CatalogModel; live: boolean; credits: number | null }) {
  return (
    <>
      <span className="sp-model-icon" aria-hidden="true">
        {kind === "video" ? <Sparkles className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="sp-model-name">
          {item.name}
          {live && credits !== null ? <span className="sp-badge sp-badge-live">{zh ? `${credits} 积分起` : `From ${credits} credits`}</span> : null}
          {!live ? <span className="sp-badge">{zh ? "即将上线" : "Soon"}</span> : null}
          {item.badge === "New" ? <span className="sp-badge sp-badge-new">{zh ? "最新" : "New"}</span> : null}
        </span>
        <span className="sp-model-detail">{item.detail}</span>
      </span>
    </>
  );
}

/** Two-column model list: models that can generate first, then coming soon. */
function ModelGrid({ lang, kind, connectedIds }: { lang: string; kind: "video" | "image"; connectedIds: string[] }) {
  const zh = isZh(lang);
  const catalog: CatalogModel[] = kind === "video" ? VIDEO_CATALOG : IMAGE_CATALOG;
  const ordered = [...catalog].sort((a, b) => Number(connectedIds.includes(b.id)) - Number(connectedIds.includes(a.id)));
  const pageFor: Record<string, string> = { "veo-3.1": "/veo-3-1", "wan2.6": "/wan-2-6" };
  return (
    <section className="sp-models" aria-labelledby={`sp-models-${kind}`}>
      <h2 id={`sp-models-${kind}`} className="sp-h2">{zh ? "模型" : "Models"}</h2>
      <div className="sp-models-grid">
        {ordered.map((item) => {
          const live = connectedIds.includes(item.id);
          const credits = kind === "video" ? startingCredits(item.id) : null;
          const body = <ModelCardBody key={item.id} zh={zh} kind={kind} item={item} live={live} credits={credits} />;
          return live && pageFor[item.id] ? (
            <Link key={item.id} href={localizedHref(lang, pageFor[item.id])} className="sp-model sp-model-live">
              {body}
            </Link>
          ) : (
            <div key={item.id} className={live ? "sp-model sp-model-live" : "sp-model"} aria-disabled={!live}>
              {body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function useComposerPreset(lang: string) {
  const [preset, setPreset] = useState<HomeGeneratorPreset | null>(null);
  const useTemplate = (template: HomeTemplate) => {
    setPreset((previous) => ({
      prompt: isZh(lang) ? template.prompt.zh : template.prompt.en,
      aspect: template.aspect,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    document.getElementById("home-generator")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  return { preset, useTemplate };
}

export function VideoSectionPage({ lang, models, initialPrompt }: { lang: string; models: ComposerModel[]; initialPrompt: string }) {
  const zh = isZh(lang);
  const { preset, useTemplate } = useComposerPreset(lang);
  const showcases = [
    { title: "VEO 3.1", body: zh ? "8 秒短片，带同步声音与空间层次。" : "8-second clips with synchronized sound and depth.", href: "/veo-3-1", images: ["mountain-valley", "storm-sea", "planet-impact"] },
    { title: "WAN 2.6", body: zh ? "5 到 15 秒，720p 与 1080p，成本更低。" : "5 to 15 seconds in 720p and 1080p at a lower cost.", href: "/wan-2-6", images: ["autumn-walk", "rain-couple", "mountain-wind"] },
  ];
  return (
    <div className="sp-page">
      <div className="sp-glow" aria-hidden="true" />
      <section className="sp-hero">
        <h1 className="sp-title">{zh ? "用 AI 将任何视频创意变为现实" : "Turn any video idea into reality with AI"}</h1>
        <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} initialKind="video" initialPrompt={initialPrompt} hideKindTabs />
      </section>
      <TemplateRow lang={lang} onUse={useTemplate} />
      {showcases.map((item) => (
        <section key={item.title} className="sp-showcase">
          <div className="sp-showcase-head">
            <div>
              <h2 className="sp-showcase-title">{item.title}</h2>
              <p className="sp-showcase-body">{item.body}</p>
            </div>
            <Link href={localizedHref(lang, item.href)} className="sp-cta">
              {zh ? "开始创作" : "Start creating"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="sp-showcase-grid">
            {item.images.map((image) => (
              <img key={image} src={`/home/samples/${image}.webp`} alt="" loading="lazy" />
            ))}
          </div>
        </section>
      ))}
      <ModelGrid lang={lang} kind="video" connectedIds={models.map((model) => model.id)} />
    </div>
  );
}

export function ImageSectionPage({ lang, models, initialPrompt }: { lang: string; models: ComposerModel[]; initialPrompt: string }) {
  const zh = isZh(lang);
  const { preset, useTemplate } = useComposerPreset(lang);
  return (
    <div className="sp-page">
      <div className="sp-glow" aria-hidden="true" />
      <section className="sp-hero">
        <h1 className="sp-title">{zh ? "打造你梦寐以求的每一个画面" : "Create every image you have imagined"}</h1>
        <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} initialKind="image" initialPrompt={initialPrompt} hideKindTabs />
      </section>
      <TemplateRow lang={lang} onUse={useTemplate} />
      <ModelGrid lang={lang} kind="image" connectedIds={[]} />
    </div>
  );
}

export function TemplatesSectionPage({ lang }: { lang: string }) {
  const zh = isZh(lang);
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return HOME_TEMPLATES.filter((item) =>
      [item.title.zh, item.title.en, item.prompt.zh, item.prompt.en].some((text) => text.toLowerCase().includes(needle)),
    );
  }, [query]);
  const useHref = (item: HomeTemplate) =>
    `${localizedHref(lang, "/video")}?prompt=${encodeURIComponent(zh ? item.prompt.zh : item.prompt.en)}`;
  const card = (item: HomeTemplate) => (
    <Link key={item.id} href={useHref(item)} className="sp-tpl-card" title={zh ? item.prompt.zh : item.prompt.en}>
      <span className="sp-tpl-cover">
        <img src={item.image} alt="" loading="lazy" />
        <span className="sp-tpl-use">{zh ? "使用模板" : "Use template"}</span>
      </span>
      <span className="sp-tpl-meta">
        <span className="sp-tpl-name">{zh ? item.title.zh : item.title.en}</span>
        <span className="sp-tpl-author">@aivd</span>
      </span>
    </Link>
  );
  return (
    <div className="sp-page">
      <div className="sp-glow" aria-hidden="true" />
      <section className="sp-hero">
        <h1 className="sp-title">{zh ? "模板已就绪，现在让它成为你的作品" : "Templates are ready. Now make them yours."}</h1>
        <label className="sp-search">
          <span className="sr-only">{zh ? "搜索模板" : "Search templates"}</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={zh ? "搜索模板" : "Search templates"} />
          <Search className="h-4 w-4" aria-hidden="true" />
        </label>
        <div className="sp-chips">
          {HOME_TEMPLATE_CATEGORIES.map((item) => (
            <a key={item.id} href={`#tpl-${item.id}`} className="sp-chip">{zh ? item.zh : item.en}</a>
          ))}
          <Link href={localizedHref(lang, "/effects")} className="sp-chip">{zh ? "视频特效" : "Video effects"}</Link>
        </div>
      </section>

      {results ? (
        <section className="sp-tpl-section">
          <h2 className="sp-h2">{zh ? `搜索结果（${results.length}）` : `Results (${results.length})`}</h2>
          {results.length > 0 ? <div className="sp-tpl-grid">{results.map(card)}</div> : <p className="sp-empty">{zh ? "没有匹配的模板" : "No templates match"}</p>}
        </section>
      ) : (
        <>
          <section className="sp-explore" aria-labelledby="sp-explore-title">
            <h2 id="sp-explore-title" className="sp-h2">{zh ? "探索模板" : "Explore templates"}</h2>
            <div className="sp-explore-grid">
              {HOME_TEMPLATE_CATEGORIES.map((item) => (
                <a key={item.id} href={`#tpl-${item.id}`} className="sp-explore-card">
                  <span>{zh ? item.zh : item.en}</span>
                  <img src={templatesFor(item.id)[0]?.image} alt="" loading="lazy" />
                </a>
              ))}
              <Link href={localizedHref(lang, "/effects")} className="sp-explore-card sp-explore-more">
                <span>{zh ? "视频特效" : "Video effects"}</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
          {HOME_TEMPLATE_CATEGORIES.map((group) => (
            <section key={group.id} id={`tpl-${group.id}`} className="sp-tpl-section sp-tpl-framed">
              <div className="sp-tpl-head">
                <h2 className="sp-showcase-title">{zh ? group.zh : group.en}</h2>
              </div>
              <div className="sp-tpl-grid">{templatesFor(group.id).map(card)}</div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
