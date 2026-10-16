"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  buildUsePromptHref,
  CATEGORY_LABELS,
  copyFor,
  EXPLORE_CATEGORIES,
  EXPLORE_ITEMS,
  filterExplore,
  modelName,
} from "@/lib/explore-data";
import type { ExploreCategory, ExploreItem } from "@/lib/explore-data";

type ExploreGalleryProps = {
  lang: string;
};

function ExploreCard({ item, lang }: { item: ExploreItem; lang: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const title = lang === "zh" ? item.title.zh : item.title.en;
  const copy = copyFor(lang);

  function playVideo() {
    const video = videoRef.current;
    if (!video) return;
    void video.play();
  }

  function stopVideo() {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    video.currentTime = 0;
  }

  return (
    <div
      className="relative mb-[var(--ex-gap)] break-inside-avoid overflow-hidden rounded-[var(--ex-radius-card)] border border-[var(--ex-border)] bg-[var(--ex-surface)]"
      onMouseEnter={item.video ? playVideo : undefined}
      onMouseLeave={item.video ? stopVideo : undefined}
    >
      {item.video ? (
        <video
          ref={videoRef}
          className="block h-auto w-full"
          src={item.video}
          poster={item.image}
          width={item.width}
          height={item.height}
          muted
          loop
          playsInline
          preload="none"
        />
      ) : (
        <img
          className="block h-auto w-full"
          src={item.image}
          alt={title}
          width={item.width}
          height={item.height}
          loading="lazy"
        />
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-3 [background-image:var(--ex-overlay)]">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[14px] font-semibold text-[var(--ex-text)]">
            {title}
          </span>
          <span className="truncate text-[12px] text-[var(--ex-muted)]">
            {modelName(item.modelId)}
          </span>
        </div>
        <Link
          href={buildUsePromptHref(lang, item)}
          className="ex-glass-btn shrink-0 rounded-full px-3 py-1 text-[12px] font-medium"
        >
          {copy.use}
        </Link>
      </div>
    </div>
  );
}

export function ExploreGallery({ lang }: ExploreGalleryProps) {
  const [category, setCategory] = useState<ExploreCategory>("all");
  const copy = copyFor(lang);
  const items = filterExplore(EXPLORE_ITEMS, category);

  return (
    <div className="flex w-full flex-col gap-[var(--ex-gap)]">
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={copy.title}
      >
        {EXPLORE_CATEGORIES.map((value) => {
          const isActive = value === category;
          const label = CATEGORY_LABELS[value][lang === "zh" ? "zh" : "en"];

          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-pressed={isActive}
              onClick={() => setCategory(value)}
              className={
                isActive
                  ? "rounded-[var(--ex-radius-chip)] bg-[var(--ex-accent)] px-4 py-1.5 text-sm font-medium text-[var(--ex-on-accent)]"
                  : "ex-glass-btn rounded-[var(--ex-radius-chip)] px-4 py-1.5 text-sm font-medium"
              }
            >
              {label}
            </button>
          );
        })}
      </div>

      {items.length === 0 ? (
        <p className="py-16 text-center text-[var(--ex-muted)]">{copy.empty}</p>
      ) : (
        <div className="columns-2 [column-gap:var(--ex-gap)] lg:columns-4">
          {items.map((item) => (
            <ExploreCard key={item.id} item={item} lang={lang} />
          ))}
        </div>
      )}
    </div>
  );
}
