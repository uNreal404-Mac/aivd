"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Clapperboard,
  Film,
  Image as ImageIcon,
  ImagePlus,
  LayoutGrid,
  Palette,
  PenLine,
  Play,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { StudioHero } from "./studio-hero";
import studio from "./studio-hero.module.css";
import { GallerySection } from "@/components/gallery/gallery-section";
import {
  CATEGORY_FILTERS,
  CREDITS_BANNER,
  EFFECT_CARDS,
  MODEL_CARDS,
  MODELS_HEADER,
  localizedHref,
  type Cta,
  type CtaVariant,
  type SectionHeader,
} from "@/lib/du-home";

const ICONS: Record<string, LucideIcon> = {
  Sparkles,
  Play,
  CirclePlay,
  Clapperboard,
  ImagePlus,
  Image: ImageIcon,
  LayoutGrid,
  Zap,
  Film,
  Palette,
  PenLine,
  SlidersHorizontal,
  Share2,
  ArrowRight,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Sparkles;
  return <Cmp className={className} aria-hidden="true" />;
}

function ctaClasses(variant: CtaVariant): string {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors";
  if (variant === "primary") {
    return `${base} h-12 px-6 bg-[var(--du-accent)] text-[var(--du-on-accent)] shadow-[var(--du-glow)] hover:bg-[var(--du-accent-hover)]`;
  }
  if (variant === "outline") {
    return `${base} du-glass-btn h-12 px-6`;
  }
  return `${base} text-[var(--du-accent-text)] hover:text-[var(--du-accent)]`;
}

function CtaButton({ cta, lang }: { cta: Cta; lang: string }) {
  return (
    <Link href={localizedHref(lang, cta.href)} className={ctaClasses(cta.variant)}>
      <Icon name={cta.icon} className="h-4 w-4" />
      {cta.label}
    </Link>
  );
}

function SectionHeading({
  header,
  action,
}: {
  header: SectionHeader;
  action?: ReactNode;
}) {
  const lead = header.title.slice(0, header.title.length - header.accent.length);
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-[560px]">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--du-text-dim)]">
          {header.eyebrow}
        </p>
        <h2 className="mt-3 text-[32px] font-bold leading-tight text-[var(--du-text)] sm:text-[40px]">
          {lead}
          <span className="text-[var(--du-accent-text)]">{header.accent}</span>
        </h2>
      </div>
      <div className="flex flex-col gap-2 md:items-end">
        <p className="max-w-[320px] text-sm text-[var(--du-text-muted)] md:text-right">
          {header.desc}
        </p>
        {action}
      </div>
    </div>
  );
}

interface FeatureStripProps {
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  images: string[];
}

