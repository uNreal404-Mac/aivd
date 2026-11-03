"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { cancelFrame, frame } from "motion/react";
import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import s from "./conversion-showcase.module.css";

export type TemplateMedia = {
  name: string;
  href: string;
  poster: string;
  video: string;
  alt: string;
};

function TemplateTile({ item, slot, copy, selected, onPreview, zh }: {
  item: TemplateMedia; slot: number; copy: boolean; selected: boolean; zh: boolean; onPreview: (play: boolean) => void;
}) {
  const tile = useRef<HTMLDivElement>(null);
  const onPreviewRef = useRef(onPreview);
  onPreviewRef.current = onPreview;
  useEffect(() => {
    if (!selected || !tile.current) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.intersectionRatio < .3) onPreviewRef.current(false);
    }, { threshold: [.3] });
    observer.observe(tile.current);
    const stop = () => { if (document.hidden) onPreviewRef.current(false); };
    document.addEventListener("visibilitychange", stop);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", stop); };
  }, [selected]);

  function preview() {
    if (tile.current && matchMedia("(hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)").matches) onPreview(true);
  }
  return <div className="motion-tile" ref={tile} data-order={slot}
    onPointerEnter={e => { if (e.pointerType === "mouse") preview(); }}
    onPointerLeave={e => { if (e.pointerType === "mouse") onPreview(false); }}>
    <a href={item.href} aria-label={item.name} tabIndex={copy ? -1 : undefined} className={s.template}
      onFocus={e => { if (e.currentTarget.matches(":focus-visible")) preview(); }} onBlur={() => onPreview(false)}>
      <img width={720} height={400} src={item.poster} loading="lazy" decoding="async" alt={item.alt}/>
      {selected && <video src={item.video} poster={item.poster} autoPlay muted loop playsInline preload="none" aria-label={item.name} onError={() => onPreview(false)}/>}
      <span className={s.tileName}>{item.name}</span>
    </a>
    {!copy && <button type="button" className="motion-touch-preview" aria-pressed={selected}
      title={(selected ? (zh ? "暂停 " : "Pause ") : (zh ? "预览 " : "Preview ")) + item.name}
      aria-label={(selected ? (zh ? "暂停 " : "Pause ") : (zh ? "预览 " : "Preview ")) + item.name}
      onClick={() => onPreview(!selected)}>{selected ? <Pause size={15}/> : <Play size={15}/>}</button>}
  </div>;
}

export function TemplateWall({ items, zh }: { items: TemplateMedia[]; zh: boolean }) {
  const wall = useRef<HTMLElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    const area = wall.current;
    if (!area) return;
    const rule = matchMedia("(min-width:768px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:no-preference)");
    const lanes = Array.from(area.querySelectorAll<HTMLElement>("[data-motion-lane]"));
    let last = 0;
    let visible = false;
    let positions: number[] = [];
    function tick({ timestamp: now }: { timestamp: number }) {
      const distance = Math.min(now - (last || now), 48) * .024;
      last = now;
      for (const [i,lane] of lanes.entries()) {
        const size = lane.children[1]?.getBoundingClientRect().width || 0;
        if (!size) continue;
        if (positions[i] === undefined) positions[i] = lane.scrollLeft || (i ? size : 0);
        positions[i] = (positions[i] + (i ? -distance : distance) + size) % size;
        lane.scrollLeft = positions[i];
      }

    }
    function sync() {
      cancelFrame(tick); last = 0; positions = [];
      if (rule.matches && visible && !paused && !engaged && !document.hidden) frame.update(tick, true);
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(area);
    const changed = () => { if (!rule.matches) setPreview(null); sync(); };
    rule.addEventListener("change", changed);
    document.addEventListener("visibilitychange", sync);
    return () => { cancelFrame(tick); observer.disconnect(); rule.removeEventListener("change", changed); document.removeEventListener("visibilitychange", sync); };
  }, [engaged, paused]);

  function step(direction: number) {
    const area = wall.current;
    if (!area) return;
    setPaused(true);
    const lanes = matchMedia("(min-width:768px)").matches ? Array.from(area.querySelectorAll<HTMLElement>("[data-motion-lane]")) : [area];
    for (const lane of lanes) {
      const tile = lane.querySelector<HTMLElement>(".motion-tile");
      const size = tile?.offsetWidth || lane.clientWidth;
      const max = lane.scrollWidth - lane.clientWidth;
      const next = direction > 0 && lane.scrollLeft >= max - 1 ? 0 : direction < 0 && lane.scrollLeft <= 1 ? max : lane.scrollLeft + direction * (size + 16);
      lane.scrollTo({left: next, behavior: matchMedia("(prefers-reduced-motion:reduce)").matches ? "instant" : "smooth"});
    }
  }
  return <div className={s.reel}>
    <div className={s.reelControls}>
      <button type="button" className="motion-marquee-toggle" aria-pressed={paused}
        title={paused ? (zh ? "继续滚动" : "Resume") : (zh ? "暂停滚动" : "Pause")}
        aria-label={paused ? (zh ? "继续滚动模板" : "Resume template motion") : (zh ? "暂停滚动模板" : "Pause template motion")}
        onClick={() => setPaused(!paused)}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button>
      <button type="button" aria-controls="template-wall" title={zh ? "上一组" : "Previous"} aria-label={zh ? "向前浏览模板" : "Previous templates"} onClick={() => step(-1)}><ChevronLeft size={19}/></button>
      <button type="button" aria-controls="template-wall" title={zh ? "下一组" : "Next"} aria-label={zh ? "向后浏览模板" : "Next templates"} onClick={() => step(1)}><ChevronRight size={19}/></button>
    </div>
    <section id="template-wall" ref={wall} data-showcase-wall="" className={s.wall + " motion-wall"} aria-label={zh ? "视频模板浏览区" : "Browse video templates"}
      onPointerEnter={e => { if(e.pointerType === "mouse") setEngaged(true); }} onPointerLeave={() => setEngaged(false)}
      onFocusCapture={() => setEngaged(true)} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget)) setEngaged(false); }}>
      {[0,1].map(row => <div className="motion-lane" data-motion-lane="" data-showcase-column="" key={row}>
        {[0,1].map(copy => <div className="motion-run" data-copy={copy} aria-hidden={copy ? true : undefined} key={copy}>
          {items.map((item, slot) => {
            if (slot % 2 !== row) return null;
            const id = slot + ":" + copy;
            return <TemplateTile item={item} slot={slot} key={id} copy={!!copy} zh={zh} selected={preview===id}
              onPreview={play => setPreview(current => play ? id : current===id ? null : current)}/>;
          })}
        </div>)}
      </div>)}
    </section>
  </div>;
}

