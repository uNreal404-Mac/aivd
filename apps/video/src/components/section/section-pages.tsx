"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Image as ImageIcon, Search, Sparkles } from "lucide-react";

import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { ImageShowcase } from "@/components/hf/image-showcase";
import { SlideCover } from "@/components/hf/slide-cover";
import { CarouselArrows } from "@/components/hf/home-showcase";
import { useCarousel } from "@/components/hf/use-carousel";
import { modelIcon } from "@/components/hf/nav-menus";
import { useCatalogDetail } from "@/components/hf/use-catalog-detail";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import { localizedHref } from "@/lib/du-home";
import { EFFECT_TEMPLATES, labelFor, presetHref as effectHref } from "@/lib/effects-data";
import {
  HOME_TEMPLATE_CATEGORIES,
  HOME_TEMPLATES,
  templatesFor,
  type HomeTemplate,
} from "@/lib/home-templates";
import { IMAGE_CATALOG, VIDEO_CATALOG, type CatalogModel } from "@/lib/kie-model-catalog";
import { navModelHref } from "@/lib/nav-models";
import { scrollMotion } from "@/lib/reduced-motion";
import "@/components/hf/home-showcase.css";
import "@/components/hf/home-pricing.css";
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
    document.getElementById("section-template-row")?.scrollBy({ left: direction * 640, behavior: scrollMotion() });
  return (
    <section className="sp-row" aria-label={zh ? "模板" : "Templates"}>
      <Link href={localizedHref(lang, "/templates")} className="sp-promo">
        <span className="sp-promo-title">
          {zh ? (
            <>
              一键打造
              <br />
              <span>爆款</span>内容
            </>
          ) : (
            <>
              Make it <span>viral</span> in one click
            </>
          )}
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
  const detailOf = useCatalogDetail();
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
        <span className="sp-model-detail">{detailOf(item)}</span>
      </span>
    </>
  );
}

