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
import { HomeStudioStory } from "@/components/hf/home-studio-story";
import { HomeShowcaseSections } from "@/components/hf/home-showcase-sections";
import { HomeGenerator, type HomeGeneratorPreset } from "@/components/hf/home-generator";
import { HomeTemplates } from "@/components/hf/home-templates";
import type { HomeTemplate, HomeTemplateCategory } from "@/lib/home-templates";
import {
  CREDITS_BANNER,
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

const HERO_SLIDES: { video?: string; poster: string }[] = [
  {
    video: "/home/hero-marina-loop.mp4",
    poster: "/home/hero-marina-poster.webp",
  },
  {
    poster: "/home/samples/mountain-valley.webp",
  },
  {
    poster: "/home/samples/storm-sea.webp",
  },
];

type HomeVideoModel = {
  id: string;
  name: string;
  durations: number[];
  aspects: string[];
};

export function DuHome({ lang, models }: { lang: string; models: HomeVideoModel[] }) {
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroModelId, setHeroModelId] = useState(models[0]?.id ?? "");
  const heroModel = models.find((item) => item.id === heroModelId);
  const [preset, setPreset] = useState<HomeGeneratorPreset | null>(null);
  const [templateCategory, setTemplateCategory] = useState<HomeTemplateCategory>("story");
  const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const useTemplate = (template: HomeTemplate) => {
    setPreset((previous) => ({
      prompt: lang.toLowerCase().startsWith("zh") ? template.prompt.zh : template.prompt.en,
      aspect: template.aspect,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    scrollToId("home-generator");
  };
  const browseIdeas = (category: HomeTemplateCategory) => {
    setTemplateCategory(category);
    scrollToId("home-templates");
  };
  const isChinese = lang.toLowerCase().startsWith("zh");
  const heroCopy = isChinese
    ? {
        title: "AI 视频生成器。",
        titleSecond: "从创意开始创作。",
        subtitle: "写下你的视频想法，探索脚本、视觉、配音、字幕与音乐的创作方向，选择模型开始生成。",
        previous: "上一个示例",
        next: "下一个示例",
      }
    : {
        title: "AI VIDEO GENERATOR.",
        titleSecond: "START WITH AN IDEA.",
        subtitle: "Describe your video idea, explore directions for script, visuals, voiceover, subtitles and music, then choose a model to generate.",
        previous: "Previous example",
        next: "Next example",
      };

  const previousHero = (heroIndex - 1 + HERO_SLIDES.length) % HERO_SLIDES.length;
  const nextHero = (heroIndex + 1) % HERO_SLIDES.length;
  const showPreviousHero = () => setHeroIndex(previousHero);
  const showNextHero = () => setHeroIndex(nextHero);
  const homeCopy = isChinese
    ? {
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
        learnMore: "了解更多 →",
        creditsLead: "使用",
        creditsAccent: "免费积分开始创作。",
        creditsSubtitle: "无需信用卡，把你的下一个灵感变成真实作品。",
        creditsCta: "领取免费积分 →",
      }
    : {
        modelsHeader: MODELS_HEADER,
        modelTitles: {} as Record<string, string>,
        modelDescriptions: {} as Record<string, string>,
        learnMore: "Learn more →",
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

          <div className="relative z-10 min-h-[690px] w-full max-w-[2560px] overflow-hidden rounded-[26px] border border-[var(--du-border-strong)] bg-[var(--du-surface)] shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:rounded-[34px] md:h-[min(calc(100svh-9rem),960px)] md:min-h-[530px]">
            {HERO_SLIDES[heroIndex].video ? (
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
            ) : (
              <img
                key={HERO_SLIDES[heroIndex].poster}
                src={HERO_SLIDES[heroIndex].poster}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <span className="pointer-events-none absolute inset-0 bg-black/50" />
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />

            <div className="relative z-10 flex min-h-[690px] flex-col items-center justify-center px-5 py-12 text-center sm:px-8 md:absolute md:inset-0 md:min-h-0 md:px-[8%] md:py-[clamp(1rem,3vh,3rem)]">
              <h1 className="max-w-[1600px] text-[clamp(2rem,min(4.5vw,6.5vh),6rem)] font-semibold uppercase leading-[0.95] tracking-[-0.055em] text-white">
                {heroCopy.title}
                <br />
                {heroCopy.titleSecond}
              </h1>
              <p className="mt-[2%] max-w-[980px] text-[clamp(0.85rem,1.25vw,1.35rem)] leading-relaxed text-white/90">
                {heroCopy.subtitle}
              </p>
              <HomeGenerator lang={lang} models={models} onModelChange={setHeroModelId} preset={preset} onBrowseIdeas={browseIdeas} />
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
                  key={slide.poster}
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

      <HomeTemplates lang={lang} category={templateCategory} onCategoryChange={setTemplateCategory} onUse={useTemplate} />


      <HomeStudioStory lang={lang} modelName={heroModel?.name ?? (isChinese ? "视频模型" : "Video model")} />

      {/* 2. Community gallery */}
      <GallerySection variant="home" />

      {/* 3–6. Video and Creative Space previews */}
      <HomeShowcaseSections lang={lang} />

      {/* 7. Model cards */}
      <section className="mx-auto max-w-[1680px] px-6 py-16">
        <SectionHeading header={homeCopy.modelsHeader} />
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
                  className="h-full w-full object-cover object-[50%_30%]"
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

      {/* 8. Free credits banner */}
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
