"use client";

import { ArrowUpRight, Pause, Play } from "lucide-react";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { TOOL_PREFILL_KEY } from "@/components/gallery/use-template";
import { localizedHref } from "@/lib/du-home";
import { creationLabel } from "@/lib/creation-label";

export function ConversionHero({ lang }: { lang: string }) {
  const zh = lang.startsWith("zh");
  const movie = useRef<HTMLVideoElement>(null);
  const [eligible, setEligible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const rule = matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    const sync = () => setEligible(rule.matches);
    sync();
    rule.addEventListener("change", sync);
    return () => rule.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    const v = movie.current;
    if (!v) return;
    let withinHero = true;
    function sync() {
      if (!v) return;
      if (paused || document.hidden || !withinHero) v.pause();
      else void v.play().catch(() => {});
    }
    const observer = new IntersectionObserver(([entry]) => { withinHero = entry.isIntersecting; sync(); });
    observer.observe(v);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, [eligible, paused]);
  function openStudio(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const prompt = String(new FormData(form).get("shot") || "").trim();
    try {
      if (prompt) sessionStorage.setItem(TOOL_PREFILL_KEY, JSON.stringify({ prompt }));
      else sessionStorage.removeItem(TOOL_PREFILL_KEY);
    } catch { if (prompt) { setError(zh ? "请允许站点存储，以便将镜头带入工作台。" : "Allow site storage to carry your shot into the studio."); return; } }
    window.location.assign(form.action);
  }
  return <section className="du-hero" id="conversion-hero" aria-labelledby="creator-headline">
    <picture className="du-hero-media">
      <source media="(max-width:767px)" srcSet="/home/creative-reel-mobile.webp"/>
      <img src="/home/creative-reel-wide.webp" width={1440} height={662} alt="" fetchPriority="high" decoding="async"/>
    </picture>
    {eligible && <video className="du-hero-media" ref={movie} src="/home/creative-reel.mp4" poster="/home/creative-reel-wide.webp" playsInline autoPlay muted loop preload="none" tabIndex={-1} aria-label={zh ? "原创工作室样片" : "Original studio reel"} onPlaying={() => setPlaying(true)} onPause={() => setPlaying(false)}/>}
    <div className="du-hero-scrim"/>
    <div className="du-frame du-hero-content">
      <div className="du-eyebrow"><span aria-hidden="true"/> {zh ? "创作者工作室" : "Creative studio"}</div>
      <h1 id="creator-headline"><span>{zh ? "AI 视频生成器。" : "AI VIDEO GENERATOR."}</span>{" "}<small>{zh ? "电影级创作效果。" : "STUDIO-GRADE RESULTS."}</small></h1>
      <p>{zh ? "从一句描述开始，为你的下一部作品拍出第一个镜头。" : "Describe a shot. Find a look. Make the opening frame of your next film."}</p>
      <form action={localizedHref(lang, "/text-to-video")} onSubmit={openStudio}>
        <label htmlFor="du-shot" className="sr-only">{zh ? "描述你的镜头" : "Describe your shot"}</label>
        <input type="text" id="du-shot" name="shot" maxLength={2000} autoComplete="off" placeholder={zh ? "例如：镜头掠过黑色海岸，落在雾中的石拱……" : "A slow tracking shot along a black-sand coast…"}/>
        <button type="submit" className="du-primary">{creationLabel(lang)}<ArrowUpRight size={17} aria-hidden="true"/></button>
      </form>
      {error && <div role="alert">{error}</div>}
    </div>
    {eligible && <button type="button" className="du-film-toggle" onClick={() => { if (playing) { setPaused(true); movie.current?.pause(); } else { setPaused(false); void movie.current?.play().catch(() => {}); } }} aria-label={playing ? (zh ? "暂停背景短片" : "Pause background film") : (zh ? "播放背景短片" : "Play background film")}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>}
  </section>;
}
