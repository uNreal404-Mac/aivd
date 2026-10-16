"use client";

import { useState } from "react";
import { Heart, Play } from "lucide-react";

import { CATEGORY_CARDS, CATEGORY_FILTERS } from "@/lib/du-home";

export function DuHomeCategories() {
  const [active, setActive] = useState("All");

  const visibleCategories =
    active === "All" || active === "More"
      ? CATEGORY_CARDS
      : CATEGORY_CARDS.filter((card) => card.category === active);

  return (
    <>
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
                decoding="async"
                className="h-full w-full object-cover"
              />
              <span className="du-glass-btn du-glass-round du-glass-on-media absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center">
                <Play className="h-3.5 w-3.5 text-[var(--du-on-accent)]" />
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-sm text-[var(--du-text)]">{card.title}</span>
              <span
                aria-label="Like"
                className="du-glass-btn du-glass-on-media inline-flex items-center px-2 py-1 text-xs"
              >
                <Heart className="h-3 w-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
