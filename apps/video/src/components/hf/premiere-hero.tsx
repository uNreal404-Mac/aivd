"use client";

import { Aperture, ArrowUpRight, Clapperboard, Expand, ImagePlus, Pause, Play, WandSparkles, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { TOOL_PREFILL_KEY } from "@/components/gallery/use-template";
import { localizedHref } from "@/lib/du-home";
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

const words = {
  zh: { showcase: "短片展映", h1: "AI 视频生成器。", h2: "电影级创作效果。", intro: "写下一幕，或从一张照片开始。", describe: "写下你的镜头", placeholder: "镜头从海面缓缓升起，穿过薄雾，靠近一艘游艇……", use: "用这段分镜", image: "从图片开始", create: "进入创作", watch: "观看样片", close: "关闭放映", films: "切换展映短片", pause: "暂停背景视频", play: "播放背景视频", unavailable: "此样片暂时无法播放。请选择另一部短片。", storage: "请允许站点存储，以便把你的提示词带到工作台。" },
  en: { showcase: "Studio screenings", h1: "AI video generator.", h2: "Studio-grade results.", intro: "Describe a scene, or start with a photograph.", describe: "Describe your shot", placeholder: "A camera skims the water, rising through the mist toward a yacht…", use: "Use this shot", image: "Start with an image", create: "Open studio", watch: "Watch film", close: "Close screening", films: "Choose a film", pause: "Pause background film", play: "Play background film", unavailable: "This film is unavailable. Choose another screening.", storage: "Allow site storage to take your prompt into the studio." },
};

export function PremiereHero({ lang }: { lang: string }) {
  const language = lang.toLowerCase().startsWith("zh") ? "zh" : "en";
  const t = words[language];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [motionMode, setMotionMode] = useState<"auto" | "paused" | "playing">("auto");
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState(false);
  const [screening, setScreening] = useState(false);
  const background = useRef<HTMLVideoElement>(null);
  const cinema = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const film = films[index];

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const video = background.current;
    if (!video) return;
    function sync() {
      if (motionMode === "paused" || (motionMode === "auto" && motion.matches) || screening || document.hidden) video?.pause();
      else void video?.play().catch(() => {});
    }
    sync();
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { motion.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); };
  }, [index, screening, motionMode]);

  function selectFilm(next: number) {
    if (next === index) return;
    setMediaError(false);
    setIndex(next);
  }

  function toggleMotion() {
    const video = background.current;
    if (!video) return;
    if (!video.paused) { video.pause(); setMotionMode("paused"); }
    else { setMotionMode("playing"); void video.play().catch(() => setMediaError(true)); }
  }

  function usePrompt() {
    setPrompt(film[language].prompt);
    setError("");
    input.current?.focus();
  }

  function openStudio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = prompt.trim();
    try {
      if (value) sessionStorage.setItem(TOOL_PREFILL_KEY, JSON.stringify({ prompt: value }));
      else sessionStorage.removeItem(TOOL_PREFILL_KEY);
    } catch {
      if (value) { setError(t.storage); return; }
    }
    window.location.assign(event.currentTarget.action);
  }

  return (
    <section className={styles.premiere} aria-labelledby="premiere-title">
      <div className={styles.frame}>
        <div className={styles.picture} key={film.video}>
          <video ref={background} muted loop playsInline preload="metadata" poster={film.poster} src={film.video}
            aria-hidden="true" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setMediaError(true); }} />
        </div>
        <div className={styles.shade} />
        <div className={styles.stageTop}>
          <span className={styles.kicker}><span className={styles.signal} />{t.showcase}</span>
          <button className={styles.watch} type="button" onClick={() => { cinema.current?.showModal(); setScreening(true); }}><Expand size={14} />{t.watch}</button>
        </div>
        <div className={styles.headline}>
          <h1 id="premiere-title" lang={lang}><span>{t.h1}</span><em>{t.h2}</em></h1>
          <p>{t.intro}</p>
        </div>
        <form className={styles.composer} action={localizedHref(lang, "/text-to-video")} onSubmit={openStudio}>
          <div className={styles.inputLine}>
            <span className={styles.inputIcon} aria-hidden="true"><Clapperboard size={19} strokeWidth={1.5} /></span>
            <label htmlFor="premiere-prompt" className="sr-only">{t.describe}</label>
            <textarea id="premiere-prompt" ref={input} rows={2} maxLength={2000} value={prompt} placeholder={t.placeholder} onChange={event => { setPrompt(event.target.value); setError(""); }} />
          </div>
          <div className={styles.formActions}>
            <button className={styles.promptAction} type="button" onClick={usePrompt}><WandSparkles size={15} />{t.use}</button>
            <a className={styles.promptAction} href={localizedHref(lang, "/image-to-video")}><ImagePlus size={15} />{t.image}</a>
            <button type="submit" className={styles.create}>{t.create}<ArrowUpRight size={18} strokeWidth={2} /></button>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
        </form>
      </div>
      <div className={styles.program}>
        <span className={styles.stripName}><Aperture size={19} strokeWidth={1.4} />{language === "zh" ? "展映片单" : "The program"}</span>
        <div className={styles.films} role="group" aria-label={t.films}>
          {films.map((scene, i) => <button type="button" key={scene.video} aria-pressed={index === i} onClick={() => selectFilm(i)}>
            <span className={styles.filmNo}>0{i + 1}</span><span>{scene[language].title}</span>
          </button>)}
        </div>
        <button type="button" className={styles.toggle} onClick={toggleMotion} aria-label={playing ? t.pause : t.play} title={playing ? t.pause : t.play}>{playing ? <Pause size={15} /> : <Play size={15} />}</button>
      </div>
      {mediaError && <p className={styles.mediaError} role="status">{t.unavailable}</p>}
      <dialog className={styles.cinema} ref={cinema} aria-label={film[language].title} onClose={() => setScreening(false)} onClick={event => { if (event.target === cinema.current) cinema.current?.close(); }}>
        {screening && <div className={styles.projection}>
          <div className={styles.modalTop}><span>{film[language].title}</span><button type="button" autoFocus onClick={() => cinema.current?.close()} aria-label={t.close}><X size={20} /></button></div>
          <video controls autoPlay muted playsInline src={film.video} poster={film.poster} aria-label={film[language].title} />
        </div>}
      </dialog>
    </section>
  );
}
