"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock3,
  CirclePlay,
  Clapperboard,
  Film,
  Image as ImageIcon,
  ImagePlus,
  LayoutGrid,
  Maximize,
  Palette,
  PenLine,
  Play,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { GallerySection } from "@/components/gallery/gallery-section";
import { HomeStudioStory } from "@/components/hf/home-studio-story";
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
  tone: "cyan" | "amber" | "violet";
}

function FeatureStrip({
  eyebrow,
  title,
  description,
  cta,
  href,
  images,
  tone,
}: FeatureStripProps) {
  const glow =
    tone === "cyan"
      ? "from-cyan-400/25 via-transparent to-transparent"
      : tone === "amber"
        ? "from-amber-400/25 via-transparent to-transparent"
        : "from-violet-400/25 via-transparent to-transparent";

  return (
    <Link
      href={href}
      className="group relative block min-h-[280px] overflow-hidden rounded-[28px] border border-[var(--du-border-strong)] bg-[var(--du-surface)] sm:min-h-[320px] lg:min-h-[360px]"
    >
      <span className={`pointer-events-none absolute inset-0 bg-gradient-to-r ${glow}`} />
      <span className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(var(--du-border-strong)_1px,transparent_1px),linear-gradient(90deg,var(--du-border-strong)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="absolute inset-y-0 right-0 w-[58%] overflow-hidden sm:w-[62%]">
        <div className="absolute inset-0 grid grid-cols-3 gap-2 p-4 pl-0 sm:gap-3 sm:p-6 sm:pl-0">
          {images.slice(0, 3).map((image, index) => (
            <div
              key={image}
              className={`relative overflow-hidden rounded-2xl border border-white/10 ${
                index === 1 ? "translate-y-5" : index === 2 ? "-translate-y-3" : "translate-y-1"
              }`}
            >
              <img
                src={image}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
            </div>
          ))}
        </div>
        <span className="absolute inset-0 bg-gradient-to-r from-[var(--du-surface)] via-[var(--du-surface)]/60 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-[280px] max-w-[620px] flex-col justify-center p-7 sm:min-h-[320px] sm:p-10 lg:min-h-[360px] lg:p-12">
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--du-accent-text)]">
          {eyebrow}
        </span>
        <h2 className="mt-4 max-w-[560px] text-[clamp(2rem,4vw,4.75rem)] font-semibold leading-[0.95] tracking-[-0.045em] text-[var(--du-text)]">
          {title}
        </h2>
        <p className="mt-5 max-w-[480px] text-sm leading-relaxed text-[var(--du-text-muted)] sm:text-base">
          {description}
        </p>
        <span className="mt-7 inline-flex w-fit items-center gap-2 border-b border-[var(--du-text)] pb-1 text-sm font-semibold text-[var(--du-text)] transition-colors group-hover:text-[var(--du-accent-text)]">
          {cta}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

function HeroChoice({
  label,
  name,
  value,
  options,
  onChange,
  icon: ChoiceIcon,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  icon: LucideIcon;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return <div className="relative">
    <input type="hidden" name={name} value={value} />
    <button type="button" aria-label={label} aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-9 max-w-[190px] items-center gap-2 rounded-xl bg-[var(--du-surface-2)] px-3 text-xs text-[var(--du-text)] transition-colors hover:bg-[var(--du-border-strong)] xl:h-10 xl:text-sm">
      <ChoiceIcon className="h-4 w-4 shrink-0 text-[var(--du-text-muted)]" aria-hidden="true" /><span className="truncate">{selected?.label ?? value}</span><ChevronDown className="h-3 w-3 shrink-0 text-[var(--du-text-muted)]" aria-hidden="true" />
    </button>
    {open ? <div className="absolute bottom-11 left-0 z-30 max-h-56 min-w-[160px] overflow-y-auto rounded-xl border border-[var(--du-border)] bg-[var(--du-surface)] p-1.5 shadow-2xl">
      {options.map((option) => <button key={option.value} type="button" onClick={() => { onChange(option.value); setOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-[var(--du-surface-2)] ${option.value === value ? "text-[var(--du-accent-text)]" : "text-[var(--du-text)]"}`}>{option.label}</button>)}
    </div> : null}
  </div>;
}

const HERO_SLIDES = [
  {
    video: "/home/hero-marina-loop.mp4",
    poster: "/home/hero-marina-poster.png",
  },
  {
    video: "/home/hero-showcase-02.mp4",
    poster: "/home/video-pro.webp",
  },
  {
    video: "/home/hero-showcase-03.mp4",
    poster: "/home/coast-drive.webp",
  },
];

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

type HomeVideoModel = {
  id: string;
  name: string;
  durations: number[];
  aspects: string[];
};

export function DuHome({ lang, models }: { lang: string; models: HomeVideoModel[] }) {
  const [active, setActive] = useState("Fantasy");
  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
  const [activeEffectIndex, setActiveEffectIndex] = useState(0);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroModelId, setHeroModelId] = useState(models[0]?.id ?? "");
  const [heroDuration, setHeroDuration] = useState(models[0]?.durations[0] ?? 4);
  const [heroAspect, setHeroAspect] = useState(models[0]?.aspects[0] ?? "16:9");
  const heroModel = models.find((item) => item.id === heroModelId) ?? models[0];
  const isChinese = lang.toLowerCase().startsWith("zh");
  const heroCopy = isChinese
    ? {
        title: "AI 视频生成器。",
        titleSecond: "电影级创作效果。",
        subtitle: "从一句提示词到电影感视频，只需几秒。顶级模型，一个工作空间。让不可思议的镜头成为现实。",
        cta: "立即创建视频",
        placeholder: "描述你的视觉创意，我们将为你生成视频。",
        generate: "生成",
        previous: "上一个示例",
        next: "下一个示例",
      }
    : {
        title: "AI VIDEO GENERATOR.",
        titleSecond: "STUDIO-GRADE RESULTS.",
        subtitle: "From prompt to cinematic video in seconds. Every top model, one workspace. Bring impossible shots to life.",
        cta: "Create Video Now",
        placeholder: "Describe any visual idea. We will generate a video.",
        generate: "Generate",
        previous: "Previous example",
        next: "Next example",
      };

  const previousHero = (heroIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length;
  const nextHero = (heroIndex + 1) % HERO_SLIDES.length;
  const showPreviousHero = () => setHeroIndex(previousHero);
  const showNextHero = () => setHeroIndex(nextHero);
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
          title: "让你的生活更加有趣",
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
          title: "为你的梦找到合适的枕头",
          description: "进入专业创作工作台，把更完整的故事发展成有电影感的画面。",
          cta: "进入视频工作台",
        },
      }
    : {
        social: {
          eyebrow: "Trending video templates",
          title: "Make everyday life more fun",
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
        tryIt: "立即体验 →",
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
        tryIt: "Try it →",
        creditsLead: "Start creating with ",
        creditsAccent: "free credits.",
        creditsSubtitle: CREDITS_BANNER.subtitle,
        creditsCta: CREDITS_BANNER.cta.label,
      };

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      {/* 1. Hero */}
      <section className="overflow-hidden pb-10 pt-3">
        <div className="relative mx-auto flex w-full items-center justify-center px-4 sm:px-8 lg:px-12">
          <button
            type="button"
            onClick={showPreviousHero}
            aria-label={heroCopy.previous}
            className="group absolute left-[-30%] z-0 hidden aspect-video w-[60%] overflow-hidden rounded-[28px] border border-white/10 bg-[var(--du-surface)] opacity-55 transition-all duration-500 hover:opacity-75 md:block lg:left-[-24%] xl:left-[-19%]"
          >
            <img
              src={HERO_SLIDES[previousHero].poster}
              alt=""
              className="h-full w-full scale-105 object-cover blur-[5px] transition-transform duration-500 group-hover:scale-110"
            />
            <span className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          </button>

          <div className="relative z-10 min-h-[640px] w-full max-w-[2560px] overflow-hidden rounded-[26px] border border-[var(--du-border-strong)] bg-[var(--du-surface)] shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:rounded-[34px] md:aspect-video md:min-h-0">
            <video
              key={HERO_SLIDES[heroIndex].video}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster={HERO_SLIDES[heroIndex].poster}
              className="absolute inset-0 h-full w-full object-cover"
            >
              <source src={HERO_SLIDES[heroIndex].video} type="video/mp4" />
            </video>
            <span className="pointer-events-none absolute inset-0 bg-black/50" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

            <div className="relative z-10 flex min-h-[640px] flex-col items-center justify-center px-5 py-12 text-center sm:px-8 md:absolute md:inset-0 md:min-h-0 md:px-[8%] md:py-[4%]">
              <h1 className="max-w-[1600px] text-[clamp(2rem,4.5vw,6rem)] font-semibold uppercase leading-[0.95] tracking-[-0.055em] text-white">
                {heroCopy.title}
                <br />
                {heroCopy.titleSecond}
              </h1>
              <p className="mt-[2%] max-w-[980px] text-[clamp(0.85rem,1.25vw,1.35rem)] leading-relaxed text-white/90">
                {heroCopy.subtitle}
              </p>
              <Link
                href={localizedHref(lang, "/ai/video")}
                className="mt-[2.5%] inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--du-accent)] px-5 text-sm font-semibold text-[var(--du-on-accent)] shadow-[var(--du-glow)] transition-colors hover:bg-[var(--du-accent-hover)] sm:min-h-12 sm:px-8 sm:text-base xl:min-h-14 xl:rounded-2xl xl:px-10 xl:text-lg"
              >
                {heroCopy.cta}
              </Link>

              <form
                action={localizedHref(lang, "/ai/video")}
                method="get"
                className="du-glass relative z-20 mt-6 w-full max-w-[1080px] rounded-[22px] p-3 text-left sm:w-[85%] md:mt-[4%] xl:p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="du-glass-btn flex h-10 w-10 shrink-0 items-center justify-center text-xl text-[var(--du-text)] xl:h-11 xl:w-11 xl:text-2xl">
                    +
                  </span>
                  <label className="sr-only" htmlFor="hero-prompt">
                    {heroCopy.placeholder}
                  </label>
                  <textarea
                    id="hero-prompt"
                    name="prompt"
                    rows={1}
                    placeholder={heroCopy.placeholder}
                    className="min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-sm text-[var(--du-text)] outline-none placeholder:text-[var(--du-text-muted)] xl:text-lg"
                  />
                </div>
                <div className="mt-2 flex items-end justify-between gap-3 xl:mt-3">
                  <div className="flex flex-wrap gap-2">
                    <HeroChoice label={isChinese ? "模型" : "Model"} name="model" value={heroModelId} icon={Film} options={models.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => {
                        const next = models.find((item) => item.id === value);
                        if (next) {
                          setHeroModelId(next.id);
                          setHeroDuration(next.durations[0]);
                          setHeroAspect(next.aspects[0]);
                        }
                      }} />
                    <HeroChoice label={isChinese ? "时长" : "Duration"} name="duration" value={String(heroDuration)} icon={Clock3} options={(heroModel?.durations ?? []).map((duration) => ({ value: String(duration), label: `${duration}s` }))} onChange={(value) => setHeroDuration(Number(value))} />
                    <HeroChoice label={isChinese ? "画面比例" : "Aspect ratio"} name="aspect" value={heroAspect} icon={Maximize} options={(heroModel?.aspects ?? []).map((aspect) => ({ value: aspect, label: aspect }))} onChange={setHeroAspect} />
                  </div>
                  <button
                    type="submit"
                    disabled={!heroModel}
                    className="min-h-10 shrink-0 rounded-xl bg-[var(--du-accent)] px-6 text-xs font-bold uppercase text-[var(--du-on-accent)] shadow-[var(--du-glow)] transition-colors hover:bg-[var(--du-accent-hover)] xl:min-h-14 xl:px-10 xl:text-sm"
                  >
                    {heroCopy.generate}
                  </button>
                </div>
              </form>
            </div>

            <button
              type="button"
              onClick={showPreviousHero}
              aria-label={heroCopy.previous}
              className="du-glass-btn du-glass-on-media absolute left-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:left-5 sm:h-12 sm:w-12"
            >
              <ChevronLeft className="h-5 w-5 text-white" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNextHero}
              aria-label={heroCopy.next}
              className="du-glass-btn du-glass-on-media absolute right-3 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full sm:right-5 sm:h-12 sm:w-12"
            >
              <ChevronRight className="h-5 w-5 text-white" aria-hidden="true" />
            </button>

            <div className="absolute bottom-2 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 md:bottom-[1.5%]">
              {HERO_SLIDES.map((slide, index) => (
                <button
                  key={slide.video}
                  type="button"
                  onClick={() => setHeroIndex(index)}
                  aria-label={`${index + 1}`}
                  aria-current={index === heroIndex ? "true" : undefined}
                  className={index === heroIndex ? "h-1.5 w-7 rounded-full bg-[var(--du-accent)]" : "h-1.5 w-2.5 rounded-full bg-white/45 hover:bg-white/70"}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={showNextHero}
            aria-label={heroCopy.next}
            className="group absolute right-[-30%] z-0 hidden aspect-video w-[60%] overflow-hidden rounded-[28px] border border-white/10 bg-[var(--du-surface)] opacity-55 transition-all duration-500 hover:opacity-75 md:block lg:right-[-24%] xl:right-[-19%]"
          >
            <img
              src={HERO_SLIDES[nextHero].poster}
              alt=""
              className="h-full w-full scale-105 object-cover blur-[5px] transition-transform duration-500 group-hover:scale-110"
            />
            <span className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
          </button>
        </div>
      </section>

      <HomeStudioStory lang={lang} modelName={heroModel?.name ?? (isChinese ? "视频模型" : "Video model")} />

      {/* 2. Category wall */}
      <section className="mx-auto max-w-[1680px] px-6 py-16">
        <FeatureStrip
          {...featureCopy.social}
          href={localizedHref(lang, "/gallery")}
          images={["/home/golden-hour.webp", "/home/neon-streets.webp", "/home/coast-drive.webp"]}
          tone="cyan"
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
      <section className="mx-auto max-w-[1680px] px-6 py-16">
        <FeatureStrip
          {...featureCopy.image}
          href={localizedHref(lang, "/explore")}
          images={["/home/silver-muse.webp", "/home/glass-city.webp", "/home/liquid-light.webp"]}
          tone="amber"
        />
        <div className="relative mt-8 h-[clamp(430px,55vw,760px)] overflow-hidden rounded-[32px] border border-[var(--du-border)] bg-[radial-gradient(circle_at_50%_45%,rgba(45,35,112,0.3),rgba(3,5,14,0.82)_48%,rgba(0,0,0,0.96)_78%)] [perspective:1500px] [perspective-origin:50%_42%]">
          <span className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(102,252,241,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(102,252,241,0.25)_1px,transparent_1px)] [background-size:48px_48px]" />
          <span className="pointer-events-none absolute left-1/2 top-[54%] h-[48%] w-[88%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-2 border-violet-400/55 shadow-[0_0_18px_rgba(111,88,255,0.55),inset_0_0_22px_rgba(87,202,255,0.18)] [transform:translate(-50%,-50%)_rotateX(67deg)]" />
          <span className="pointer-events-none absolute left-[6%] top-[54%] h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_12px_4px_rgba(102,252,241,0.9)]" />
          <span className="pointer-events-none absolute right-[6%] top-[54%] h-3 w-3 rounded-full bg-violet-200 shadow-[0_0_12px_4px_rgba(167,121,255,0.9)]" />
          <span className="pointer-events-none absolute inset-x-[14%] bottom-[3%] h-[25%] rounded-[50%] bg-[radial-gradient(ellipse_at_center,rgba(128,76,255,0.2),rgba(67,197,255,0.09)_38%,transparent_72%)] blur-2xl" />

          <div className="pointer-events-none absolute left-1/2 top-[5%] z-[70] -translate-x-1/2">
            <div className="relative rounded-full border border-cyan-200/70 bg-[#080b19]/80 px-6 py-3 text-center shadow-[0_0_18px_rgba(88,196,255,0.45),0_0_34px_rgba(132,80,255,0.3)] backdrop-blur-xl">
              <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-200/65">
                {isChinese ? "当前特效" : "Selected effect"}
              </span>
              <span className="mt-0.5 block whitespace-nowrap text-sm font-semibold text-white sm:text-base">
                {homeCopy.effectTitles[EFFECT_CARDS[activeEffectIndex].id] ??
                  EFFECT_CARDS[activeEffectIndex].title}
              </span>
              <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-cyan-200/70 bg-[#080b19]/90" />
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
                      {homeCopy.tryIt}
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
      <section className="mx-auto max-w-[1680px] px-6 py-16">
        <FeatureStrip
          {...featureCopy.cinema}
          href={localizedHref(lang, "/ai/video")}
          images={["/home/video-pro.webp", "/home/planet-horizon.webp", "/home/edge-of-space.webp"]}
          tone="violet"
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