const ScrollFilmCues = lazy(() => import("./scroll-film-cues").then(module => ({ default: module.ScrollFilmCues })));
const screenTestCuts = [
  { poster: "/conversion/showcase/daylight-take-1.webp", at: 0 },
  { poster: "/conversion/showcase/daylight-take-2.webp", at: 4 },
  { poster: "/conversion/showcase/daylight-take-3.webp", at: 8 },
];

export function FeatureFilm({ src, label, playLabel }: { src: string; label: string; playLabel: string }) {
  const stage = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const [cut, setCut] = useState(0);
  const [followScroll, setFollowScroll] = useState(false);
  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const media = matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    let visible = false;
    const sync = () => {
      setFollowScroll(visible && media.matches);
      if (!media.matches) setCut(0);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(node);
    media.addEventListener("change", sync);
    return () => { media.removeEventListener("change", sync); observer.disconnect(); };
  }, []);
  const cue = screenTestCuts[cut];
  return <div ref={stage} className={s.filmStage}>
    {followScroll && !started && <Suspense fallback={null}><ScrollFilmCues film={stage} onCut={setCut} /></Suspense>}
    {started ? (
      <video className={s.film} ref={player => { player?.focus({ preventScroll: true }); }} src={src} poster={cue.poster}
        onLoadedMetadata={e => { e.currentTarget.currentTime = cue.at; }} controls autoPlay muted playsInline preload="metadata" aria-label={label} />
    ) : (
      <button className={s.film} type="button" onClick={() => setStarted(true)} aria-label={playLabel}>
        <img src={cue.poster} width={1600} height={736} loading="lazy" decoding="async" alt={label} />
        <span className={s.filmPlay}><Play size={18} aria-hidden="true" />{playLabel}</span>
        <span className={s.cutIndex} aria-hidden="true">{String(cut + 1).padStart(2, "0")} / 03</span>
      </button>
    )}
  </div>;
}

export function EndFrame({ zh }: { zh: boolean }) {
  const frame = useRef<HTMLElement>(null);
  const [eligible, setEligible] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const media = matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    let visible = false;
    function sync() {
      setEligible(visible && media.matches && !document.hidden);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    }, { threshold: 0.3 });
    observer.observe(node);
    media.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const label = zh ? "折光引擎" : "Optical Engine";
  const control = paused ? (zh ? "播放示例" : "Play sample") : (zh ? "暂停示例" : "Pause sample");
  return (
    <figure className={s.endFrame} ref={frame}>
      <img loading="lazy" decoding="async" src="/home/cutroom-optics.webp" width={960} height={544} alt={label} />
      {eligible && !paused && <video src="/home/cutroom-optics.mp4" poster="/home/cutroom-optics.webp" aria-label={label} muted autoPlay loop playsInline preload="none" />}
      {eligible && <button type="button" aria-label={control} title={control} onClick={() => setPaused(value => !value)}>
        {paused ? <Play aria-hidden="true" size={16} /> : <Pause aria-hidden="true" size={16} />}
      </button>}
    </figure>
  );
}
