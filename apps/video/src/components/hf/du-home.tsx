"use client";

import Link from "next/link";
import { Fragment, useState, type ReactNode } from "react";
import {
  ArrowRight,
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
  CATEGORY_HEADER,
  CREDITS_BANNER,
  EFFECT_CARDS,
  EFFECTS_HEADER,
  MODEL_CARDS,
  MODELS_HEADER,
  STEPS,
  STEPS_HEADER,
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

export function DuHome({ lang }: { lang: string }) {
  const [active, setActive] = useState("All");
  const isChinese = lang.toLowerCase().startsWith("zh");
  const heroCopy = isChinese
    ? {
        title: "AI 视频生成器。",
        titleSecond: "电影级创作效果。",
        subtitle: "从一句提示词到电影感视频，只需几秒。顶级模型，一个工作空间。让不可思议的镜头成为现实。",
        cta: "立即创建视频",
        placeholder: "描述你的视觉创意，我们将为你生成视频。",
        generate: "生成",
      }
    : {
        title: "AI VIDEO GENERATOR.",
        titleSecond: "STUDIO-GRADE RESULTS.",
        subtitle: "From prompt to cinematic video in seconds. Every top model, one workspace. Bring impossible shots to life.",
        cta: "Create Video Now",
        placeholder: "Describe any visual idea. We will generate a video.",
        generate: "Generate",
      };

  const visibleCategories =
    active === "All" || active === "More"
      ? CATEGORY_CARDS
      : CATEGORY_CARDS.filter((card) => card.category === active);

  const creditLead = CREDITS_BANNER.title.slice(
    0,
    CREDITS_BANNER.title.length - CREDITS_BANNER.accent.length
  );

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      {/* 1. Hero */}
      <section className="px-3 pb-12 pt-3 sm:px-5 lg:px-6">
        <div className="relative mx-auto min-h-[700px] max-w-[1560px] overflow-hidden rounded-[30px] border border-[var(--du-border)] bg-[var(--du-surface)] lg:min-h-[calc(100svh-120px)]">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/home/hero-marina-poster.png"
            className="absolute inset-0 h-full w-full object-cover"
            aria-hidden="true"
          >
            <source src="/home/hero-marina-loop.mp4" type="video/mp4" />
          </video>
          <span className="pointer-events-none absolute inset-0 bg-black/50" />

          <div className="relative z-10 mx-auto flex min-h-[700px] max-w-[1180px] flex-col items-center px-5 pb-8 pt-20 text-center sm:px-8 sm:pt-24 lg:min-h-[calc(100svh-120px)] lg:pt-20">
            <h1 className="max-w-[1160px] text-[clamp(2.7rem,6vw,6.2rem)] font-semibold uppercase leading-[0.98] tracking-[-0.055em] text-[var(--du-text)]">
              {heroCopy.title}
              <br />
              {heroCopy.titleSecond}
            </h1>
            <p className="mt-7 max-w-[860px] text-base leading-relaxed text-[var(--du-text)] sm:text-xl">
              {heroCopy.subtitle}
            </p>
            <Link
              href={localizedHref(lang, "/text-to-video")}
              className="mt-8 inline-flex min-h-14 items-center justify-center rounded-2xl bg-[var(--du-accent)] px-8 text-base font-semibold text-[var(--du-on-accent)] shadow-[var(--du-glow)] transition-colors hover:bg-[var(--du-accent-hover)] sm:min-h-16 sm:px-10 sm:text-lg"
            >
              {heroCopy.cta}
            </Link>

            <form
              action={localizedHref(lang, "/text-to-video")}
              method="get"
              className="du-glass mt-auto w-full max-w-[920px] rounded-[24px] p-3 text-left sm:p-4"
            >
              <div className="flex items-start gap-3">
                <span className="du-glass-btn flex h-11 w-11 shrink-0 items-center justify-center text-2xl text-[var(--du-text)]">
                  +
                </span>
                <label className="sr-only" htmlFor="hero-prompt">
                  {heroCopy.placeholder}
                </label>
                <textarea
                  id="hero-prompt"
                  name="prompt"
                  rows={2}
                  placeholder={heroCopy.placeholder}
                  className="min-h-16 flex-1 resize-none bg-transparent px-1 py-2 text-base text-[var(--du-text)] outline-none placeholder:text-[var(--du-text-muted)] sm:text-lg"
                />
              </div>
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {["Seedance 1.5", "10s", "Auto", isChinese ? "声音开启" : "Sound on"].map((item) => (
                    <span key={item} className="du-glass-btn inline-flex h-9 items-center px-3 text-sm">
                      {item}
                    </span>
                  ))}
                </div>
                <button
                  type="submit"
                  className="min-h-12 rounded-xl bg-[var(--du-accent)] px-8 text-sm font-bold uppercase text-[var(--du-on-accent)] shadow-[var(--du-glow)] transition-colors hover:bg-[var(--du-accent-hover)] sm:min-h-14"
                >
                  {heroCopy.generate}
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 2. Category wall */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <SectionHeading
          header={CATEGORY_HEADER}
          action={
            <Link
              href="#"
              className="text-sm text-[var(--du-accent-text)] transition-colors hover:text-[var(--du-accent)]"
            >
              View all →
            </Link>
          }
        />
        <div className="mt-8 flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((filter) => {
            const isActive = filter === active;
            return (
              <button
                key={filter}
                type="button"
                aria-pressed={isActive}
                onClick={() => setActive(filter)}
                className={
                  isActive
                    ? "h-9 rounded-lg bg-[var(--du-accent)] px-4 text-sm font-medium text-[var(--du-on-accent)]"
                    : "du-glass-btn h-9 px-4 text-sm"
                }
              >
                {filter}
              </button>
            );
          })}
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {visibleCategories.map((card) => (
            <div key={card.id} className="du-glass p-2">
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-[var(--du-border)]">
                <img
                  src={card.image}
                  alt={card.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <span className="du-glass-btn du-glass-round du-glass-on-media absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center">
                  <Icon name="Play" className="h-3.5 w-3.5 text-[var(--du-on-accent)]" />
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm text-[var(--du-text)]">{card.title}</span>
                <span
                  aria-label="Like"
                  className="du-glass-btn du-glass-on-media inline-flex items-center px-2 py-1 text-xs"
                >
                  <Icon name="Heart" className="h-3 w-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Model cards */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <SectionHeading header={MODELS_HEADER} />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MODEL_CARDS.map((model) => (
            <div
              key={model.id}
              className="du-glass flex flex-col p-4"
            >
              <div className="flex items-center gap-2">
                <Icon name={model.icon} className="h-5 w-5 text-[var(--du-accent-text)]" />
                <h3 className="text-base font-semibold text-[var(--du-text)]">
                  {model.title}
                </h3>
              </div>
              <div className="mt-3 aspect-[16/10] overflow-hidden rounded-lg">
                <img
                  src={model.image}
                  alt={model.alt}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>
              <p className="mt-3 flex-1 text-sm text-[var(--du-text-muted)]">
                {model.description}
              </p>
              <div className="mt-4 flex justify-end">
                <Link
                  href={localizedHref(lang, model.href)}
                  className="du-glass-btn inline-flex h-9 items-center px-3 text-xs"
                >
                  Learn more →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Effect cards */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <SectionHeading header={EFFECTS_HEADER} />
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EFFECT_CARDS.map((effect) => (
            <div
              key={effect.id}
              className="relative aspect-[16/9] overflow-hidden rounded-xl border border-[var(--du-border)]"
            >
              <img
                src={effect.image}
                alt={effect.alt}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <span className="absolute inset-0 bg-black/45" />
              <span className="absolute bottom-4 left-4 text-[15px] font-semibold text-[var(--du-text)]">
                {effect.title}
              </span>
              <Link
                href={localizedHref(lang, effect.href)}
                className="du-glass-btn du-glass-on-media absolute bottom-4 right-4 inline-flex h-8 items-center px-3 text-xs"
              >
                Try it →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Three steps */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <SectionHeading header={STEPS_HEADER} />
        <div className="mt-10 flex flex-col items-stretch gap-4 lg:flex-row lg:items-center">
          {STEPS.map((step, index) => (
            <Fragment key={step.number}>
              <div className="du-glass flex flex-1 gap-4 p-5">
                <div className="flex items-center border-r border-[var(--du-border)] pr-4 text-[28px] font-bold text-[var(--du-text-dim)]">
                  {step.number}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Icon name={step.icon} className="h-5 w-5 text-[var(--du-accent-text)]" />
                    <h3 className="text-base font-semibold text-[var(--du-text)]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-2 text-sm text-[var(--du-text-muted)]">
                    {step.description}
                  </p>
                </div>
              </div>
              {index < STEPS.length - 1 && (
                <span className="hidden shrink-0 text-[var(--du-accent-text)] lg:inline-flex">
                  <Icon name="ArrowRight" className="h-5 w-5" />
                </span>
              )}
            </Fragment>
          ))}
        </div>
      </section>

      {/* 6. Gallery */}
      <GallerySection />

      {/* 7. Free credits banner */}
      <section className="mx-auto max-w-[1200px] px-6 pb-16">
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
              {creditLead}
              <span className="text-[var(--du-accent-text)]">
                {CREDITS_BANNER.accent}
              </span>
            </h2>
            <p className="text-sm text-[var(--du-text-muted)]">
              {CREDITS_BANNER.subtitle}
            </p>
            <div>
              <CtaButton cta={CREDITS_BANNER.cta} lang={lang} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
