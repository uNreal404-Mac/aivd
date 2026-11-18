"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUp, AudioLines, ChevronRight, Clapperboard, Film, Image as ImageIcon, Layers, Orbit, Sparkles, type LucideIcon } from "lucide-react";

import { GallerySection } from "@/components/gallery/gallery-section";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { CREATIVE_SKILLS, CREATIVE_SKILL_CATEGORIES } from "@/lib/creative-skills";
import { localizedHref } from "@/lib/du-home";
import { FEATURE_SLIDES, MEDIA, MODEL_GALLERIES, PRODUCT_TILES, SAMPLE_PROMPTS, withPrompt, type Bi, type ShowMedia } from "@/lib/home-showcase";
import { WallCard } from "@/components/hf/wall-card";
import { HOME_TEMPLATES, type HomeTemplate } from "@/lib/home-templates";
import "./home-showcase.css";

const TILE_ICONS: Record<(typeof PRODUCT_TILES)[number]["icon"], LucideIcon> = {
  film: Film,
  spark: Sparkles,
  image: ImageIcon,
  wave: AudioLines,
  layers: Layers,
  orbit: Orbit,
};

// Aspect ratios cycled through the masonry walls so columns stagger.
const WALL_RATIOS = ["3 / 4", "4 / 3", "1 / 1", "16 / 10", "4 / 5", "16 / 9", "3 / 4", "1 / 1"];

function Media({ media, className, eager }: { media: ShowMedia; className?: string; eager?: boolean }) {
  return media.video ? (
    <video className={className} src={media.src} poster={media.poster} autoPlay muted loop playsInline preload={eager ? "auto" : "metadata"} />
  ) : (
    <img className={className} src={media.src} alt="" loading={eager ? "eager" : "lazy"} />
  );
}

