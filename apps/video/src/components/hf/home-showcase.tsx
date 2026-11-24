"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Eye,
  Film,
  Heart,
  Image as ImageIcon,
  Layers,
  Orbit,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { GallerySection } from "@/components/gallery/gallery-section";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { CREATIVE_SKILLS, CREATIVE_SKILL_CATEGORIES } from "@/lib/creative-skills";
import { localizedHref } from "@/lib/du-home";
import {
  AI_CAPABILITY_PILLS,
  FEATURE_SLIDES,
  HOW_STEPS,
  MEDIA,
  MODEL_GALLERIES,
  PRODUCT_TILES,
  SAMPLE_PROMPTS,
  SHORTS_PRESETS,
  VIRAL_TEMPLATES,
  withExamplePrompt,
  withPrompt,
  type Bi,
  type ShowMedia,
} from "@/lib/home-showcase";
import { WallCard } from "@/components/hf/wall-card";
import { SlideCover } from "@/components/hf/slide-cover";
import { InViewVideo } from "@/components/hf/in-view-video";
import { VideoPlayToggle } from "@/components/hf/video-play-toggle";
import { useCarousel } from "@/components/hf/use-carousel";
import { ScrollReveal } from "@/components/scroll-reveal";
import type { HomeTemplate } from "@/lib/home-templates";
import { scrollMotion } from "@/lib/reduced-motion";
import "./home-showcase.css";

const TILE_ICONS: Record<(typeof PRODUCT_TILES)[number]["icon"], LucideIcon> = {
  film: Film,
  spark: Sparkles,
  image: ImageIcon,
  wave: AudioLines,
  layers: Layers,
  orbit: Orbit,
};

// Staggered mixed ratios for Higgsfield-style dense 4-column visual walls.
const WALL_RATIOS = ["3 / 4", "4 / 3", "1 / 1", "16 / 10", "4 / 5", "16 / 9", "3 / 4", "1 / 1"];
// Native ratios of the six Seedance flagship videos, strictly full-bleed cover.
const VIDEO_WALL_RATIOS = ["16 / 9", "16 / 9", "16 / 9", "9 / 16", "9 / 16", "16 / 9"];

function Media({ media, className, eager }: { media: ShowMedia; className?: string; eager?: boolean }) {
  return media.video ? (
    <InViewVideo className={className} src={media.src} poster={media.poster} />
  ) : (
    <img className={className} src={media.src} alt="" loading={eager ? "eager" : "lazy"} />
  );
}

/** Framed cinema card: 16:9 media header + dark studio footer panel (Pollo × Higgsfield). */
function SlideContent({ slide, eager, t }: { slide: (typeof FEATURE_SLIDES)[number]; eager: boolean; t: (value: Bi) => string }) {
  return (
    <>
      <span className="hs-slide-media">
        <Media media={slide.media} eager={eager} />
        <SlideCover main={slide.cover.main} sub={t(slide.cover.sub)} />
      </span>
      <span className="hs-slide-foot">
        <span className={slide.accent ? "hs-slide-title hs-accent" : "hs-slide-title"}>{t(slide.title)}</span>
        <span className="hs-slide-body">{t(slide.body)}</span>
      </span>
    </>
  );
}

