"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import s from "./conversion-showcase.module.css";

export type TemplateMedia = {
  name: string;
  href: string;
  poster: string;
  video: string;
  alt: string;
};

function TemplateTile({ item }: { item: TemplateMedia }) {
  const [playing, setPlaying] = useState(false);
  function preview() {
    if (window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) {
      setPlaying(true);
    }
  }

  return (
    <a href={item.href} aria-label={item.name} className={s.template}
      onPointerEnter={(event) => { if (event.pointerType !== "touch") preview(); }}
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) preview(); }}
      onPointerLeave={() => setPlaying(false)} onBlur={() => setPlaying(false)}>
      <img width={720} height={400} src={item.poster} loading="lazy" decoding="async" alt={item.alt} />
      {playing && <video src={item.video} poster={item.poster} autoPlay muted loop playsInline preload="none" onError={() => setPlaying(false)} />}
      <span className={s.tileName}><Play size={14} aria-hidden="true" />{item.name}</span>
    </a>
  );
}

export function TemplateWall({ items, zh }: { items: TemplateMedia[]; zh: boolean }) {
  const wall = useRef<HTMLElement>(null);
  function step(direction: number) {
    const el = wall.current;
    const tile = el?.querySelector<HTMLElement>("a");
    if (!el || !tile) return;
    const gap = Number.parseFloat(getComputedStyle(el).columnGap) || 0;
    el.scrollBy({ left: direction * (tile.getBoundingClientRect().width + gap), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }
  return (
    <div className={s.reel}>
      <div className={s.reelControls}>
        <button type="button" aria-controls="template-wall" aria-label={zh ? "向前浏览模板" : "Previous templates"} onClick={() => step(-1)}><ChevronLeft size={19} /></button>
        <button type="button" aria-controls="template-wall" aria-label={zh ? "向后浏览模板" : "Next templates"} onClick={() => step(1)}><ChevronRight size={19} /></button>
      </div>
      <section id="template-wall" ref={wall} className={s.wall} data-showcase-wall="" aria-label={zh ? "视频模板浏览区" : "Browse video templates"}>
        {items.filter((_, i) => i % 2 === 0).map((first, i) => (
          <div key={first.href} className={s.column} data-showcase-column="">
            <TemplateTile item={first} />
            {items[i * 2 + 1] && <TemplateTile item={items[i * 2 + 1]} />}
          </div>
        ))}
      </section>
    </div>
  );
}

export function FeatureFilm({ poster, src, label, playLabel }: { poster: string; src: string; label: string; playLabel: string }) {
  const [started, setStarted] = useState(false);
  return started ? (
    <video className={s.film} ref={(player) => { player?.focus({ preventScroll: true }); }} src={src} poster={poster} controls autoPlay muted playsInline preload="metadata" aria-label={label} />
  ) : (
    <button className={s.film} type="button" onClick={() => setStarted(true)} aria-label={playLabel}>
      <img src={poster} width={1600} height={736} loading="lazy" decoding="async" alt={label} />
      <span className={s.filmPlay}><Play size={24} aria-hidden="true" />{playLabel}</span>
    </button>
  );
}