/** Two-column model list: models that can generate first, then coming soon. */
function ModelGrid({ lang, kind, connectedIds }: { lang: string; kind: "video" | "image"; connectedIds: string[] }) {
  const zh = isZh(lang);
  const catalog: CatalogModel[] = kind === "video" ? VIDEO_CATALOG : IMAGE_CATALOG;
  const ordered = [...catalog].sort((a, b) => Number(connectedIds.includes(b.id)) - Number(connectedIds.includes(a.id)));
  const pageFor: Record<string, string> = {
    "veo-3.1": "/models/veo-3-1",
    "wan2.6": "/models/wan-2-6",
    "bytedance/seedance-2-5": "/models/seedance-2-5",
    "seedance-2-5-flash": "/models/seedance-2-5-flash",
    "kling/v4-reference-to-video": "/models/kling-4-0",
    "kling/v4-flash-reference-to-video": "/models/kling-4-0-flash",
    "wan/3-0-video": "/models/wan-3-0",
    "minimax-h3/text-to-video": "/models/minimax-h3",
    "grok-imagine/text-to-video": "/models/grok-imagine",
    "grok-imagine-1-5": "/models/grok-imagine-1-5",
    "happyhorse-1-1": "/models/happyhorse-1-1",
    "gemini-omni-flash-1-2": "/models/gemini-omni-flash-1-2",
  };
  return (
    <section className="sp-models" aria-labelledby={`sp-models-${kind}`}>
      <h2 id={`sp-models-${kind}`} className="sp-h2">{zh ? "模型" : "Models"}</h2>
      <div className="sp-models-grid">
        {ordered.map((item) => {
          const live = connectedIds.includes(item.id);
          const credits = kind === "video" ? startingCredits(item.id) : null;
          const body = <ModelCardBody key={item.id} zh={zh} kind={kind} item={item} live={live} credits={credits} />;
          const targetHref = pageFor[item.id] ?? navModelHref(kind, item.id);
          return live ? (
            <Link key={item.id} href={localizedHref(lang, targetHref)} className="sp-model sp-model-live">
              {body}
            </Link>
          ) : (
            <div key={item.id} className="sp-model" aria-disabled>
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
  const applyTemplate = (template: HomeTemplate) => {
    setPreset((previous) => ({
      prompt: isZh(lang) ? template.prompt.zh : template.prompt.en,
      aspect: template.aspect,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    document.getElementById("home-generator")?.scrollIntoView({ behavior: scrollMotion(), block: "center" });
  };
  return { preset, applyTemplate };
}

export function VideoSectionPage({ lang, models, initialPrompt }: { lang: string; models: ComposerModel[]; initialPrompt: string }) {
  const zh = isZh(lang);
  const { preset, applyTemplate } = useComposerPreset(lang);
  const showcases = [
    { title: "VEO 3.1", body: zh ? "8 秒短片，带同步声音与空间层次。" : "8-second clips with synchronized sound and depth.", href: "/models/veo-3-1", images: ["mountain-valley", "storm-sea", "planet-impact"] },
    { title: "WAN 2.6", body: zh ? "5 到 15 秒，720p 与 1080p，成本更低。" : "5 to 15 seconds in 720p and 1080p at a lower cost.", href: "/models/wan-2-6", images: ["autumn-walk", "rain-couple", "mountain-wind"] },
  ];
  return (
    <div className="sp-page">
      <div className="sp-glow" aria-hidden="true" />
      <section className="sp-hero">
        <h1 className="sp-title">{zh ? "用 AI 将任何视频创意变为现实" : "Turn any video idea into reality with AI"}</h1>
        <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} initialKind="video" initialPrompt={initialPrompt} hideKindTabs />
      </section>
      <TemplateRow lang={lang} onUse={applyTemplate} />
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
      <ModelGrid
        lang={lang}
        kind="video"
        connectedIds={Array.from(
          new Set([
            ...models.map((model) => model.id),
            ...STUDIO_MODELS.filter((model) => model.available).map((model) => model.id),
          ]),
        )}
      />
    </div>
  );
}

export function ImageSectionPage({ lang, models, initialPrompt }: { lang: string; models: ComposerModel[]; initialPrompt: string }) {
  const zh = isZh(lang);
  const { preset } = useComposerPreset(lang);
  return (
    <div className="sp-page">
      <div className="sp-glow" aria-hidden="true" />
      <section className="sp-hero">
        <h1 className="sp-title">{zh ? "打造你梦寐以求的每一个画面" : "Create every image you have imagined"}</h1>
        <HomeGenerator lang={lang} models={models} onModelChange={noop} preset={preset} initialKind="image" initialPrompt={initialPrompt} hideKindTabs />
      </section>
      {/* Below the composer: the shared homepage-style image showcase */}
      <ImageShowcase lang={lang} />
    </div>
  );
}

const TEMPLATE_CATEGORY_LINES: Record<string, { zh: string; en: string }> = {
  story: { zh: "有人物、有情节的电影感短片", en: "Cinematic shorts with characters and a plot" },
  motion: { zh: "自然、粒子和舞蹈，让画面动起来", en: "Nature, particles and dance in motion" },
  recast: { zh: "科幻、奇幻和超现实的创意场景", en: "Sci-fi, fantasy and surreal ideas" },
};

// Models that suit templates, shown as tiles beside the offer card.
const TEMPLATE_MODEL_TILES: { name: string; zh: string; en: string; href: string; badge?: { zh: string; en: string } }[] = [
  { name: "Veo 3.1", zh: "带同步声音的电影级短片", en: "Cinematic clips with synced sound", href: "/ai/video?model=veo-3.1", badge: { zh: "热门", en: "Hot" } },
  { name: "Wan 2.6", zh: "5–15 秒，性价比高", en: "5–15s, good value", href: "/ai/video?model=wan2.6" },
  { name: "Seedance 2.5", zh: "电影级画面和同步声音", en: "Cinematic video with synced sound", href: "/ai/video?model=bytedance%2Fseedance-2-5", badge: { zh: "新", en: "New" } },
  { name: "Kling 4.0", zh: "参考图锁定人物", en: "References keep characters steady", href: "/ai/video?model=kling%2Fv4-reference-to-video" },
  { name: "Grok Imagine", zh: "快速、实惠的短视频", en: "Fast, affordable clips", href: "/ai/video?model=grok-imagine%2Ftext-to-video" },
  { name: "HappyHorse 1.1", zh: "风格鲜明的趣味短视频", en: "Playful clips with a strong style", href: "/ai/video?model=happyhorse-1-1" },
];

export function TemplatesSectionPage({ lang }: { lang: string }) {
  const zh = isZh(lang);
  const [query, setQuery] = useState("");
  const categoryTrack = useRef<HTMLDivElement>(null);
  const categoryCarousel = useCarousel(categoryTrack, query.trim() === "");
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return HOME_TEMPLATES.filter((item) =>
      [item.title.zh, item.title.en, item.prompt.zh, item.prompt.en].some((text) => text.toLowerCase().includes(needle)),
    );
  }, [query]);
  // Effects are templates too; a search should find them.
  const effectResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return EFFECT_TEMPLATES.filter((item) =>
      [item.name.zh, item.name.en, item.description.zh, item.description.en].some((text) => text.toLowerCase().includes(needle)),
    );
  }, [query]);
  const templateHref = (item: HomeTemplate) =>
    `${localizedHref(lang, "/video")}?prompt=${encodeURIComponent(zh ? item.prompt.zh : item.prompt.en)}`;
  // Tall photo card from the homepage; hover shows "use template".
  const card = (item: HomeTemplate) => (
    <Link key={item.id} href={templateHref(item)} className="hs-tall" title={zh ? item.prompt.zh : item.prompt.en}>
      <img src={item.image} alt="" loading="lazy" />
      <span className="hs-usecase-shade" aria-hidden="true" />
      <span className="hs-tall-title">{zh ? item.title.zh : item.title.en}</span>
      <span className="hs-tall-use">{zh ? "使用模板" : "Use template"}</span>
    </Link>
  );
  return (
    <div className="sp-page">
      <div className="sp-glow" aria-hidden="true" />
      <section className="sp-hero">
        <h1 className="sp-title sp-title-xl">{zh ? "视频模板" : "Video templates"}</h1>
        <p className="sp-lede">{zh ? "模板已就绪，改几个词，就是你的作品。" : "Templates are ready. Change a few words and make them yours."}</p>
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

      {/* Below the search the page uses the homepage and pricing styles. */}
      <div className="hs sp-hs">
        {results ? (
          <section className="hs-section" aria-labelledby="tpl-results-title">
            <div className="hs-head">
              <div>
                <h2 id="tpl-results-title" className="hs-title">{zh ? "搜索结果" : "RESULTS"}</h2>
                <p className="hs-sub">
                  {zh
                    ? `找到 ${results.length} 个模板${effectResults.length ? `、${effectResults.length} 个特效` : ""}`
                    : `${results.length} templates${effectResults.length ? `, ${effectResults.length} effects` : ""} found`}
                </p>
              </div>
            </div>
            {effectResults.length > 0 ? (
              <div className="sp-effect-hits">
                {effectResults.map((effect) => (
                  <Link key={effect.id} href={effectHref(lang, effect)} className="sp-effect-hit">
                    <Sparkles aria-hidden="true" />
                    <span>
                      {zh ? "特效 · " : "Effect · "}
                      {labelFor(effect.name, lang)}
                    </span>
                    <ArrowRight aria-hidden="true" />
                  </Link>
                ))}
              </div>
            ) : null}
            {results.length > 0 ? (
              <div className="hs-tall-row sp-tall-4">{results.map(card)}</div>
            ) : effectResults.length === 0 ? (
              <div className="sp-no-hit">
                <p className="hs-sub">{zh ? "没有匹配的模板。" : "No templates match."}</p>
                <Link
                  href={`${localizedHref(lang, "/ai/video")}?prompt=${encodeURIComponent(query.trim())}`}
                  className="sp-no-hit-go"
                >
                  <Sparkles aria-hidden="true" />
                  {zh ? `直接用「${query.trim()}」生成视频` : `Generate a video from "${query.trim()}"`}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </div>
            ) : null}
          </section>
        ) : (
          <>
            {/* 1. Category carousel */}
            <section className="hs-carousel" aria-label={zh ? "模板分类" : "Template categories"}>
              <div ref={categoryTrack} className="hs-carousel-track">
                {HOME_TEMPLATE_CATEGORIES.map((item) => (
                  <a key={item.id} href={`#tpl-${item.id}`} className="hs-slide">
                    <span className="hs-slide-media">
                      <img src={templatesFor(item.id)[0]?.image} alt="" loading="lazy" />
                      <SlideCover
                        main={zh ? item.zh : item.en}
                        sub={zh ? `${templatesFor(item.id).length} 个模板` : `${templatesFor(item.id).length} templates`}
                      />
                    </span>
                    <span className="hs-slide-body">
                      {zh ? TEMPLATE_CATEGORY_LINES[item.id]?.zh : TEMPLATE_CATEGORY_LINES[item.id]?.en}
                    </span>
                  </a>
                ))}
                <Link href={localizedHref(lang, "/effects")} className="hs-slide">
                  <span className="hs-slide-media">
                    <img src="/home/samples/cosmic-bloom.webp" alt="" loading="lazy" />
                    <SlideCover main={zh ? "视频特效" : "EFFECTS"} sub={zh ? "一键套用" : "ONE CLICK"} />
                  </span>
                  <span className="hs-slide-body">{zh ? "镜头运动、变形和氛围特效" : "Camera moves, transforms and atmosphere"}</span>
                </Link>
              </div>
              <CarouselArrows zh={zh} {...categoryCarousel} />
            </section>

            {/* 2. Offer card and model tiles */}
            <section className="hs-offer-grid" aria-label={zh ? "适合模板的模型" : "Models for templates"}>
              <Link href={localizedHref(lang, "/ai/video")} className="hs-offer">
                <span className="hs-offer-glow" aria-hidden="true" />
                <span className="hs-offer-kicker">{zh ? "模板免费用" : "Templates are free"}</span>
                <span className="hs-offer-title">{zh ? "一键套用" : "One click"}</span>
                <span className="hs-offer-body">{zh ? "提示词自动填好，只按生成扣积分" : "The prompt is filled in; you only pay to generate"}</span>
                <span className="hs-offer-cta">{zh ? "打开视频工作室" : "Open the video studio"}</span>
              </Link>
              <div className="hs-tiles">
                {TEMPLATE_MODEL_TILES.map((tile) => (
                  <Link key={tile.name} href={localizedHref(lang, tile.href)} className="hs-tile" data-tilt>
                    {(() => {
                      const TileIcon = modelIcon(tile.name);
                      return <TileIcon className="hs-tile-icon" aria-hidden="true" />;
                    })()}
                    <span className="hs-tile-title">
                      {tile.name}
                      {tile.badge ? <span className="hs-badge">{zh ? tile.badge.zh : tile.badge.en}</span> : null}
                    </span>
                    <span className="hs-tile-body">{zh ? tile.zh : tile.en}</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* 3. One section per category; ids match the nav's #tpl-* links */}
            {HOME_TEMPLATE_CATEGORIES.map((group) => (
              <section key={group.id} id={`tpl-${group.id}`} className="hs-section sp-anchor" aria-labelledby={`tpl-title-${group.id}`}>
                <div className="hs-head">
                  <div>
                    <h2 id={`tpl-title-${group.id}`} className="hs-title">{zh ? group.zh : group.en}</h2>
                    <p className="hs-sub">{zh ? TEMPLATE_CATEGORY_LINES[group.id]?.zh : TEMPLATE_CATEGORY_LINES[group.id]?.en}</p>
                  </div>
                </div>
                <div className="hs-tall-row sp-tall-4">{templatesFor(group.id).map(card)}</div>
              </section>
            ))}

            {/* 4. Banner: templates are a starting point */}
            <section className="hs-banner hs-banner-canvas" aria-labelledby="tpl-agent-title">
              <div className="hs-banner-text">
                <span className="hs-banner-kicker">AGENT</span>
                <h2 id="tpl-agent-title" className="hs-banner-title">
                  {zh ? <>模板只是起点。<br />想法才是主角。</> : <>Templates are a start.<br />Your idea leads.</>}
                </h2>
                <p className="hs-banner-body">
                  {zh ? "没有合适的模板？说一句想法，Agent 帮你拆成分镜再生成" : "No template fits? Say the idea and the agent plans the shots"}
                </p>
                <Link href={localizedHref(lang, "/creative-space")} className="hs-btn hs-btn-light">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {zh ? "与 AGENT 对话" : "Chat with AGENT"}
                </Link>
              </div>
              <div className="hs-banner-art" aria-hidden="true">
                <img src="/home/samples/rain-couple.webp" alt="" className="hs-banner-card hs-banner-card-a" loading="lazy" />
                <img src="/home/samples/dancer.webp" alt="" className="hs-banner-card hs-banner-card-b" loading="lazy" />
                <span className="hs-banner-bubble">{zh ? "把这个模板改成雨夜版本" : "Make this template a rainy night"}</span>
              </div>
            </section>

            {/* 5. Steps as gradient cards */}
            <section className="hs-section" aria-labelledby="tpl-steps-title">
              <div className="hs-head">
                <div>
                  <h2 id="tpl-steps-title" className="hs-title">{zh ? "三步用好模板" : "THREE STEPS"}</h2>
                  <p className="hs-sub">{zh ? "从模板到成片，不用自己写提示词。" : "From template to clip without writing a prompt."}</p>
                </div>
              </div>
              <div className="hp-plans">
                {[
                  { zh: "挑模板", en: "Pick", bodyZh: "按分类浏览或搜索，找一个接近你想法的模板。", bodyEn: "Browse or search for a template close to your idea." },
                  { zh: "改几个词", en: "Tweak", bodyZh: "提示词已填好，换掉人物、场景或风格就行。", bodyEn: "The prompt is filled in; swap the subject, scene or style." },
                  { zh: "生成下载", en: "Generate", bodyZh: "选模型、看积分、点生成，成片保存在我的作品。", bodyEn: "Pick a model, see the cost, generate and download." },
                ].map((step, index) => (
                  <article key={step.en} className={`hp-plan hp-plan-${(["basic", "pro", "ultimate"] as const)[index]}`}>
                    <div className="hp-plan-top sp-step-card" data-tilt>
                      <span className="sp-step-n">{index + 1}</span>
                      <p className="hp-plan-name">{zh ? step.zh : step.en}</p>
                      <p className="hp-plan-blurb">{zh ? step.bodyZh : step.bodyEn}</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