export function HomeShowcase({ lang, onUseTemplate }: { lang: string; onUseTemplate: (template: HomeTemplate) => void }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const t = (value: Bi) => (zh ? value.zh : value.en);
  const href = (path: string) => localizedHref(lang, path);
  const trackRef = useRef<HTMLDivElement>(null);
  const carousel = useCarousel(trackRef);
  const skills = CREATIVE_SKILLS.slice(0, 8);
  const categoryName = (id: string) => {
    const category = CREATIVE_SKILL_CATEGORIES.find((item) => item.id === id);
    return category ? (zh ? category.zh : category.en) : "";
  };

  return (
    <div className="hs">
      <ScrollReveal />

      {/* 1. Pollo-inspired Cinema Filmstrip Band wrapping the Flagship Feature Rail */}
      <section className="hs-filmstrip" aria-label={zh ? "最新功能" : "What's new"}>
        <div className="hs-filmstrip-perf" aria-hidden="true" />
        <div className="hs-shell hs-carousel">
          <div ref={trackRef} className="hs-carousel-track">
            {FEATURE_SLIDES.map((slide, index) =>
              slide.media.video ? (
                <div key={slide.href} className="hs-slide" data-video-scope>
                  <Link href={href(slide.href)} className="hs-slide-link">
                    <SlideContent slide={slide} eager={index < 3} t={t} />
                  </Link>
                  <VideoPlayToggle zh={zh} className="hs-slide-play" />
                </div>
              ) : (
                <Link key={slide.href} href={href(slide.href)} className="hs-slide">
                  <SlideContent slide={slide} eager={index < 3} t={t} />
                </Link>
              ),
            )}
          </div>
          <CarouselArrows zh={zh} {...carousel} />
        </div>
        <div className="hs-filmstrip-perf" aria-hidden="true" />
      </section>

      <div className="hs-shell hs-stack">
        {/* 2. Pollo One-Click Viral Templates Anchor Row — immediate Screen-2 visual momentum */}
        <section className="hs-viral" aria-label={zh ? "一键生成爆款短片" : "Make what's going viral in one click"}>
          <Link href={href("/templates")} className="hs-viral-lead">
            <span className="hs-viral-lead-glow" aria-hidden="true" />
            <span className="hs-viral-lead-title">
              {zh ? (
                <>
                  一键复刻
                  <span className="hs-accent">爆款短片</span>
                  直接成片
                </>
              ) : (
                <>
                  MAKE WHAT&apos;S
                  <span className="hs-accent">GOING VIRAL</span>
                  IN ONE CLICK
                </>
              )}
            </span>
            <span className="hs-viral-lead-cta">
              {zh ? "浏览全部模板" : "TRY TEMPLATES"}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
          </Link>

          <div className="hs-viral-cards">
            {VIRAL_TEMPLATES.map((item) => (
              <button
                key={item.id}
                type="button"
                className="hs-viral-card"
                onClick={() =>
                  onUseTemplate({
                    id: item.id,
                    category: "story",
                    image: item.media.poster ?? item.media.src,
                    title: item.title,
                    prompt: item.prompt,
                    aspect: item.aspect,
                  })
                }
              >
                <Media media={item.media} className="hs-viral-media" />
                <span className="hs-viral-shade" aria-hidden="true" />
                <span className="hs-viral-tag">{t(item.tag)}</span>
                <span className="hs-viral-meta">
                  <span className="hs-viral-name">{t(item.title)}</span>
                  <ArrowRight className="hs-viral-arrow" aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* 3. Higgsfield Bento: Cosmic-Horizon Offer Card + 3×2 Compact Utility Grid */}
        <section className="hs-offer-grid" aria-label={zh ? "热门产品" : "Popular tools"}>
          <Link href={href("/pricing")} className="hs-offer">
            <span className="hs-offer-horizon" aria-hidden="true" />
            <span className="hs-offer-kicker">{zh ? "新用户专属礼遇" : "NEW CREATOR OFFER"}</span>
            <span className="hs-offer-num">+{NEW_USER_GIFT.credits}</span>
            <span className="hs-offer-title">{zh ? `注册即送 ${NEW_USER_GIFT.credits} 积分` : `${NEW_USER_GIFT.credits} Free Credits`}</span>
            <span className="hs-offer-body">{zh ? "免费生成你的第一条 1080P 有声视频" : "Generate your first 1080p audio video free"}</span>
            <span className="hs-offer-cta">{zh ? "免费开始创作" : "Start creating free"}</span>
          </Link>

          <div className="hs-tiles">
            {PRODUCT_TILES.map((tile) => {
              const Icon = TILE_ICONS[tile.icon];
              return (
                <Link key={tile.href} href={href(tile.href)} className="hs-tile" data-tilt>
                  <span className="hs-tile-top">
                    <span className="hs-tile-squircle" aria-hidden="true">
                      <Icon className="hs-tile-icon" />
                    </span>
                    <span className="hs-tile-badges">
                      {tile.badge ? <span className="hs-badge hs-badge-live">{t(tile.badge)}</span> : null}
                      {tile.tag ? <span className="hs-badge hs-badge-tag">{tile.tag}</span> : null}
                    </span>
                  </span>
                  <span className="hs-tile-copy">
                    <span className="hs-tile-title">{typeof tile.title === "string" ? tile.title : t(tile.title)}</span>
                    <span className="hs-tile-body">{t(tile.body)}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 4. Higgsfield MAGI-2 × Pollo Story Video Framed Flagship Showcase (Seedance 2.5) */}
        <ModelWall lang={lang} index={0} framed />

        {/* 5. Higgsfield Shorts Studio Style 5-Column Vertical 9:16 Effects & Presets Wall */}
        <section className="hs-framed-module hs-shorts-module" aria-labelledby="hs-shorts-title">
          <div className="hs-framed-glow" aria-hidden="true" />
          <div className="hs-head hs-head-framed">
            <div>
              <p className="hs-kicker">{zh ? "SHORTS & VFX STUDIO" : "SHORTS & VFX STUDIO"}</p>
              <h2 id="hs-shorts-title" className="hs-title">
                {zh ? (
                  <>
                    AIVD <span className="hs-accent">短视频与特效 preset</span>
                  </>
                ) : (
                  <>
                    AIVD <span className="hs-accent">SHORTS &amp; VFX STUDIO</span>
                  </>
                )}
              </h2>
              <p className="hs-sub">
                {zh
                  ? "精选 9:16 爆款运镜与视觉特效模板，点击直接载入提示词复刻同款质感。"
                  : "Curated 9:16 camera moves and VFX presets — click any shot to recreate in one click."}
              </p>
            </div>
            <Link href={href("/effects")} className="hs-btn hs-btn-accent">
              {zh ? "进入特效库" : "Explore Effects"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="hs-shorts-wrap">
            <div className="hs-shorts-grid">
              {SHORTS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className="hs-short-card"
                  onClick={() =>
                    onUseTemplate({
                      id: preset.id,
                      category: "motion",
                      image: preset.image,
                      title: preset.title,
                      prompt: preset.prompt,
                      aspect: "9:16",
                    })
                  }
                >
                  {preset.video ? (
                    <InViewVideo className="hs-short-media" src={preset.video} poster={preset.image} />
                  ) : (
                    <img className="hs-short-media" src={preset.image} alt="" loading="lazy" />
                  )}
                  <span className="hs-short-shade" aria-hidden="true" />
                  <span className="hs-short-cta">{zh ? "做同款" : "Recreate"}</span>
                  <span className="hs-short-footer">
                    <span className="hs-short-meta">
                      <span className="hs-short-name">{t(preset.title)}</span>
                      <span className="hs-short-stats">
                        <span>
                          <Eye className="h-3 w-3" aria-hidden="true" />
                          {t(preset.views)}
                        </span>
                        <span>
                          <Heart className="h-3 w-3" aria-hidden="true" />
                          {preset.likes}
                        </span>
                      </span>
                    </span>
                    <img className="hs-short-pip" src={preset.pip} alt="" loading="lazy" aria-hidden="true" />
                  </span>
                </button>
              ))}
            </div>
            <div className="hs-fade-cta-bar">
              <Link href={href("/effects")} className="hs-fade-pill">
                {zh ? "查看全部特效与预设" : "View all presets"}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        {/* 6. Higgsfield Architectural Node-Canvas Banner (Deep Ocean-Cyan Brand Palette) */}
        <section className="hs-banner hs-banner-canvas" aria-labelledby="hs-canvas-title">
          <div className="hs-banner-dots" aria-hidden="true" />
          <div className="hs-banner-text">
            <span className="hs-banner-kicker">{zh ? "INFINITE CANVAS · 无限画布" : "INFINITE CANVAS"}</span>
            <h2 id="hs-canvas-title" className="hs-banner-title">
              {zh ? (
                <>
                  一块画布。
                  <br />
                  所有工作流。
                </>
              ) : (
                <>
                  One canvas.
                  <br />
                  Every workflow.
                </>
              )}
            </h2>
            <p className="hs-banner-body">
              {zh
                ? "把参考图、分镜节点、视频生成与 4K 修图串联在同一块无界画布上，用 @ 随时召唤 Agent 协作。"
                : "Arrange moodboards, chain video & image nodes, and @mention the Agent on one infinite canvas."}
            </p>
            <Link href={href("/creative-space/canvas")} className="hs-btn hs-btn-light">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {zh ? "体验无限画布" : "Try Infinite Canvas"}
            </Link>
          </div>
          <div className="hs-banner-art" aria-hidden="true">
            <svg className="hs-banner-wire" viewBox="0 0 560 280" fill="none">
              <path
                d="M170 150 C 260 150, 270 92, 356 92"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="6 6"
              />
              <circle cx="170" cy="150" r="5" fill="currentColor" />
              <circle cx="356" cy="92" r="5" fill="currentColor" />
            </svg>
            <div className="hs-banner-node hs-banner-node-a">
              <span className="hs-banner-node-head">{zh ? "参考节点 · @图片1" : "Ref Node · @Image1"}</span>
              <img src={MEDIA.carpet.src} alt="" loading="lazy" />
            </div>
            <div className="hs-banner-node hs-banner-node-b">
              <span className="hs-banner-node-head">{zh ? "成片输出 · 1080P" : "Cinema Out · 1080p"}</span>
              <img src={MEDIA.dancer.src} alt="" loading="lazy" />
            </div>
            <span className="hs-banner-chip hs-banner-chip-a">{zh ? "✦ 分镜 Agent 已就绪" : "✦ Storyboard Agent"}</span>
            <span className="hs-banner-bubble">{zh ? "@画布 把这张图做成 8 秒电影运镜视频" : "@canvas turn this into an 8s cinema shot"}</span>
          </div>
        </section>

        {/* 7. Pollo Fluted Spotlight Banner + Creative Space Agent 4×2 Use Cases */}
        <section className="hs-chrome" aria-labelledby="hs-agent-title">
          <span className="hs-chrome-flutes" aria-hidden="true" />
          <span className="hs-chrome-edge hs-chrome-edge-a" aria-hidden="true" />
          <span className="hs-chrome-edge hs-chrome-edge-b" aria-hidden="true" />
          <h2 id="hs-agent-title" className="hs-chrome-kicker">
            {zh ? "AI VIDEO AGENT · 创作空间" : "AI VIDEO AGENT · CREATIVE SPACE"}
          </h2>
          <p className="hs-chrome-title">{zh ? "一句话，一整条电影短片" : "ONE LINE. ONE FULL FILM."}</p>
          <p className="hs-chrome-body">
            {zh
              ? "输入你的创意，导演 Agent 自动拆解镜头脚本、参考画面与提示词，你确认后直接串联出片。"
              : "Pitch your idea once. The director agent plans scenes, shots, and prompts before rendering."}
          </p>
          <div className="hs-chrome-actions">
            <Link href={href("/creative-space")} className="hs-btn hs-btn-accent">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {zh ? "启动创作空间" : "Launch Creative Space"}
            </Link>
            <Link href={href("/creative-space/canvas")} className="hs-btn hs-btn-dark">
              {zh ? "打开节点画布" : "Open Node Canvas"}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="hs-usecases" aria-label={zh ? "创作案例" : "Use cases"}>
          <div className="hs-usecase-grid">
            {skills.map((skill, index) => (
              <Link
                key={skill.id}
                href={href(`/creative-space/canvas?prompt=${encodeURIComponent(zh ? skill.brief.zh : skill.brief.en)}`)}
                className={index >= 4 ? "hs-usecase hs-usecase-faded" : "hs-usecase"}
                tabIndex={index >= 4 ? -1 : undefined}
                aria-hidden={index >= 4 || undefined}
              >
                <img src={skill.image} alt="" loading="lazy" />
                <span className="hs-usecase-shade" aria-hidden="true" />
                <span className="hs-usecase-title">{zh ? skill.title.zh : skill.title.en}</span>
                <span className="hs-usecase-tags">
                  <span className="hs-chip">{categoryName(skill.category)}</span>
                  <span className="hs-chip">{zh ? "Agent 分镜" : "Agent plan"}</span>
                </span>
              </Link>
            ))}
          </div>
          <Link href={href("/creative-space")} className="hs-fade-pill hs-see-all">
            {zh ? "探索全部 Agent 案例" : "See all Agent workflows"}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </section>

        {/* 8. Higgsfield Edge-to-Edge 4-Column Mixed-Aspect Gallery (Nano Banana Pro 4K) */}
        <ModelWall lang={lang} index={1} framed />

        {/* 9. Kling Image 4.0 Editorial Showcase Banner */}
        <section className="hs-banner hs-banner-photo" aria-labelledby="hs-photo-title">
          <div className="hs-banner-text">
            <span className="hs-banner-tag">KLING IMAGE 4.0</span>
            <h2 id="hs-photo-title" className="hs-banner-title">
              {zh ? (
                <>
                  多风格大片
                  <br />
                  一键成片
                </>
              ) : (
                <>
                  Multi-style cinema
                  <br />
                  stills in one click
                </>
              )}
            </h2>
            <p className="hs-banner-body">
              {zh
                ? "从电影雨夜、红毯高定到商业棚拍，支持多参考图一致性与 4K 精细皮肤纹理出图。"
                : "From neon rain and couture editorials to studio shoots with reference guidance & 4K detail."}
            </p>
            <Link href={href("/ai/image?model=kling-image-4")} className="hs-btn hs-btn-light">
              {zh ? "试试 Kling Image 4.0" : "Try Kling Image 4.0"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="hs-banner-fan" aria-hidden="true">
            {[MEDIA.rain, MEDIA.carpet, MEDIA.autumn, MEDIA.dreaming, MEDIA.dancer].map((media, index) => (
              <img key={media.src} src={media.src} alt="" loading="lazy" style={{ ["--i" as string]: index }} />
            ))}
          </div>
        </section>

        {/* 10. Community Showcase (renders published works or curated gallery) */}
        <GallerySection variant="home" />

        {/* 11. Compact 3-Step Workflow Bar (keeps SEO & onboarding without disrupting Screen 2) */}
        <section className="hs-how-bar" aria-labelledby="hs-how-title">
          <div className="hs-head">
            <div>
              <p className="hs-kicker">{zh ? "WORKFLOW" : "WORKFLOW"}</p>
              <h2 id="hs-how-title" className="hs-title">
                {zh ? "怎么用 AI 生成视频" : "How to make an AI video"}
              </h2>
            </div>
            <p className="hs-sub">{zh ? "从一个想法到一条 1080P 有声成片，只需三步。" : "Three steps from an idea to a finished clip."}</p>
          </div>
          <ol className="hs-steps">
            {HOW_STEPS.map((step, index) => (
              <li key={step.title.en} className="hs-step">
                <span className="hs-step-num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="hs-step-title">{t(step.title)}</h3>
                <p className="hs-step-body">{t(step.body)}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* 12. Higgsfield Elevated AI Capabilities Pill Cloud */}
      <section className="hs-pill-cloud" aria-labelledby="hs-cloud-title">
        <div className="hs-shell hs-pill-cloud-inner">
          <h2 id="hs-cloud-title" className="hs-pill-cloud-title">
            {zh ? "探索更多 AI 创作功能" : "EXPLORE MORE AI CAPABILITIES"}
          </h2>
          <div className="hs-pill-cloud-list">
            {AI_CAPABILITY_PILLS.map((pill) => (
              <Link key={`${pill.href}-${pill.label.en}`} href={href(pill.href)} className="hs-cloud-pill">
                {t(pill.label)}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ModelWall({ lang, index, framed = false }: { lang: string; index: number; framed?: boolean }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const gallery = MODEL_GALLERIES[index];
  if (!gallery) return null;
  const isVideoWall = index === 0;

  return (
    <section
      className={framed ? "hs-framed-module" : "hs-section"}
      aria-labelledby={`hs-wall-${gallery.id}`}
    >
      {framed ? <div className="hs-framed-glow" aria-hidden="true" /> : null}
      <div className={framed ? "hs-head hs-head-framed" : "hs-head"}>
        <div>
          <p className="hs-kicker">{isVideoWall ? "FLAGSHIP VIDEO ENGINE" : "4K CINEMA STILL ENGINE"}</p>
          <h2 id={`hs-wall-${gallery.id}`} className="hs-title">
            <span className="hs-accent">{gallery.title}</span> · {zh ? gallery.heading.zh : gallery.heading.en}
          </h2>
          <p className="hs-sub">{zh ? gallery.body.zh : gallery.body.en}</p>
        </div>
        <Link href={localizedHref(lang, gallery.href)} className="hs-btn hs-btn-accent">
          {zh ? gallery.cta.zh : gallery.cta.en}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="hs-wall-wrap">
        <div className={isVideoWall ? "hs-wall hs-wall-video" : "hs-wall"}>
          {gallery.media.map((media, position) => {
            const prompt = SAMPLE_PROMPTS[media.src];
            const text = prompt ? (zh ? prompt.zh : prompt.en) : undefined;
            return (
              <WallCard
                key={`${gallery.id}-${position}`}
                media={media}
                href={localizedHref(lang, isVideoWall ? withExamplePrompt(gallery.href, media.promptId) : withPrompt(gallery.href, text))}
                prompt={isVideoWall ? undefined : text}
                cta={zh ? "做同款" : "Make one like this"}
                ratio={isVideoWall ? VIDEO_WALL_RATIOS[position] : WALL_RATIOS[(position + index) % WALL_RATIOS.length]}
                position={position + index}
                zh={zh}
              />
            );
          })}
        </div>
        <div className="hs-fade-cta-bar">
          <Link href={localizedHref(lang, gallery.href)} className="hs-fade-pill">
            {zh ? `探索更多 ${gallery.title} 作品` : `Explore more ${gallery.title}`}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/** Compact prompt bar pinned to the bottom once the main generator scrolls away. */
export function MiniComposer({
  lang,
  anchorId,
  targetPath = "/ai/video",
}: {
  lang: string;
  anchorId: string;
  /** Page the prompt opens in; it arrives as ?prompt=. */
  targetPath?: string;
}) {
  const zh = lang.toLowerCase().startsWith("zh");
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    const update = () => {
      const anchor = document.getElementById(anchorId);
      if (!anchor) return;
      const footer = document.querySelector("footer");
      const anchorGone = anchor.getBoundingClientRect().bottom < 0;
      const footerShown = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      setVisible(anchorGone && !footerShown);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [anchorId]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    router.push(localizedHref(lang, `${targetPath}?prompt=${encodeURIComponent(text)}`));
  };

  return (
    <form className={visible ? "hs-mini hs-mini-on" : "hs-mini"} onSubmit={submit} aria-hidden={!visible}>
      <label htmlFor="hs-mini-input" className="sr-only">
        {zh ? "今天想创作什么" : "What do you want to create today"}
      </label>
      <input
        id="hs-mini-input"
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder={zh ? "今天想创作什么？" : "What do you want to create today"}
        maxLength={2000}
        tabIndex={visible ? 0 : -1}
        autoComplete="off"
      />
      <button type="submit" disabled={!prompt.trim()} aria-label={zh ? "开始生成" : "Generate"} tabIndex={visible ? 0 : -1}>
        <ArrowUp className="h-4 w-4" aria-hidden="true" />
      </button>
    </form>
  );
}

/** Previous / next buttons over a card row; each hides at its end of the row. */
export function CarouselArrows({
  zh,
  canPrev,
  canNext,
  step,
}: {
  zh: boolean;
  canPrev: boolean;
  canNext: boolean;
  step: (direction: 1 | -1) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="hs-arrow hs-arrow-prev"
        aria-label={zh ? "上一组" : "Previous"}
        data-hidden={!canPrev || undefined}
        tabIndex={canPrev ? 0 : -1}
        onClick={() => step(-1)}
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <button
        type="button"
        className="hs-arrow"
        aria-label={zh ? "下一组" : "Next"}
        data-hidden={!canNext || undefined}
        tabIndex={canNext ? 0 : -1}
        onClick={() => step(1)}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </>
  );
}

/** Compact corner button taking the visitor smoothly back to the Hero generator. */
export function BackToCreate({ lang, anchorId }: { lang: string; anchorId: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const anchor = document.getElementById(anchorId);
      if (!anchor) return;
      const footer = document.querySelector("footer");
      const anchorGone = anchor.getBoundingClientRect().bottom < 0;
      const footerShown = footer ? footer.getBoundingClientRect().top < window.innerHeight : false;
      setVisible(anchorGone && !footerShown);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [anchorId]);

  const label = zh ? "回到首屏创作" : "Back to the generator";
  const goBack = () => {
    const anchor = document.getElementById(anchorId);
    anchor?.scrollIntoView({ behavior: scrollMotion(), block: "start" });
    anchor?.querySelector<HTMLTextAreaElement>("textarea")?.focus({ preventScroll: true });
  };

  return (
    <button
      type="button"
      className={visible ? "hs-back-to-create hs-back-to-create-on" : "hs-back-to-create"}
      onClick={goBack}
      aria-label={label}
      title={label}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
