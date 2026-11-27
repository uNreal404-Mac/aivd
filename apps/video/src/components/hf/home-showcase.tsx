"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Film,
  Image as ImageIcon,
  Layers,
  Orbit,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { GallerySection } from "@/components/gallery/gallery-section";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import { CREATIVE_SKILLS } from "@/lib/creative-skills";
import { localizedHref } from "@/lib/du-home";
import {
  AI_CAPABILITY_PILLS,
  FEATURE_SLIDES,
  HOW_STEPS,
  MEDIA,
  MODEL_GALLERIES,
  PRODUCT_TILES,
  SAMPLE_PROMPTS,
  withExamplePrompt,
  withPrompt,
  type Bi,
  type ShowMedia,
} from "@/lib/home-showcase";
import { WallCard } from "@/components/hf/wall-card";
import { InViewVideo } from "@/components/hf/in-view-video";
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

type DiscoverTab = "all" | "video" | "image" | "effects";

type DiscoverItem = {
  id: string;
  tab: Exclude<DiscoverTab, "all">;
  media: ShowMedia;
  href: string;
  prompt?: Bi;
  promptId?: string;
};

function buildDiscoverItems(): DiscoverItem[] {
  const videoGallery = MODEL_GALLERIES[0];
  const imageGallery = MODEL_GALLERIES[1];

  return [
    { id: "d-dragon", tab: "video", media: MEDIA.dragon, href: videoGallery.href, promptId: MEDIA.dragon.promptId },
    { id: "d-japan", tab: "video", media: MEDIA.japan, href: videoGallery.href, promptId: MEDIA.japan.promptId },
    { id: "d-carpet", tab: "image", media: MEDIA.carpet, href: imageGallery.href, prompt: SAMPLE_PROMPTS[MEDIA.carpet.src] },
    { id: "d-whale", tab: "video", media: MEDIA.whaleOrigami, href: videoGallery.href, promptId: MEDIA.whaleOrigami.promptId },
    { id: "d-rain", tab: "image", media: MEDIA.rain, href: imageGallery.href, prompt: SAMPLE_PROMPTS[MEDIA.rain.src] },
    { id: "d-dress", tab: "video", media: MEDIA.dress, href: videoGallery.href, promptId: MEDIA.dress.promptId },
    { id: "d-bloom", tab: "effects", media: MEDIA.bloom, href: "/effects", prompt: SAMPLE_PROMPTS[MEDIA.bloom.src] },
    { id: "d-samurai", tab: "video", media: MEDIA.samuraiCat, href: videoGallery.href, promptId: MEDIA.samuraiCat.promptId },
    { id: "d-autumn", tab: "image", media: MEDIA.autumn, href: imageGallery.href, prompt: SAMPLE_PROMPTS[MEDIA.autumn.src] },
    { id: "d-fried", tab: "video", media: MEDIA.friedChicken, href: videoGallery.href, promptId: MEDIA.friedChicken.promptId },
    { id: "d-mech", tab: "effects", media: MEDIA.mech, href: "/effects", prompt: SAMPLE_PROMPTS[MEDIA.mech.src] },
    { id: "d-marina", tab: "video", media: MEDIA.marina, href: videoGallery.href, prompt: SAMPLE_PROMPTS[MEDIA.marina.src] },
    { id: "d-boy", tab: "image", media: MEDIA.boyDog, href: imageGallery.href, prompt: SAMPLE_PROMPTS[MEDIA.boyDog.src] },
    { id: "d-wind", tab: "effects", media: MEDIA.wind, href: "/effects", prompt: SAMPLE_PROMPTS[MEDIA.wind.src] },
    { id: "d-tomb", tab: "effects", media: MEDIA.tomb, href: "/effects", prompt: SAMPLE_PROMPTS[MEDIA.tomb.src] },
    { id: "d-dancer", tab: "image", media: MEDIA.dancer, href: imageGallery.href, prompt: SAMPLE_PROMPTS[MEDIA.dancer.src] },
  ];
}

const DISCOVER_ITEMS = buildDiscoverItems();

