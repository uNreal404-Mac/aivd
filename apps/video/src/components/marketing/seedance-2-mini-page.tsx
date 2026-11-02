import React from "react";

import {
  getSeedance2MiniCopy,
  localizedStudioHref,
} from "@/lib/seedance-2-mini-page";

export function Seedance2MiniPage({ locale }: { locale: string }) {
  const copy = getSeedance2MiniCopy(locale);

  return (
    <article className="bg-[var(--du-bg)] text-[var(--du-text)]">
      <div className="mx-auto max-w-[840px] px-6 py-16 sm:py-20">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--du-text-dim)]">
          {copy.eyebrow}
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-[1.1] sm:text-6xl">
          {copy.h1}
        </h1>
        <p className="mt-5 max-w-[640px] text-lg text-[var(--du-text-muted)]">
          {copy.lede}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {copy.ctas.map((cta) => (
            <a
              key={cta.href}
              href={localizedStudioHref(locale, cta.href)}
              className="inline-flex h-12 items-center justify-center rounded-xl bg-[var(--du-accent)] px-5 text-sm font-medium text-[var(--du-on-accent)]"
            >
              {cta.label}
            </a>
          ))}
        </div>

        <section className="mt-14">
          <h2 className="text-2xl font-bold">{copy.whatHeading}</h2>
          <p className="mt-3 text-[var(--du-text-muted)]">{copy.whatBody}</p>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">{copy.differHeading}</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {copy.differences.map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] p-5"
              >
                <h3 className="font-semibold text-[var(--du-accent-text)]">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm text-[var(--du-text-muted)]">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-2xl border border-[var(--du-border-strong)] bg-[var(--du-accent-soft)] p-6">
          <h2 className="text-2xl font-bold">{copy.sunsetHeading}</h2>
          <p className="mt-3 text-[var(--du-text-muted)]">{copy.sunsetBody}</p>
          <a
            href={localizedStudioHref(locale, copy.previousHref)}
            className="mt-4 inline-flex text-sm font-medium text-[var(--du-accent-text)]"
          >
            {copy.previousLabel}
          </a>
        </section>

        <section className="mt-12">
          <h2 className="text-2xl font-bold">{copy.studioHeading}</h2>
          <p className="mt-3 text-[var(--du-text-muted)]">{copy.studioBody}</p>
        </section>
      </div>
    </article>
  );
}
