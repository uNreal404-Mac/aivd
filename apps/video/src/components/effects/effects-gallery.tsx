"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  CATEGORY_LABELS,
  EFFECT_CATEGORIES,
  EFFECT_TEMPLATES,
  copyFor,
  filterEffects,
  labelFor,
  useHref,
  type EffectsCategory,
} from "@/lib/effects-data";

type EffectsGalleryProps = {
  lang: string;
};

export function EffectsGallery({ lang }: EffectsGalleryProps) {
  const [category, setCategory] = useState<EffectsCategory>("all");
  const copy = copyFor(lang);
  const items = useMemo(
    () => filterEffects(EFFECT_TEMPLATES, category),
    [category],
  );

  return (
    <div className="flex flex-col gap-[var(--fx-gap)]">
      <div aria-label={copy.title} className="flex flex-wrap gap-2">
        {EFFECT_CATEGORIES.map((item) => {
          const isActive = item === category;
          return (
            <button
              aria-pressed={isActive}
              className={`inline-flex h-9 items-center rounded-[var(--fx-radius-chip)] px-4 text-sm transition-colors ${
                isActive
                  ? "bg-[var(--fx-accent)] text-[color:var(--fx-on-accent)]"
                  : "fx-glass-btn text-[color:var(--fx-text)]"
              }`}
              key={item}
              onClick={() => setCategory(item)}
              type="button"
            >
              {labelFor(CATEGORY_LABELS[item], lang)}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="py-16 text-center text-sm text-[color:var(--fx-muted)]">
          {copy.empty}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-[var(--fx-gap)] md:grid-cols-3 lg:grid-cols-4">
          {items.map((template) => {
            const name = labelFor(template.name, lang);
            return (
              <li key={template.id}>
                <div className="group relative aspect-[4/5] overflow-hidden rounded-[var(--fx-radius-card)] border border-[color:var(--fx-border)] bg-[var(--fx-surface)]">
                  <Image
                    alt={name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    height={800}
                    loading="lazy"
                    src={template.image}
                    width={640}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{ backgroundImage: "var(--fx-overlay)" }}
                  />
                  {template.badge === "new" ? (
                    <span className="fx-glass-btn absolute left-3 top-3 inline-flex h-6 items-center rounded-[var(--fx-radius-chip)] px-2 text-xs">
                      {copy.newBadge}
                    </span>
                  ) : null}
                  <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-3">
                    <p className="text-[15px] font-semibold text-[color:var(--fx-text)]">
                      {name}
                    </p>
                    <p className="line-clamp-2 text-[12px] text-[color:var(--fx-muted)]">
                      {labelFor(template.description, lang)}
                    </p>
                    <Link
                      className="fx-glass-btn inline-flex h-8 items-center rounded-full px-3 text-xs"
                      href={useHref(lang, template)}
                    >
                      {copy.use}
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
