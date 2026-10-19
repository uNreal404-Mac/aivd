"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { useReveal } from "@/components/hf/use-reveal";
import {
  ASSISTANT_ROLES,
  COMMUNITY_PROJECTS,
  VFX_PRESETS,
  duplicateForMarquee,
  gradientFor,
} from "@/lib/home-sections";

const primaryButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[var(--hfh-accent)] px-5 text-sm font-semibold text-[var(--hfh-accent-text)]";

const outlineButtonClass =
  "inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[var(--hfh-border-hover)] px-5 text-sm font-semibold text-[var(--hfh-text)] transition-colors hover:border-[var(--hfh-accent)] hover:text-[var(--hfh-accent)]";

const headlineClass =
  "font-[family-name:var(--font-display)] font-bold uppercase tracking-[-0.04em]";

export function HfHomeSections({ lang }: { lang: string }) {
  const influencerRef = useReveal<HTMLElement>();
  const assistantRef = useReveal<HTMLElement>();
  const presetsRef = useReveal<HTMLElement>();
  const modelRef = useReveal<HTMLElement>();
  const communityRef = useReveal<HTMLElement>();
  const ctaRef = useReveal<HTMLElement>();

  const studioHref = `/${lang}/ai/video`;
  const marqueePresets = duplicateForMarquee(VFX_PRESETS);

  return (
    <div className="w-full">
      <section
        ref={influencerRef}
        className="hfh-reveal relative mt-6 overflow-hidden rounded-[24px] border border-[var(--hfh-border)] bg-[var(--hfh-panel)] px-6 py-12 text-center sm:px-12 sm:py-16"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: "var(--hfh-glow-a)" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full blur-3xl"
          style={{ background: "var(--hfh-glow-b)" }}
        />
        <div className="relative flex flex-col items-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--hfh-accent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--hfh-accent-text)]">
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            Try free
          </span>
          <h2
            className={`hfh-heading-fade mt-6 max-w-3xl text-3xl leading-[1.05] sm:text-5xl ${headlineClass}`}
          >
            A studio that keeps up with you
          </h2>
          <p className="mt-4 max-w-xl text-sm text-[var(--hfh-muted)] sm:text-base">
            Start with a line of text and finish with a real cut. Every draft,
            take, and revision stays in one place.
          </p>
          <Link href={studioHref} className={`mt-7 ${primaryButtonClass}`}>
            Start creating
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section
        ref={assistantRef}
        className="hfh-reveal mt-10 rounded-[24px] border border-[var(--hfh-border)] bg-[var(--hfh-panel)] p-6 sm:p-8 lg:p-10"
      >
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <h2
              className={`text-2xl leading-[1.05] text-[var(--hfh-text)] sm:text-4xl ${headlineClass}`}
            >
              Plan a project
              <br />
              step by step
            </h2>
            <p className="mt-4 max-w-md text-sm text-[var(--hfh-muted)]">
              Bring the assistant in at any point. It can outline a storyboard,
              hold a look together across shots, or hand you a shot list you can
              shoot right away.
            </p>
            <Link
              href={studioHref}
              className={`mt-6 ${outlineButtonClass}`}
            >
              Meet the assistant
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {ASSISTANT_ROLES.map((role, index) => (
              <li
                key={role}
                className="hfh-float rounded-[12px] border border-[var(--hfh-border)] bg-[var(--hfh-panel-2)] px-4 py-3 text-sm font-medium text-[var(--hfh-text)]"
                style={{ animationDelay: `${index * 0.35}s` }}
              >
                {role}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section ref={presetsRef} className="hfh-reveal mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2
              className={`text-sm text-[var(--hfh-text)] ${headlineClass}`}
            >
              Visual effects
            </h2>
            <span
              aria-hidden="true"
              className="hidden h-px w-16 bg-[var(--hfh-border)] sm:block"
            />
            <p className="text-xs text-[var(--hfh-muted)]">
              Presets we reach for every day.
            </p>
          </div>
          <Link
            href={studioHref}
            className="text-sm font-medium text-[var(--hfh-accent)]"
          >
            Start creating
          </Link>
        </div>

        <div className="hfh-marquee-wrap mt-4">
          <ul className="hfh-marquee gap-4">
            {marqueePresets.map((preset, index) => (
              <li key={`${preset.id}-${index}`} className="w-[180px] shrink-0">
                <Link
                  href={studioHref}
                  className="group relative block aspect-[3/4] w-full overflow-hidden rounded-[16px] border border-[var(--hfh-border)] transition-colors hover:border-[var(--hfh-border-hover)]"
                  style={{ background: gradientFor(index) }}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[var(--hfh-overlay)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                  />
                  <span className="absolute left-3 top-3 rounded-full bg-[var(--hfh-accent-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--hfh-accent)]">
                    Preset
                  </span>
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--hfh-accent)] px-3 py-1 text-[11px] font-semibold text-[var(--hfh-accent-text)] opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    Recreate
                  </span>
                  <span className="absolute inset-x-3 bottom-3 text-xs font-medium text-[var(--hfh-text)]">
                    {preset.title}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-4 text-center">
          <Link
            href={studioHref}
            className="text-sm font-medium text-[var(--hfh-accent)]"
          >
            View all presets
          </Link>
        </p>
      </section>

      <section
        ref={modelRef}
        className="hfh-reveal mt-12 grid gap-6 rounded-[24px] border border-[var(--hfh-border)] bg-[var(--hfh-panel)] p-6 sm:p-8 lg:grid-cols-2 lg:items-center lg:p-10"
      >
        <div
          aria-hidden="true"
          className="hfh-pan aspect-video w-full rounded-[16px] border border-[var(--hfh-border)]"
          style={{ background: gradientFor(2) }}
        />
        <div>
          <span className="inline-flex rounded-full bg-[var(--hfh-accent)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--hfh-accent-text)]">
            New model
          </span>
          <h2
            className={`mt-4 text-2xl leading-[1.05] text-[var(--hfh-text)] sm:text-4xl ${headlineClass}`}
          >
            Faster takes, longer shots
          </h2>
          <p className="mt-4 text-sm text-[var(--hfh-muted)]">
            The latest engine holds a look across a whole sequence and keeps
            motion clean through longer clips.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={studioHref} className={primaryButtonClass}>
              Try it now
            </Link>
            <Link href={studioHref} className={outlineButtonClass}>
              See the model lineup
            </Link>
          </div>
        </div>
      </section>

      <section ref={communityRef} className="hfh-reveal mt-12">
        <h2
          className={`text-2xl text-[var(--hfh-text)] ${headlineClass}`}
        >
          Inside every project
        </h2>
        <p className="mt-1 text-sm text-[var(--hfh-muted)]">
          Real work from the community, shared as it is made.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {COMMUNITY_PROJECTS.map((project, index) => (
            <Link
              key={project.id}
              href={studioHref}
              className="block rounded-[16px] border border-[var(--hfh-border)] bg-[var(--hfh-panel)] p-2 transition duration-300 hover:-translate-y-1 hover:border-[var(--hfh-border-hover)]"
            >
              <div
                aria-hidden="true"
                className="aspect-[4/5] w-full rounded-[12px]"
                style={{ background: gradientFor(index + 1) }}
              />
              <p className="mt-3 px-1 text-sm font-semibold text-[var(--hfh-text)]">
                {project.title}
              </p>
              <p className="mt-0.5 px-1 pb-1 text-xs text-[var(--hfh-muted)]">
                {`by ${project.author} · Public`}
              </p>
            </Link>
          ))}
        </div>
        <p className="mt-6 text-center">
          <Link href={studioHref} className={outlineButtonClass}>
            Explore community
          </Link>
        </p>
      </section>

      <section ref={ctaRef} className="hfh-reveal mt-12">
        <div className="hfh-shimmer-border rounded-[24px] p-6 text-center sm:p-10">
          <h2
            className={`text-2xl leading-[1.05] text-[var(--hfh-text)] sm:text-4xl ${headlineClass}`}
          >
            One workspace for the whole creative stack
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-[var(--hfh-muted)]">
            Write, generate, direct, and publish without ever leaving the page.
          </p>
          <Link
            href={studioHref}
            className={`mt-6 ${primaryButtonClass}`}
          >
            Start creating
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </div>
  );
}
