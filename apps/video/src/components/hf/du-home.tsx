"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CirclePlay,
  Clapperboard,
  Film,
  Heart,
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

import { GallerySection } from "@/components/gallery/gallery-section";
import {
  CATEGORY_CARDS,
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
  Heart,
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

function categoryCardTransform(index: number, hoveredIndex: number | null) {
  if (hoveredIndex === null) return "translateY(0) scale(1) rotateZ(0deg)";

  const distance = index - hoveredIndex;
  if (distance === 0) return "translateY(-28px) scale(1.09) rotateZ(0deg)";

  const absoluteDistance = Math.abs(distance);
  const direction = distance < 0 ? -1 : 1;
  const rotation = direction * Math.max(2, 11 - absoluteDistance * 2.25);
  const horizontalShift = direction * Math.max(0, 14 - absoluteDistance * 2);
  const verticalShift = Math.min(absoluteDistance * 4, 16);
  const scale = Math.max(0.91, 1 - absoluteDistance * 0.025);

  return `translateX(${horizontalShift}px) translateY(${verticalShift}px) scale(${scale}) rotateZ(${rotation}deg)`;
}

export function DuHome({ lang }: { lang: string }) {
  const [active, setActive] = useState("Cinematic");
  const [hoveredCategory, setHoveredCategory] = useState<number | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
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
        categoryTitles: {
          "golden-hour": "黄金时刻",
          "neon-streets": "霓虹街景",
          "liquid-light": "流光",
          "coast-drive": "海岸公路",
          "first-steps": "初次启程",
          "silver-muse": "银色缪斯",
          "glass-city": "玻璃之城",
          "edge-of-space": "太空边缘",
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
        like: "喜欢",
        creditsLead: "使用",
        creditsAccent: "免费积分开始创作。",
        creditsSubtitle: "无需信用卡，把你的下一个灵感变成真实作品。",
        creditsCta: "领取免费积分 →",
      }
    : {
        filters: Object.fromEntries(CATEGORY_FILTERS.map((item) => [item, item])) as Record<string, string>,
        categoryTitles: {} as Record<string, string>,
        modelsHeader: MODELS_HEADER,
        modelTitles: {} as Record<string, string>,
        modelDescriptions: {} as Record<string, string>,
        effectTitles: {} as Record<string, string>,
        learnMore: "Learn more →",
        tryIt: "Try it →",
        like: "Like",
        creditsLead: "Start creating with ",
        creditsAccent: "free credits.",
        creditsSubtitle: CREDITS_BANNER.subtitle,
        creditsCta: CREDITS_BANNER.cta.label,
      };

  const visibleCategories =
    active === "All" || active === "More"
      ? CATEGORY_CARDS
      : CATEGORY_CARDS.filter((card) => card.category === active);

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      {/* 1. Hero */}
      <section className="overflow-hidden pb-14 pt-3">
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

          <div className="relative z-10 aspect-video w-full max-w-[2560px] overflow-hidden rounded-[26px] border border-[var(--du-border-strong)] bg-[var(--du-surface)] shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:rounded-[34px]">
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

            <div className="relative z-10 flex h-full flex-col items-center px-5 pt-[8%] text-center sm:px-8 lg:pt-[7%]">
              <h1 className="max-w-[1600px] text-[clamp(1.75rem,5vw,7.25rem)] font-semibold uppercase leading-[0.95] tracking-[-0.055em] text-white">
                {heroCopy.title}
                <br />
                {heroCopy.titleSecond}
              </h1>
              <p className="mt-[2.4%] hidden max-w-[980px] text-[clamp(0.8rem,1.4vw,1.5rem)] leading-relaxed text-white/90 sm:block">
                {heroCopy.subtitle}
              </p>
              <Link
                href={localizedHref(lang, "/text-to-video")}
                className="mt-[3%] inline-flex min-h-10 items-center justify-center rounded-xl bg-[var(--du-accent)] px-5 text-sm font-semibold text-[var(--du-on-accent)] shadow-[var(--du-glow)] transition-colors hover:bg-[var(--du-accent-hover)] sm:min-h-12 sm:px-8 sm:text-base xl:min-h-16 xl:rounded-2xl xl:px-12 xl:text-lg"
              >
                {heroCopy.cta}
              </Link>

              <form
                action={localizedHref(lang, "/text-to-video")}
                method="get"
                className="du-glass absolute bottom-[4%] left-1/2 hidden w-[min(72%,1080px)] -translate-x-1/2 rounded-[22px] p-3 text-left md:block xl:p-4"
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
                    {["Seedance 1.5", "10s", "Auto", isChinese ? "声音开启" : "Sound on"].map((item) => (
                      <span key={item} className="du-glass-btn inline-flex h-8 items-center px-3 text-xs xl:h-9 xl:text-sm">
                        {item}
                      </span>
                    ))}
                  </div>
                  <button
                    type="submit"
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

      {/* 2. Category wall */}
      <section className="mx-auto max-w-[1680px] px-6 py-16">
        <FeatureStrip
          {...featureCopy.social}
          href={localizedHref(lang, "/gallery")}
          images={["/home/golden-hour.webp", "/home/neon-streets.webp", "/home/coast-drive.webp"]}
          tone="cyan"
        />
        <div
          className="relative mt-8 overflow-x-auto overflow-y-visible pb-10 pt-10 [perspective:1200px]"
          onMouseLeave={() => setHoveredCategory(null)}
        >
          <div className="mx-auto flex min-w-max items-end justify-center gap-3 px-5 sm:gap-4">
            {CATEGORY_DECK_FILTERS.map((filter, index) => {
              const isActive = filter === active;
              const isHovered = index === hoveredCategory;
              return (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActive(filter)}
                  onMouseEnter={() => setHoveredCategory(index)}
                  onFocus={() => setHoveredCategory(index)}
                  onBlur={() => setHoveredCategory(null)}
                  style={{
                    transform: categoryCardTransform(index, hoveredCategory),
                    zIndex: isHovered ? 30 : Math.max(1, 20 - Math.abs(index - (hoveredCategory ?? index))),
                  }}
                  className={`group relative h-[245px] w-[164px] shrink-0 overflow-hidden rounded-[24px] border text-left shadow-[0_18px_50px_rgba(0,0,0,0.4)] transition-[transform,border-color,box-shadow,filter] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform sm:h-[290px] sm:w-[194px] ${
                    isActive
                      ? "border-[var(--du-accent)] shadow-[0_0_34px_rgba(102,252,241,0.3),0_24px_60px_rgba(0,0,0,0.48)]"
                      : "border-white/15 hover:border-[var(--du-border-strong)]"
                  }`}
                >
                  <img
                    src={CATEGORY_DECK_IMAGES[filter]}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full scale-105 object-cover transition-transform duration-700 ease-out group-hover:scale-115"
                  />
                  <span className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/15 to-black/90" />
                  <span className="absolute inset-[1px] rounded-[22px] border border-white/10 bg-gradient-to-br from-white/15 via-transparent to-cyan-300/10 backdrop-blur-[1px]" />
                  <span className="absolute left-4 top-4 text-[10px] font-semibold uppercase tracking-[0.22em] text-white/65">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="absolute inset-x-4 bottom-5">
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
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {visibleCategories.map((card) => (
            <div key={card.id} className="du-glass p-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[var(--du-border)]">
                <img
                  src={card.image}
                  alt={isChinese ? homeCopy.categoryTitles[card.id] ?? card.alt : card.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="du-glass-btn du-glass-round du-glass-on-media absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center">
                  <Icon name="Play" className="h-3.5 w-3.5 text-[var(--du-on-accent)]" />
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm text-[var(--du-text)]">
                  {homeCopy.categoryTitles[card.id] ?? card.title}
                </span>
                <span
                  aria-label={homeCopy.like}
                  className="du-glass-btn du-glass-on-media inline-flex items-center px-2 py-1 text-xs"
                >
                  <Icon name="Heart" className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
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
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EFFECT_CARDS.map((effect) => (
            <div
              key={effect.id}
              className="relative aspect-[16/9] overflow-hidden rounded-xl border border-[var(--du-border)]"
            >
              <img
                src={effect.image}
                alt={isChinese ? homeCopy.effectTitles[effect.id] ?? effect.alt : effect.alt}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-black/45" />
              <span className="absolute bottom-4 left-4 text-[15px] font-semibold text-[var(--du-text)]">
                {homeCopy.effectTitles[effect.id] ?? effect.title}
              </span>
              <Link
                href={localizedHref(lang, effect.href)}
                className="du-glass-btn du-glass-on-media absolute bottom-4 right-4 inline-flex h-8 items-center px-3 text-xs"
              >
                {homeCopy.tryIt}
              </Link>
            </div>
          ))}
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
