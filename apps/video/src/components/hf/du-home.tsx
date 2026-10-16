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

import {
  CATEGORY_CARDS,
  CATEGORY_FILTERS,
  CATEGORY_HEADER,
  CREDITS_BANNER,
  EFFECT_CARDS,
  EFFECTS_HEADER,
  HERO,
  HERO_CARDS,
  MODEL_CARDS,
  MODELS_HEADER,
  STATS,
  STEPS,
  STEPS_HEADER,
  TOOL_CHIPS,
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

  const visibleCategories =
    active === "All" || active === "More"
      ? CATEGORY_CARDS
      : CATEGORY_CARDS.filter((card) => card.category === active);

  const largeCards = HERO_CARDS.filter((card) => card.size === "large");
  const smallCards = HERO_CARDS.filter((card) => card.size === "small");

  const creditLead = CREDITS_BANNER.title.slice(
    0,
    CREDITS_BANNER.title.length - CREDITS_BANNER.accent.length
  );

  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      {/* 1. Hero */}
      <section className="relative overflow-hidden pt-16 pb-12">
        <span className="pointer-events-none absolute -top-24 right-0 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,var(--du-accent-soft),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-[1200px] grid-cols-1 gap-12 px-6 lg:grid-cols-[55fr_45fr] lg:items-center">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--du-text-dim)]">
              {HERO.eyebrow}
            </p>
            <h1 className="mt-4 text-5xl font-bold leading-[1.1] text-[var(--du-text)] sm:text-[64px]">
              {HERO.titleLead}
              <br />
              <span className="inline-block bg-[image:var(--du-gradient)] bg-clip-text pb-2 text-transparent">
                {HERO.titleAccent}
              </span>
            </h1>
            <p className="mt-5 max-w-[480px] text-lg text-[var(--du-text-muted)]">
              {HERO.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              {HERO.ctas.map((cta) => (
                <CtaButton key={cta.label} cta={cta} lang={lang} />
              ))}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {TOOL_CHIPS.map((chip) => (
                <Link
                  key={chip.label}
                  href={localizedHref(lang, chip.href)}
                  className="du-glass-btn inline-flex h-9 items-center gap-2 px-3 text-[13px]"
                >
                  <Icon name={chip.icon} className="h-4 w-4" />
                  {chip.label}
                </Link>
              ))}
            </div>
            <div className="mt-8 grid max-w-[440px] grid-cols-3 divide-x divide-[var(--du-border)]">
              {STATS.map((stat, index) => (
                <div key={stat.label} className={index === 0 ? "pr-4" : "px-4"}>
                  <div className="text-2xl font-bold text-[var(--du-text)]">
                    {stat.value}
                  </div>
                  <div className="text-[13px] text-[var(--du-text-muted)]">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative flex items-center justify-center gap-4">
            <span className="absolute -left-6 top-10 hidden h-[280px] w-[200px] rotate-[-8deg] rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] opacity-40 lg:block" />
            <div className="relative w-[220px] sm:w-[300px] lg:w-[340px]">
              {largeCards.map((card) => (
                <div
                  key={card.caption}
                  className="relative aspect-[3/4] w-full rotate-[-4deg] overflow-hidden rounded-2xl border border-[var(--du-border-strong)] shadow-[var(--du-glow)]"
                >
                  <img
                    src={card.image}
                    alt={card.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(to_top,var(--du-bg),transparent_55%)]" />
                  <span className="du-glass-btn du-glass-on-media absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center">
                    <Icon name="Play" className="h-5 w-5 text-[var(--du-on-accent)]" />
                  </span>
                  <span className="absolute bottom-4 left-4 max-w-[200px] text-sm font-medium text-[var(--du-text)]">
                    {card.caption}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3">
              {smallCards.map((card) => (
                <div
                  key={card.caption}
                  className="relative aspect-[3/4] w-[110px] overflow-hidden rounded-2xl border border-[var(--du-border)] sm:w-[130px]"
                >
                  <img
                    src={card.image}
                    alt={card.alt}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(to_top,var(--du-bg),transparent_55%)]" />
                  <span className="du-glass-btn du-glass-on-media absolute bottom-3 left-3 px-2 py-1 text-xs font-medium">
                    {card.caption}
                  </span>
                </div>
              ))}
            </div>
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
                <span className="du-glass-btn du-glass-on-media absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center">
                  <Icon name="Play" className="h-3.5 w-3.5 text-[var(--du-on-accent)]" />
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-sm text-[var(--du-text)]">{card.title}</span>
                <span className="du-glass-btn du-glass-on-media inline-flex items-center gap-1 px-2 py-1 text-xs">
                  <Icon name="Heart" className="h-3 w-3" />
                  {card.likes}
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
              <span className="absolute inset-0 bg-[linear-gradient(to_top,var(--du-bg),transparent_60%)]" />
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

      {/* 6. Free credits banner */}
      <section className="mx-auto max-w-[1200px] px-6 pb-16">
        <div className="relative min-h-[220px] overflow-hidden rounded-2xl border border-[var(--du-border-strong)]">
          <img
            src={CREDITS_BANNER.image}
            alt={CREDITS_BANNER.alt}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-[linear-gradient(to_right,var(--du-bg),transparent_70%)]" />
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