export function HomeShowcase({ lang, onUseTemplate }: { lang: string; onUseTemplate: (template: HomeTemplate) => void }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const t = (value: Bi) => (zh ? value.zh : value.en);
  const href = (path: string) => localizedHref(lang, path);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrollTrack = (direction: number) => trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth * 0.75, behavior: "smooth" });
  const skills = CREATIVE_SKILLS.slice(0, 8);
  const categoryName = (id: string) => {
    const category = CREATIVE_SKILL_CATEGORIES.find((item) => item.id === id);
    return category ? (zh ? category.zh : category.en) : "";
  };

  return (
    <div className="hs">
      {/* 1. Feature carousel */}
      <section className="hs-carousel" aria-label={zh ? "最新功能" : "What's new"}>
        <div ref={trackRef} className="hs-carousel-track">
          {FEATURE_SLIDES.map((slide, index) => (
            <Link key={slide.href} href={href(slide.href)} className="hs-slide">
              <span className="hs-slide-media">
                <Media media={slide.media} eager={index < 3} />
              </span>
              <span className={slide.accent ? "hs-slide-title hs-accent" : "hs-slide-title"}>{t(slide.title)}</span>
              <span className="hs-slide-body">{t(slide.body)}</span>
            </Link>
          ))}
        </div>
        <button type="button" className="hs-arrow" aria-label={zh ? "下一组" : "Next"} onClick={() => scrollTrack(1)}>
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </section>

      {/* 2. Offer card and product tiles */}
      <section className="hs-offer-grid" aria-label={zh ? "热门产品" : "Popular tools"}>
        <Link href={href("/pricing")} className="hs-offer">
          <span className="hs-offer-glow" aria-hidden="true" />
          <span className="hs-offer-kicker">{zh ? "新用户福利" : "New account offer"}</span>
          <span className="hs-offer-title">{zh ? `注册即送 ${NEW_USER_GIFT.credits} 积分` : `${NEW_USER_GIFT.credits} free credits`}</span>
          <span className="hs-offer-body">{zh ? "可免费生成第一条视频" : "Enough for your first video"}</span>
          <span className="hs-offer-cta">{zh ? "免费开始" : "Start free"}</span>
        </Link>
        <div className="hs-tiles">
          {PRODUCT_TILES.map((tile) => {
            const Icon = TILE_ICONS[tile.icon];
            return (
              <Link key={tile.title} href={href(tile.href)} className="hs-tile" data-tilt>
                <Icon className="hs-tile-icon" aria-hidden="true" />
                <span className="hs-tile-title">
                  {tile.title}
                  {tile.badge ? <span className="hs-badge">{t(tile.badge)}</span> : null}
                  {tile.tag ? <span className="hs-badge hs-badge-tag">{tile.tag}</span> : null}
                </span>
                <span className="hs-tile-body">{t(tile.body)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 3. Agent banner and use cases */}
      <section className="hs-chrome" aria-labelledby="hs-agent-title">
        <span className="hs-chrome-edge hs-chrome-edge-a" aria-hidden="true" />
        <span className="hs-chrome-edge hs-chrome-edge-b" aria-hidden="true" />
        <p className="hs-chrome-kicker">{zh ? "创作空间 AGENT" : "CREATIVE SPACE AGENT"}</p>
        <h2 id="hs-agent-title" className="hs-chrome-title">
          {zh ? "一句话，一整条视频" : "ONE LINE. ONE FILM."}
        </h2>
        <p className="hs-chrome-body">
          {zh ? "说出你的想法，Agent 先拆成分镜和提示词，你确认后再生成。" : "Say the idea. The agent plans shots and prompts, and generates once you approve."}
        </p>
        <div className="hs-chrome-actions">
          <Link href={href("/creative-space")} className="hs-btn hs-btn-light">
            {zh ? "开始创作" : "Start creating"}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href={href("/creative-space/canvas")} className="hs-btn hs-btn-dark">
            {zh ? "打开画布" : "Open the canvas"}
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
        <Link href={href("/creative-space")} className="hs-see-all">
          {zh ? "查看全部" : "See all"}
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>

      {/* 4. Templates row */}
      <section className="hs-section" aria-labelledby="hs-templates-title">
        <div className="hs-head">
          <div>
            <h2 id="hs-templates-title" className="hs-title">{zh ? "AI 视频模板" : "AI VIDEO TEMPLATES"}</h2>
            <p className="hs-sub">{zh ? "挑一个模板，提示词直接填进上方的生成器，改几个词就能生成。" : "Pick a template and its prompt drops into the generator above."}</p>
          </div>
          <Link href={href("/templates")} className="hs-btn hs-btn-dark">
            {zh ? "查看全部模板" : "All templates"}
          </Link>
        </div>
        <div className="hs-tall-row">
          {HOME_TEMPLATES.slice(0, 5).map((template) => (
            <button key={template.id} type="button" className="hs-tall" onClick={() => onUseTemplate(template)}>
              <img src={template.image} alt="" loading="lazy" />
              <span className="hs-usecase-shade" aria-hidden="true" />
              <span className="hs-tall-title">{zh ? template.title.zh : template.title.en}</span>
              <span className="hs-tall-use">{zh ? "使用模板" : "Use template"}</span>
            </button>
          ))}
        </div>
      </section>

      {/* 5. Community (renders only when there are published works) */}
      <GallerySection variant="home" />

      {/* 6. Model walls with feature banners between them */}
      <ModelWall lang={lang} index={0} />
      <ModelWall lang={lang} index={1} />

      <section className="hs-banner hs-banner-canvas" aria-labelledby="hs-canvas-title">
        <div className="hs-banner-text">
          <span className="hs-banner-kicker">{zh ? "新功能" : "NEW"}</span>
          <h2 id="hs-canvas-title" className="hs-banner-title">
            {zh ? <>一块画布。<br />所有工作流。</> : <>One canvas.<br />Every workflow.</>}
          </h2>
          <p className="hs-banner-body">{zh ? "整理素材、用 @ 交给 Agent、生成并管理成片，都在一块画布上" : "Arrange assets, hand them to the agent with @, generate and keep it all in one place"}</p>
          <Link href={href("/creative-space/canvas")} className="hs-btn hs-btn-light">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {zh ? "体验画布" : "Try the canvas"}
          </Link>
        </div>
        <div className="hs-banner-art" aria-hidden="true">
          <img src={MEDIA.carpet.src} alt="" className="hs-banner-card hs-banner-card-a" loading="lazy" />
          <img src={MEDIA.dancer.src} alt="" className="hs-banner-card hs-banner-card-b" loading="lazy" />
          <span className="hs-banner-bubble">{zh ? "@画布 把这张图做成 8 秒视频" : "@canvas make this an 8s clip"}</span>
        </div>
      </section>

      <ModelWall lang={lang} index={2} />

      <section className="hs-banner hs-banner-photo" aria-labelledby="hs-photo-title">
        <div className="hs-banner-text">
          <span className="hs-banner-tag">KLING IMAGE 4.0</span>
          <h2 id="hs-photo-title" className="hs-banner-title">
            {zh ? <>不同场景<br />同一主角</> : <>New scenes,<br />same lead</>}
          </h2>
          <p className="hs-banner-body">{zh ? "上传角色参考图，一次生成整组画面" : "Upload a character reference and get a whole set at once"}</p>
          <Link href={href("/ai/image?model=kling-image-4")} className="hs-btn hs-btn-light">
            {zh ? "试试 Kling Image 4.0" : "Try Kling Image 4.0"}
          </Link>
        </div>
        <div className="hs-banner-fan" aria-hidden="true">
          {[MEDIA.rain, MEDIA.carpet, MEDIA.autumn, MEDIA.dreaming, MEDIA.dancer].map((media, index) => (
            <img key={media.src} src={media.src} alt="" loading="lazy" style={{ ["--i" as string]: index }} />
          ))}
        </div>
      </section>

      <ModelWall lang={lang} index={3} />
    </div>
  );
}

function ModelWall({ lang, index }: { lang: string; index: number }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const gallery = MODEL_GALLERIES[index];
  if (!gallery) return null;
  return (
    <section className="hs-section" aria-labelledby={`hs-wall-${gallery.id}`}>
      <div className="hs-head">
        <div>
          <h2 id={`hs-wall-${gallery.id}`} className="hs-title">{gallery.title}</h2>
          <p className="hs-sub">{zh ? gallery.body.zh : gallery.body.en}</p>
        </div>
        <Link href={localizedHref(lang, gallery.href)} className="hs-btn hs-btn-accent">
          {zh ? gallery.cta.zh : gallery.cta.en}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      <div className="hs-wall">
        {gallery.media.map((media, position) => {
          const prompt = SAMPLE_PROMPTS[media.src];
          const text = prompt ? (zh ? prompt.zh : prompt.en) : undefined;
          return (
            <WallCard
              key={`${gallery.id}-${position}`}
              media={media}
              href={localizedHref(lang, withPrompt(gallery.href, text))}
              prompt={text}
              cta={zh ? "做同款" : "Make one like this"}
              ratio={WALL_RATIOS[(position + index) % WALL_RATIOS.length]}
              position={position + index}
              zh={zh}
            />
          );
        })}
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

  // Show once the main generator has scrolled above the viewport, and hide
  // again while the footer is on screen. A passive scroll listener keeps this
  // working even when the page is not painting (background tabs).
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
