"use client";

import { ChevronDown, Expand, Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProviderType } from "@/ai/types";
import { CREDITS_CONFIG } from "@/config/credits";
import { PremiereComposer } from "./premiere-composer";
import styles from "./premiere-hero.module.css";

const films = [
  {
    video: "/home/premiere-overture.mp4", poster: "/home/premiere-overture.webp",
    en: { title: "Tidal overture", prompt: "Open on black basalt cliffs above a silver-green sea. Cut from the curling surf to a face lit through glass, then to a lone figure beneath a stone arch." },
    zh: { title: "潮汐序曲", prompt: "从黑色玄武岩与银青色海面的远景开场。浪尖卷起，切到棱镜下的面孔，再切到巨型石拱下的孤独身影。" },
  },
  {
    video: "/home/hero-marina-loop.mp4", poster: "/home/hero-marina-poster.png",
    en: { title: "Harbor light", prompt: "A handheld camera glides past friends on the stern of a yacht as they clink glasses. Soft afternoon light sparkles on the water behind them." },
    zh: { title: "港湾日光", prompt: "午后的港湾里，镜头沿着游艇船尾缓缓移动。朋友们碰杯，远处水面反射出点点日光。" },
  },
  {
    video: "/home/hero-showcase-02.mp4", poster: "/home/premiere-scene-02.webp",
    en: { title: "First glimmer", prompt: "Hold a close two-shot of a couple in a leafy park. They turn toward one another as a warm, strange light flickers across their faces." },
    zh: { title: "微光初现", prompt: "用固定近景拍下林荫间的两个人。他们转头相望，一道温暖而奇异的光从面庞掠过。" },
  },
  {
    video: "/home/hero-showcase-03.mp4", poster: "/home/premiere-scene-03.webp",
    en: { title: "Amber eyes", prompt: "Two people clasp hands beneath sunlit trees. As their eyes meet, their irises glow amber. Keep the camera still and the leaves softly out of focus." },
    zh: { title: "琥珀目光", prompt: "两人在洒满阳光的树下握住彼此的手。目光相遇，瞳孔泛出琥珀色的光，背景的树叶柔和虚化。" },
  },
];

const durations = [13, 9.72, 5.04, 5.04];
const words = {
  zh: { h1: "AI 视频生成器。", h2: "电影级创作效果。", watch: "观看样片", close: "关闭放映", films: "切换展映短片", pause: "暂停短片", play: "播放短片", unavailable: "这部样片暂时无法播放，可选另一部。" },
  en: { h1: "AI video generator.", h2: "Studio-grade results.", watch: "Watch film", close: "Close screening", films: "Choose a film", pause: "Pause film", play: "Play film", unavailable: "This film could not load. Choose another screening." },
};

function timecode(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  return String(Math.floor(value / 60)).padStart(2, "0") + ":" + String(value % 60).padStart(2, "0");
}

export function PremiereHero({ lang, provider }: { lang: string; provider?: ProviderType }) {
  const language = lang.startsWith("zh") ? "zh" : "en";
  const zh = language === "zh";
  const t = words[language];
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [intent, setIntent] = useState<"auto" | "play" | "pause">("auto");
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [screening, setScreening] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(durations[0]);
  const stage = useRef<HTMLDivElement>(null);
  const background = useRef<HTMLVideoElement>(null);
  const cinema = useRef<HTMLDialogElement>(null);
  const film = films[index];
  const gift = CREDITS_CONFIG.registerGift;
  const benefit = gift.enabled && gift.amount > 0
    ? zh ? `注册获 ${gift.amount} 积分，提交前查看每段视频的用量。` : `Get ${gift.amount} starter credits. See each shot’s cost before you generate.`
    : zh ? "先写分镜，生成前查看本次用量。" : "Draft a shot and see its cost before you generate.";
  const loadFilm = !failed && (auto || intent === "play" || intent === "pause");

  useEffect(() => {
    const condition = matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    const update = () => setAuto(condition.matches);
    update();
    condition.addEventListener("change", update);
    return () => condition.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const player = background.current;
    const node = stage.current;
    if (!player || !node) return;
    let visible = true;
    const update = () => {
      if (document.hidden || !visible || screening || intent === "pause") player.pause();
      else void player.play().catch(() => {});
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    update();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, [index, intent, loadFilm, screening]);

  function chooseFilm(next: number) {
    setIndex(next);
    setDuration(durations[next]);
    setElapsed(0);
    setPlaying(false);
    setFailed(false);
    setIntent("auto");
  }
  function toggle() {
    if (playing) { setIntent("pause"); background.current?.pause(); }
    else { setFailed(false); setIntent("play"); void background.current?.play().catch(() => {}); }
  }
  const playLabel = playing ? t.pause : t.play;
  return (
    <section className={styles.premiere} aria-labelledby="premiere-title">
      <div ref={stage} className={styles.frame}>
        <picture>
          {index === 0 && <source media="(max-width: 767px)" srcSet="/home/premiere-coast-small.webp" />}
          <img className={styles.poster} src={film.poster} alt="" width={1600} height={736} loading="eager" fetchPriority="high" />
        </picture>
        {loadFilm && <video key={film.video} className={styles.plate} ref={background} muted loop playsInline preload="metadata" src={film.video}
          aria-label={film[language].title} onLoadedMetadata={event => { const value=event.currentTarget.duration; if (Number.isFinite(value)) setDuration(value); }}
          onTimeUpdate={event => setElapsed(Math.floor(event.currentTarget.currentTime))} onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false); }} />}
        <div className={styles.headline}>
          <h1 id="premiere-title" lang={lang}><span>{t.h1}</span><em>{t.h2}</em></h1>
          <p>{benefit}</p>
        </div>
      </div>
      <div className={styles.work}>
        <div className={styles.program}>
          <div className={styles.filmInfo}>
            <label className={styles.filmSelect}><span className="sr-only">{t.films}</span>
              <select value={index} onChange={event => chooseFilm(Number(event.target.value))}>
                {films.map((item,i) => <option key={item.video} value={i}>{item[language].title}</option>)}
              </select><ChevronDown size={14} aria-hidden="true" />
            </label>
            <span className={styles.clock}>{String(index+1).padStart(2,"0")} / 04 · {timecode(elapsed)} / {timecode(duration)}</span>
          </div>
          <div className={styles.transport}>
            <button type="button" onClick={toggle} aria-label={playLabel} title={playLabel}>{playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}</button>
            <button type="button" aria-label={t.watch} title={t.watch} onClick={() => { setScreening(true); cinema.current?.showModal(); }}><Expand aria-hidden="true" size={16}/></button>
          </div>
          {failed && <output className={styles.notice}>{t.unavailable}</output>}
        </div>
        <PremiereComposer lang={lang} provider={provider} shot={film[language].prompt} />
      </div>
      <dialog className={styles.cinema} ref={cinema} aria-label={film[language].title} onClose={() => setScreening(false)}
        onClick={event => { if(event.target === cinema.current) cinema.current.close(); }}>
        {screening && <><div className={styles.modalTop}><strong>{film[language].title}</strong>
          <button type="button" title={t.close} aria-label={t.close} onClick={() => cinema.current?.close()}><X aria-hidden="true" size={18}/></button></div>
          <video controls autoPlay muted playsInline src={film.video} poster={film.poster} aria-label={film[language].title} /></>}
      </dialog>
    </section>
  );
}