function FeatureStrip({
  eyebrow,
  title,
  description,
  cta,
  href,
  images,
}: FeatureStripProps) {
  return (
    <Link href={href} className={studio.feature}>
      <div>
        <span className={studio.featureLabel}>{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <span className={studio.featureAction}>
          {cta} <ArrowRight size={15} aria-hidden="true" />
        </span>
      </div>
      <div className={studio.contactSheet} aria-hidden="true">
        {images.map((image) => <img key={image} src={image} alt="" loading="lazy" />)}
      </div>
    </Link>
  );
}

const CATEGORY_DECK_FILTERS = CATEGORY_FILTERS.filter((filter) => filter !== "All");

const CATEGORY_DECK_IMAGES: Record<string, string> = {
  Cinematic: "/home/golden-hour.webp",
  Anime: "/home/first-steps.webp",
  Portrait: "/home/silver-muse.webp",
  Fantasy: "/home/edge-of-space.webp",
  "Sci-Fi": "/home/neon-streets.webp",
  Nature: "/home/coast-drive.webp",
  Stylize: "/home/liquid-light.webp",
  More: "/home/glass-city.webp",
};

function circularCategoryOffset(index: number, activeIndex: number, count: number) {
  let offset = (index - activeIndex + count) % count;
  if (offset > count / 2) offset -= count;
  return offset;
}

function categoryCardStyle(
  index: number,
  activeIndex: number,
  count: number,
  hoveredIndex: number | null
): CSSProperties {
  const offset = circularCategoryOffset(index, activeIndex, count);
  const distance = Math.abs(offset);

  if (distance >= 4) {
    return {
      left: "50%",
      opacity: 0,
      pointerEvents: "none",
      transform: "translateX(-50%) translateY(96px) scale(0.5) rotateY(55deg)",
      zIndex: 0,
    };
  }

  const direction = offset < 0 ? -1 : offset > 0 ? 1 : 0;
  const horizontalPositions = [
    "0px",
    "clamp(118px,15vw,220px)",
    "clamp(210px,27vw,400px)",
    "clamp(285px,38vw,555px)",
  ];
  const verticalPositions = [-22, 10, 42, 72];
  const scales = [1.08, 0.93, 0.79, 0.65];
  const rotateY = [0, 18, 32, 44];
  const rotateZ = [0, 4, 7, 10];
  const opacities = [1, 0.94, 0.72, 0.42];

  let y = verticalPositions[distance];
  let scale = scales[distance];
  let zRotation = direction * -rotateZ[distance];
  let xNudge = 0;
  let zIndex = 40 - distance * 10;

  if (hoveredIndex !== null) {
    const hoverOffset = circularCategoryOffset(index, hoveredIndex, count);
    const hoverDistance = Math.abs(hoverOffset);
    if (hoverDistance === 0) {
      y -= 24;
      scale += 0.055;
      zRotation *= 0.3;
      zIndex = 60;
    } else if (hoverDistance <= 2) {
      const hoverDirection = hoverOffset < 0 ? -1 : 1;
      xNudge = hoverDirection * (18 - hoverDistance * 4);
      zRotation += hoverDirection * -Math.max(4, 12 - hoverDistance * 3);
      y += hoverDistance * 5;
    }
  }

  const horizontalPosition = horizontalPositions[distance];
  const xTransform =
    direction === 0
      ? "-50%"
      : `calc(-50% ${direction > 0 ? "+" : "-"} ${horizontalPosition})`;

  return {
    filter:
      distance >= 3
        ? "brightness(0.64) blur(0.8px)"
        : distance === 2
          ? "brightness(0.8)"
          : "none",
    left: "50%",
    opacity: opacities[distance],
    pointerEvents: "auto",
    transform: `translateX(${xTransform}) translateX(${xNudge}px) translateY(${y}px) scale(${scale}) rotateY(${direction * -rotateY[distance]}deg) rotateZ(${zRotation}deg)`,
    zIndex,
  };
}

function effectOrbitStyle(index: number, activeIndex: number, count: number): CSSProperties {
  const offset = circularCategoryOffset(index, activeIndex, count);
  const distance = Math.abs(offset);
  const direction = offset < 0 ? -1 : offset > 0 ? 1 : 0;
  const horizontalPositions = [
    "0px",
    "clamp(118px,18vw,275px)",
    "clamp(205px,31vw,475px)",
    "0px",
  ];
  const verticalPositions = [48, 30, -48, -138];
  const scales = [1.08, 0.82, 0.62, 0.5];
  const opacities = [1, 0.94, 0.67, 0.38];
  const rotateY = [0, 23, 38, 0];
  const rotateZ = [0, 2.5, 5, 0];
  const xTransform =
    direction === 0 || distance === 3
      ? "-50%"
      : `calc(-50% ${direction > 0 ? "+" : "-"} ${horizontalPositions[distance]})`;

  return {
    filter:
      distance === 3
        ? "brightness(0.52) blur(1.2px)"
        : distance === 2
          ? "brightness(0.72) blur(0.4px)"
          : distance === 1
            ? "brightness(0.88)"
            : "none",
    left: "50%",
    opacity: opacities[distance],
    transform: `translateX(${xTransform}) translateY(calc(-50% + ${verticalPositions[distance]}px)) scale(${scales[distance]}) rotateY(${direction * -rotateY[distance]}deg) rotateZ(${direction * -rotateZ[distance]}deg)`,
    zIndex: 50 - distance * 12,
  };
}

export function DuHome({ lang }: { lang: string }) {
  const [active, setActive] = useState("Fantasy");
  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
  const [activeEffectIndex, setActiveEffectIndex] = useState(0);
  const isChinese = lang.toLowerCase().startsWith("zh");
  const activeCategoryIndex = Math.max(0, CATEGORY_DECK_FILTERS.indexOf(active));
  const showPreviousCategory = () =>
    setActive(
      CATEGORY_DECK_FILTERS[
        (activeCategoryIndex - 1 + CATEGORY_DECK_FILTERS.length) % CATEGORY_DECK_FILTERS.length
      ]
    );
  const showNextCategory = () =>
    setActive(CATEGORY_DECK_FILTERS[(activeCategoryIndex + 1) % CATEGORY_DECK_FILTERS.length]);
  const showPreviousEffect = () =>
    setActiveEffectIndex(
      (current) => (current - 1 + EFFECT_CARDS.length) % EFFECT_CARDS.length
    );
  const showNextEffect = () =>
    setActiveEffectIndex((current) => (current + 1) % EFFECT_CARDS.length);

  const featureCopy = isChinese
    ? {
        social: {
          eyebrow: "热门视频模板",
          title: "挑一种镜头风格。",
          description: "从社区热门短片中挑选灵感，一键带入模板，再换成你自己的画面。",
          cta: "探索视频模板",
        },
        image: {
          eyebrow: "热门图片灵感",
          title: "定格你的幻想时刻",
          description: "浏览适合社交媒体的视觉风格，为下一张作品找到构图与氛围。",
          cta: "探索图片灵感",
        },
        cinema: {
          eyebrow: "影视级长视频",
          title: "在工作台里编排镜头。",
          description: "进入专业创作工作台，把更完整的故事发展成有电影感的画面。",
          cta: "进入视频工作台",
        },
      }
    : {
        social: {
          eyebrow: "Trending video templates",
          title: "Find a visual style.",
          description: "Start from community favorites, bring a template into the studio, then make every frame your own.",
          cta: "Explore video templates",
        },
        image: {
          eyebrow: "Trending image ideas",
          title: "Frame the moments you imagine",
          description: "Explore social-ready visual directions and find the composition and mood for your next image.",
          cta: "Explore image ideas",
        },
        cinema: {
          eyebrow: "Cinematic long-form video",
          title: "Give your dreams a bigger screen",
          description: "Move into the full studio and shape a longer idea into a more cinematic visual story.",
          cta: "Open the video studio",
        },
      };

  const homeCopy = isChinese
    ? {
        filters: {
          All: "全部",
          Cinematic: "电影感",
          Anime: "动漫",
          Portrait: "人像",
          Fantasy: "幻想",
          "Sci-Fi": "科幻",
          Nature: "自然",
          Stylize: "风格化",
          More: "更多",
        } as Record<string, string>,
        modelsHeader: {
          eyebrow: "我们的模型",
          title: "为每一帧选择合适的模型。",
          accent: "合适的模型。",
          desc: "无论写实还是风格化，都能找到适合你创意的生成引擎。",
        },
        modelTitles: {
          "video-lite": "轻量视频",
          "video-pro": "专业视频",
          "image-studio": "图像工作室",
          "anime-style": "动漫与风格",
        } as Record<string, string>,
        modelDescriptions: {
          "video-lite": "快速生成日常短片，适合灵感草稿与即时创作。",
          "video-pro": "为成片提供更具电影感的运动与画面细节。",
          "image-studio": "根据文字或参考图生成细腻的静态画面。",
          "anime-style": "用鲜明的风格与视觉语言打造出众画面。",
        } as Record<string, string>,
        effectTitles: {
          "float-away": "轻盈漂浮",
          "style-swap": "风格切换",
          "fire-light": "火光",
          "world-grow": "世界生长",
          "orbit-360": "360° 环绕",
          "slow-time": "慢时光",
        } as Record<string, string>,
        learnMore: "了解更多 →",
        browseEffects: "查看特效库",
        creditsLead: "使用",
        creditsAccent: "免费积分开始创作。",
        creditsSubtitle: "无需信用卡，把你的下一个灵感变成真实作品。",
        creditsCta: "领取免费积分 →",
      }
    : {
        filters: Object.fromEntries(CATEGORY_FILTERS.map((item) => [item, item])) as Record<string, string>,
        modelsHeader: MODELS_HEADER,
        modelTitles: {} as Record<string, string>,
        modelDescriptions: {} as Record<string, string>,
        effectTitles: {} as Record<string, string>,
        learnMore: "Learn more →",
        browseEffects: "Browse effects",
        creditsLead: "Start creating with ",
        creditsAccent: "free credits.",
        creditsSubtitle: CREDITS_BANNER.subtitle,
        creditsCta: CREDITS_BANNER.cta.label,
      };

  return (
    <div className={studio.home}>
      <StudioHero lang={lang} />

      {/* 2. Category wall */}
      <section className={studio.section}>
        <FeatureStrip
          {...featureCopy.social}
          href={localizedHref(lang, "/gallery")}
          images={["/home/golden-hour.webp", "/home/neon-streets.webp", "/home/coast-drive.webp"]}
        />
        <div
          className="relative mt-8 h-[clamp(370px,42vw,610px)] overflow-hidden [perspective:1500px] [perspective-origin:50%_38%]"
          onMouseLeave={() => setHoveredCategory(null)}
        >
          <span className="pointer-events-none absolute inset-x-[5%] bottom-[7%] h-[30%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(118,70,255,0.25),rgba(102,252,241,0.1)_35%,transparent_72%)] blur-2xl" />
          <span className="pointer-events-none absolute inset-x-[10%] bottom-[9%] h-px bg-gradient-to-r from-transparent via-white/35 to-transparent shadow-[0_0_28px_rgba(102,252,241,0.45)]" />
          <div className="absolute inset-x-0 bottom-[15%] top-[8%] [transform-style:preserve-3d]">
            {CATEGORY_DECK_FILTERS.map((filter, index) => {
              const isActive = filter === active;
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActive(filter)}
                  onMouseEnter={() => setHoveredCategory(index)}
                  onFocus={() => setHoveredCategory(index)}
                  onBlur={() => setHoveredCategory(null)}
                  style={categoryCardStyle(
                    index,
                    activeCategoryIndex,
                    CATEGORY_DECK_FILTERS.length,
                    hoveredCategory
                  )}
                  className={`group absolute top-0 h-[clamp(255px,29vw,430px)] w-[clamp(168px,19vw,286px)] overflow-hidden rounded-[26px] border text-left shadow-[0_24px_62px_rgba(0,0,0,0.68)] transition-[transform,opacity,border-color,box-shadow,filter] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
                    isActive
                      ? "border-white/80 shadow-[0_0_18px_rgba(255,255,255,0.5),0_0_42px_rgba(127,92,255,0.72),0_26px_65px_rgba(0,0,0,0.58)]"
                      : "border-white/25 hover:border-white/75 hover:shadow-[0_0_22px_rgba(102,252,241,0.4),0_0_52px_rgba(118,70,255,0.62),0_28px_70px_rgba(0,0,0,0.62)]"
                  }`}
                >
                  <img
                    src={CATEGORY_DECK_IMAGES[filter]}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full scale-110 object-cover blur-[1px] saturate-125 transition-[transform,filter] duration-700 ease-out group-hover:scale-[1.2] group-hover:blur-0"
                  />
                  <span className="absolute inset-0 bg-gradient-to-b from-indigo-950/5 via-black/10 to-black/80" />
                  <span className="absolute inset-[1px] rounded-[24px] border border-white/20 bg-gradient-to-br from-white/20 via-transparent to-cyan-300/15 backdrop-blur-[2px]" />
                  <span className="pointer-events-none absolute -left-1/2 top-0 h-full w-1/2 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/25 to-transparent opacity-0 blur-md transition-[left,opacity] duration-700 group-hover:left-[130%] group-hover:opacity-100" />
                  <span className="absolute left-4 top-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="absolute inset-x-4 bottom-5 pr-9">
                    <span className="block text-lg font-semibold tracking-[-0.02em] text-white sm:text-xl">
                      {homeCopy.filters[filter] ?? filter}
                    </span>
                    <span
                      className={`mt-3 block h-[2px] rounded-full transition-all duration-500 ${
                        isActive
                          ? "w-full bg-[var(--du-accent)] shadow-[0_0_14px_var(--du-accent)]"
                          : "w-9 bg-white/55 group-hover:w-full group-hover:bg-[var(--du-accent)]"
                      }`}
                    />
                  </span>
                  <span className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/55 bg-black/15 text-white shadow-[0_0_18px_rgba(255,255,255,0.18)] backdrop-blur-md transition-transform duration-300 group-hover:scale-110">
                    <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
          <div className="absolute inset-x-0 bottom-2 z-[70] flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={showPreviousCategory}
              aria-label={isChinese ? "上一个分类" : "Previous category"}
              className="du-glass-btn flex h-11 w-11 items-center justify-center rounded-full"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="min-w-20 text-center text-xs font-medium tracking-[0.18em] text-[var(--du-text-muted)]">
              {String(activeCategoryIndex + 1).padStart(2, "0")} /{" "}
              {String(CATEGORY_DECK_FILTERS.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={showNextCategory}
              aria-label={isChinese ? "下一个分类" : "Next category"}
              className="du-glass-btn flex h-11 w-11 items-center justify-center rounded-full"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* 3. Effect cards */}
      <section className={studio.section}>
        <FeatureStrip
          {...featureCopy.image}
          href={localizedHref(lang, "/explore")}
          images={["/home/silver-muse.webp", "/home/glass-city.webp", "/home/liquid-light.webp"]}
        />
        <div className="relative mt-8 h-[clamp(430px,55vw,760px)] overflow-hidden rounded-[32px] border border-[var(--du-border)] bg-[radial-gradient(circle_at_50%_45%,rgba(45,35,112,0.3),rgba(3,5,14,0.82)_48%,rgba(0,0,0,0.96)_78%)] [perspective:1500px] [perspective-origin:50%_42%]">
          <span className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(102,252,241,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(102,252,241,0.25)_1px,transparent_1px)] [background-size:48px_48px]" />
          <span className="pointer-events-none absolute left-1/2 top-[54%] h-[48%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-violet-400/55 shadow-[0_0_18px_rgba(111,88,255,0.55),inset_0_0_22px_rgba(87,202,255,0.18)] [transform:translate(-50%,-50%)_rotateX(67deg)]" />
          <span className="pointer-events-none absolute left-[6%] top-[54%] h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_12px_4px_rgba(102,252,241,0.9)]" />
          <span className="pointer-events-none absolute right-[6%] top-[54%] h-3 w-3 rounded-full bg-violet-200 shadow-[0_0_12px_4px_rgba(167,121,255,0.9)]" />
          <span className="pointer-events-none absolute inset-x-[14%] bottom-[3%] h-[25%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(128,76,255,0.2),rgba(67,197,255,0.09)_38%,transparent_72%)] blur-2xl" />

          <div className="pointer-events-none absolute left-1/2 top-[5%] z-[70] -translate-x-1/2">
            <div className="relative rounded-full border border-cyan-200/70 bg-[var(--du-surface)]/80 px-6 py-3 text-center shadow-[0_0_18px_rgba(88,196,255,0.45),0_0_34px_rgba(132,80,255,0.3)] backdrop-blur-xl">
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/65">
                {isChinese ? "当前特效" : "Selected effect"}
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-sm font-semibold text-white sm:text-base">
                {homeCopy.effectTitles[EFFECT_CARDS[activeEffectIndex].id] ??
                  EFFECT_CARDS[activeEffectIndex].title}
              </span>
              <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-cyan-200/70 bg-[var(--du-surface)]/90" />
            </div>
          </div>

          <div className="absolute inset-0 [transform-style:preserve-3d]">
            {EFFECT_CARDS.map((effect, index) => {
              const isActiveEffect = index === activeEffectIndex;
              const effectTitle = homeCopy.effectTitles[effect.id] ?? effect.title;
              return (
                <div
                  key={effect.id}
                  style={effectOrbitStyle(index, activeEffectIndex, EFFECT_CARDS.length)}
                  className={`group absolute top-1/2 h-[clamp(220px,25vw,380px)] w-[clamp(150px,19vw,290px)] overflow-hidden rounded-[28px] border transition-[transform,opacity,filter,border-color,box-shadow] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform ${
                    isActiveEffect
                      ? "border-white/80 shadow-[0_0_18px_rgba(255,255,255,0.55),0_0_48px_rgba(96,107,255,0.72),0_30px_75px_rgba(0,0,0,0.75)]"
                      : "border-white/25 shadow-[0_18px_50px_rgba(0,0,0,0.68)] hover:border-cyan-200/70"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveEffectIndex(index)}
                    aria-pressed={isActiveEffect}
                    aria-label={effectTitle}
                    className="absolute inset-0 z-10 text-left"
                  >
                    <img
                      src={effect.image}
                      alt={isChinese ? effectTitle : effect.alt}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full scale-110 object-cover saturate-125 transition-transform duration-700 group-hover:scale-[1.18]"
                    />
                    <span className="absolute inset-0 bg-gradient-to-b from-indigo-950/5 via-black/5 to-black/80" />
                    <span className="absolute inset-[1px] rounded-[26px] border border-white/20 bg-gradient-to-br from-cyan-200/20 via-transparent to-fuchsia-300/20 backdrop-blur-[1px]" />
                    <span className="absolute inset-x-4 bottom-5 pr-8 text-base font-semibold text-white sm:text-lg">
                      {effectTitle}
                    </span>
                    <span className="absolute bottom-4 right-4 flex h-9 w-9 items-center justify-center rounded-full border border-white/65 bg-black/20 text-white backdrop-blur-md">
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    </span>
                  </button>
                  {isActiveEffect ? (
                    <Link
                      href={localizedHref(lang, effect.href)}
                      className="du-glass-btn du-glass-on-media absolute bottom-16 left-4 z-20 inline-flex h-9 items-center rounded-full px-4 text-xs"
                    >
                      {homeCopy.browseEffects}
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="absolute inset-x-0 bottom-4 z-[80] flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={showPreviousEffect}
              aria-label={isChinese ? "上一个特效" : "Previous effect"}
              className="du-glass-btn flex h-11 w-11 items-center justify-center rounded-full"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <span className="min-w-20 text-center text-xs font-medium tracking-[0.18em] text-[var(--du-text-muted)]">
              {String(activeEffectIndex + 1).padStart(2, "0")} /{" "}
              {String(EFFECT_CARDS.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={showNextEffect}
              aria-label={isChinese ? "下一个特效" : "Next effect"}
              className="du-glass-btn flex h-11 w-11 items-center justify-center rounded-full"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* 4. Model cards (moved from above) */}
      <section className={studio.section}>
        <FeatureStrip
          {...featureCopy.cinema}
          href={localizedHref(lang, "/ai/video")}
          images={["/home/video-pro.webp", "/home/planet-horizon.webp", "/home/edge-of-space.webp"]}
        />
        <div className="mt-12">
          <SectionHeading header={homeCopy.modelsHeader} />
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODEL_CARDS.map((model) => (
            <div key={model.id} className="du-glass flex flex-col p-4">
              <div className="flex items-center gap-2">
                <Icon name={model.icon} className="h-5 w-5 text-[var(--du-accent-text)]" />
                <h3 className="text-base font-semibold text-[var(--du-text)]">
                  {homeCopy.modelTitles[model.id] ?? model.title}
                </h3>
              </div>
              <div className="mt-3 aspect-[16/10] overflow-hidden rounded-lg">
                <img
                  src={model.image}
                  alt={isChinese ? homeCopy.modelTitles[model.id] ?? model.alt : model.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-3 flex-1 text-sm text-[var(--du-text-muted)]">
                {homeCopy.modelDescriptions[model.id] ?? model.description}
              </p>
              <div className="mt-4 flex justify-end">
                <Link
                  href={localizedHref(lang, model.href)}
                  className="du-glass-btn inline-flex h-9 items-center px-3 text-xs"
                >
                  {homeCopy.learnMore}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Gallery */}
      <GallerySection />

      {/* 6. Free credits banner */}
      <section className="mx-auto max-w-[1680px] px-6 pb-16">
        <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-[var(--du-border-strong)]">
          <img
            src={CREDITS_BANNER.image}
            alt={CREDITS_BANNER.alt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-black/60" />
          <div className="relative flex min-h-[220px] max-w-[560px] flex-col justify-center gap-4 p-8">
            <h2 className="text-[32px] font-bold text-[var(--du-text)]">
              {homeCopy.creditsLead}
              <span className="text-[var(--du-accent-text)]">
                {homeCopy.creditsAccent}
              </span>
            </h2>
            <p className="text-sm text-[var(--du-text-muted)]">
              {homeCopy.creditsSubtitle}
            </p>
            <div>
              <CtaButton
                cta={{ ...CREDITS_BANNER.cta, label: homeCopy.creditsCta }}
                lang={lang}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