function mediaColumns<T extends { media: ShowMedia }>(items: readonly T[], count: number) {
  const columns: T[][] = Array.from({ length: count }, () => []);
  const heights = Array<number>(count).fill(0);
  for (const item of items) {
    const index = heights.indexOf(Math.min(...heights));
    columns[index].push(item);
    heights[index] += 1 / (item.media.aspectRatio ?? 1);
  }
  return columns;
}

function Media({ media, className, eager }: { media: ShowMedia; className?: string; eager?: boolean }) {
  return media.video ? (
    <InViewVideo className={className} src={media.src} poster={media.poster} documentGallery />
  ) : (
    <img className={className} src={media.src} alt="" loading={eager ? "eager" : "lazy"} decoding="async" />
  );
}

/** The release caption follows the frame so it never covers the subject. */
function SlideContent({ slide, eager, t }: { slide: (typeof FEATURE_SLIDES)[number]; eager: boolean; t: (value: Bi) => string }) {
  return (
    <>
      <span className="hs-slide-media">
        <Media media={slide.media} eager={eager} />
      </span>
      <span className="hs-slide-caption">
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
  const [discoverTab, setDiscoverTab] = useState<DiscoverTab>("all");
  const releaseTrackRef = useRef<HTMLDivElement>(null);
  const releaseCarousel = useCarousel(releaseTrackRef);
  const [discoveryColumns, setDiscoveryColumns] = useState(4);
  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 767px)");
    const tablet = window.matchMedia("(max-width: 1199px)");
    const update = () => setDiscoveryColumns(mobile.matches ? 2 : tablet.matches ? 3 : 4);
    update();
    const queries = [mobile, tablet];
    queries.forEach(query => query.addEventListener("change", update));
    return () => queries.forEach(query => query.removeEventListener("change", update));
  }, []);
  const visibleDiscover =
    discoverTab === "all"
      ? DISCOVER_ITEMS
      : DISCOVER_ITEMS.filter((item) => item.tab === discoverTab);

  const agentCases = CREATIVE_SKILLS.slice(0, 4);

  return (
    <div className="hs">
      <ScrollReveal />

      <section className="hs-shell hs-releases" aria-label={zh ? "最新功能" : "Featured releases"}>
        <div className="hs-release-rail">
          <div className="hs-release-grid" ref={releaseTrackRef}>
            {FEATURE_SLIDES.map((slide, index) =>
              slide.media.video ? (
                <div key={slide.href} className="hs-slide" style={{ "--hs-media-ratio": slide.media.aspectRatio } as CSSProperties} data-video-scope>
                  <Link href={href(slide.href)} className="hs-slide-link">
                    <SlideContent slide={slide} eager={index === 0} t={t} />
                  </Link>
                </div>
              ) : (
                <Link key={slide.href} href={href(slide.href)} className="hs-slide" style={{ "--hs-media-ratio": slide.media.aspectRatio } as CSSProperties}>
                  <SlideContent slide={slide} eager={index === 0} t={t} />
                </Link>
              ),
            )}
          </div>
          <CarouselArrows zh={zh} {...releaseCarousel} />
        </div>
      </section>

      <div className="hs-shell hs-stack">
        {/* 2. Pure Frameless Edge-to-Edge Discovery Gallery (Jimeng × Higgsfield Visual Immersion) */}
        <section className="hs-section" aria-labelledby="hs-discover-title">
          <div className="hs-head">
            <div>
              <h2 id="hs-discover-title" className="hs-title">
                {zh ? "精选灵感" : "Explore Creations"}
              </h2>
              <p className="hs-sub">
                {zh ? "选择作品，可在生成器中打开同款提示词。" : "Choose a creation to open its prompt in the studio."}
              </p>
            </div>
            <div className="hs-tabs" role="tablist" aria-label={zh ? "作品分类" : "Category filter"}>
              {(
                [
                  ["all", zh ? "全部精选" : "All"],
                  ["video", zh ? "动态视频" : "Video"],
                  ["image", zh ? "图像" : "Image"],
                  ["effects", zh ? "视觉特效" : "VFX"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={discoverTab === key}
                  onClick={() => setDiscoverTab(key)}
                  className={discoverTab === key ? "hs-tab hs-tab-active" : "hs-tab"}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="hs-discover-masonry">
            {mediaColumns(visibleDiscover, discoveryColumns).map((column, columnIndex) => (
              <div className="hs-discover-column" key={columnIndex}>
                {column.map((item, index) => {
                  const promptText = item.prompt ? t(item.prompt) : undefined;
                  const target = item.promptId ? withExamplePrompt(item.href, item.promptId) : withPrompt(item.href, promptText);
                  return (
                    <WallCard
                      key={item.id}
                      media={item.media}
                      href={localizedHref(lang, target)}
                      prompt={promptText}
                      cta={zh ? "做同款" : "Recreate"}
                      ratio={String(item.media.aspectRatio ?? 1)}
                      position={index}
                      zh={zh}
                      showPlayToggle={false}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          <div className="hs-more-row">
            <Link href={href("/gallery")} className="hs-quiet-link">
              {zh ? "探索全部社区作品" : "Explore full community gallery"}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </section>

        {/* 3. Quiet Matte Studio Suite (Linear × Krea Restraint — zero cartoon arcs or glowing borders) */}
        <section className="hs-section" aria-labelledby="hs-suite-title">
          <div className="hs-head">
            <div>
              <h2 id="hs-suite-title" className="hs-title">
                {zh ? "核心创作引擎" : "Core Creative Engines"}
              </h2>
              <p className="hs-sub">
                {zh ? "聚合全球一线视频、图像、音频模型，按次透明计费，失败自动退积分。" : "Frontier video, image, and audio models in one workspace with transparent per-run credits."}
              </p>
            </div>
            <Link href={href("/pricing")} className="hs-quiet-link">
              {zh ? "查看积分定价" : "View pricing"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="hs-suite-grid">
            <Link href={href("/pricing")} className="hs-welcome-card">
              <span className="hs-welcome-kicker">{zh ? "新用户礼遇" : "WELCOME GIFT"}</span>
              <span className="hs-welcome-num">+{NEW_USER_GIFT.credits}</span>
              <span className="hs-welcome-title">{zh ? `注册即送 ${NEW_USER_GIFT.credits} 积分` : `${NEW_USER_GIFT.credits} free credits`}</span>
              <span className="hs-welcome-body">{zh ? "可免费体验第一条 1080P 有声视频" : "Generate your first 1080p audio clip free"}</span>
              <span className="hs-welcome-cta">
                {zh ? "免费开始" : "Start free"}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>

            <div className="hs-tiles">
              {PRODUCT_TILES.map((tile) => {
                const Icon = TILE_ICONS[tile.icon];
                return (
                  <Link key={tile.href} href={href(tile.href)} className="hs-tile">
                    <span className="hs-tile-top">
                      <span className="hs-tile-icon-box" aria-hidden="true">
                        <Icon className="hs-tile-icon" />
                      </span>
                      <ArrowUpRight className="hs-tile-arrow" aria-hidden="true" />
                    </span>
                    <span className="hs-tile-copy">
                      <span className="hs-tile-title">
                        {typeof tile.title === "string" ? tile.title : t(tile.title)}
                        {tile.tag ? <span className="hs-tile-tag">{tile.tag}</span> : null}
                      </span>
                      <span className="hs-tile-body">{t(tile.body)}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. Two Clean Architectural Spotlights: Infinite Canvas & Director Agent */}
        <section className="hs-spotlights" aria-label={zh ? "核心工作流" : "Core workflows"}>
          <div className="hs-spot">
            <div className="hs-spot-copy">
              <span className="hs-spot-kicker">{zh ? "无限画布 · CANVAS" : "INFINITE CANVAS"}</span>
              <h2 className="hs-spot-title">
                {zh ? (
                  <>
                    一块画布，
                    <br />
                    串联所有工作流
                  </>
                ) : (
                  <>
                    One canvas,
                    <br />
                    every workflow
                  </>
                )}
              </h2>
              <p className="hs-spot-body">
                {zh
                  ? "在同一块无界画布上整理参考图、拼接视频与 4K 修图节点，用 @ 随时召唤 Agent 协同创作。"
                  : "Organize references, connect video and 4K image nodes, and @mention the Agent in one continuous space."}
              </p>
              <div className="hs-spot-actions">
                <Link href={href("/creative-space/canvas")} className="hs-btn hs-btn-light">
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                  {zh ? "打开无限画布" : "Open Canvas"}
                </Link>
              </div>
            </div>
            <div className="hs-spot-visual hs-spot-canvas-visual" aria-hidden="true">
              <div className="hs-spot-pair">
                <figure className="hs-spot-frame">
                  <img src="/canvas/templates/character.webp" alt="" loading="lazy" />
                </figure>
                <figure className="hs-spot-frame">
                  <img src="/canvas/templates/three-act.webp" alt="" loading="lazy" />
                </figure>
              </div>
              <span className="hs-spot-prompt-pill">
                <span className="hs-accent">@画布</span> {zh ? "将这两张参考图合成为 8 秒电影运镜视频" : "Blend these references into an 8s cinema shot"}
              </span>
            </div>
          </div>

          <div className="hs-spot">
            <div className="hs-spot-copy">
              <span className="hs-spot-kicker">AGENT</span>
              <h2 className="hs-spot-title">
                {zh ? (
                  <>
                    一句话，
                    <br />
                    自动拆解分镜成片
                  </>
                ) : (
                  <>
                    One prompt,
                    <br />
                    a full storyboard
                  </>
                )}
              </h2>
              <p className="hs-spot-body">
                {zh
                  ? "只需描述你的故事想法，导演 Agent 自动规划镜头脚本、分镜画面与运镜提示词，确认后一键生成。"
                  : "Describe your story once. The agent drafts shot lists, keyframes, and camera prompts before rendering."}
              </p>
              <div className="hs-spot-actions">
                <Link href={href("/creative-space")} className="hs-btn hs-btn-accent">
                  {zh ? "与 AGENT 对话" : "Chat with AGENT"}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href={href("/templates")} className="hs-btn hs-btn-ghost">
                  {zh ? "浏览模板" : "Templates"}
                </Link>
              </div>
            </div>
            <div className="hs-spot-quad">
              {agentCases.map((skill) => (
                <Link
                  key={skill.id}
                  href={href(`/creative-space/canvas?prompt=${encodeURIComponent(zh ? skill.brief.zh : skill.brief.en)}`)}
                  className="hs-spot-quad-item"
                >
                  <img src={skill.image} alt="" loading="lazy" />
                  <span className="hs-spot-quad-shade" aria-hidden="true" />
                  <span className="hs-spot-quad-label">{zh ? skill.title.zh : skill.title.en}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Community Showcase (renders when user-published works exist) */}
        <GallerySection variant="home" />

        {/* 6. Quiet 3-Step Horizontal Guide (clean typographic rhythm, zero boxes) */}
        <section className="hs-how-section" aria-labelledby="hs-how-title">
          <div className="hs-head">
            <h2 id="hs-how-title" className="hs-title">
              {zh ? "三步完成创作" : "Three steps to your clip"}
            </h2>
            <p className="hs-sub">{zh ? "从一个想法到一条成片，无需复杂参数。" : "From a single line to a finished video."}</p>
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

        {/* 7. Quiet Capabilities Index */}
        <section className="hs-cloud-section" aria-labelledby="hs-cloud-title">
          <h2 id="hs-cloud-title" className="hs-cloud-title">
            {zh ? "更多创作能力" : "Explore capabilities"}
          </h2>
          <div className="hs-cloud-list">
            {AI_CAPABILITY_PILLS.map((pill) => (
              <Link key={`${pill.href}-${pill.label.en}`} href={href(pill.href)} className="hs-cloud-pill">
                {t(pill.label)}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
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

/** Quiet corner button taking the visitor smoothly back to the Hero generator. */
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
