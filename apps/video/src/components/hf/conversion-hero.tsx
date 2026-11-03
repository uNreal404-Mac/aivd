"use client";

import { MotionTitle } from "@/components/motion/accents";
import Image from "next/image";
import { ChevronDown, Crosshair, Expand, Pause, Play, X } from "lucide-react";
import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { PromptBox } from "@/components/hf/prompt-box";
import s from "./conversion-hero.module.css";

type Title = [string, string];
type FilmCue = { at: number; title: Title; prompt: Title };
type StudioFilm = { key: string; title: Title; video: string; poster: string; duration: number; cues: FilmCue[] };

const films: StudioFilm[] = [
  { key: "prism", title: ["潮汐序曲", "Tidal Overture"], video: "/home/studio-prism-cut.mp4", poster: "/home/studio-prism-wide.webp", duration: 13,
    cues: [{ at: 0, title: ["棱镜人像", "Prism portrait"], prompt: ["切到一张被水晶棱镜照亮的面孔。固定机位，浅景深，让一道细窄光谱缓缓划过眼睛。", "Cut to a face lit through a crystal prism. Lock the camera, keep the depth of field shallow, and drift a narrow spectrum across the eyes."] }, { at: 4.5, title: ["海岸远景", "Coastal wide"], prompt: ["以极远景拍摄黑色玄武岩海岸。让银青色海浪沿画面对角线涌入，用低云压住地平线，人物只占画面的一小点。", "Open wide on a black basalt coast. Run the silver-green surf diagonally into the frame beneath low clouds; hold a lone figure very small against the shoreline."] }, { at: 8.75, title: ["石拱全景", "Monument wide"], prompt: ["以对称全景拍摄雾中的巨大石拱，人物背对镜头，站在门洞下。让侧光勾出湿润石面的纹理。", "Frame a monumental stone arch in mist with a symmetrical wide shot. Place a figure with their back to us inside the opening and rake soft light across the wet stone."] }] },
  { key: "optics", title: ["折光引擎", "Optical Engine"], video: "/home/cutroom-optics.mp4", poster: "/home/cutroom-optics.webp", duration: 10,
    cues: [{ at: 0, title: ["镜组轮廓", "The silhouette"], prompt: ["让一组悬浮的光学镜片占据画面右侧，左侧留出黑色负空间。用一道冷白色轮廓光擦亮金属环的边缘，让观众先看见外形，再看见玻璃。", "Suspend an optical assembly on the right of a black frame, leaving negative space on the left. Skim the outer metal rings with a cool white rim light so the silhouette reads before the glass."] }, { at: 3.4, title: ["机械转动", "Rotating elements"], prompt: ["微距观察缓缓转动的精密镜组。让抛光金属在窄束灯光下逐层反射，保持背景纯黑，焦点落在两道轮廓交错的位置。", "Study the rotating lens elements in macro. Let a narrow strip of light travel across the polished metal, holding focus where two arcs cross against black."] }, { at: 6.9, title: ["折射光心", "Refracted light"], prompt: ["拍摄光学装置的玻璃核心，让冰青色的光从玻璃内侧折出。保持转动平稳，把最亮的一笔高光留在镜片边缘。", "Frame the glass heart of an optical instrument. Refract an icy cyan light through it, keeping the rotation smooth and the brightest highlight on the edge of the lens."] }] },
  { key: "harbor", title: ["港湾日光", "Harbor Light"], video: "/home/screening-harbor.mp4", poster: "/home/screening-harbor.webp", duration: 9.72, cues: [{ at: 0, title: ["船尾跟拍", "On the stern"], prompt: ["午后，手持镜头沿游艇船尾缓缓移动。让碰杯的朋友们留在中景，海面反射的日光在他们身后跳动。", "Glide a handheld camera along the stern of a yacht in the afternoon. Hold friends clinking glasses in a medium shot, letting points of sunlight dance on the water behind them."] }] },
  { key: "glimmer", title: ["微光初现", "First Glimmer"], video: "/home/screening-glimmer.mp4", poster: "/home/screening-glimmer.webp", duration: 5.04, cues: [{ at: 0, title: ["双人近景", "The two-shot"], prompt: ["用固定双人近景拍下林荫间的两个人。他们转头相望，一道温暖而奇异的光从面庞掠过，让背景保持柔和。", "Hold a close two-shot of two people in a leafy park. As they turn toward one another, let a strange warm light cross their faces against the soft background."] }] },
  { key: "amber", title: ["琥珀目光", "Amber Eyes"], video: "/home/screening-amber.mp4", poster: "/home/screening-amber.webp", duration: 5.04, cues: [{ at: 0, title: ["目光特写", "The amber gaze"], prompt: ["两人在洒满阳光的树下握住彼此的手。目光相遇时让瞳孔泛出琥珀色的光，机位保持稳定，树叶在背景中柔和虚化。", "Two people clasp hands beneath sunlit trees. When their eyes meet, let their irises glow amber. Hold the camera still and keep the leaves softly out of focus."] }] },
];

function clock(seconds: number) {
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}

function cueTime(seconds: number) {
  return clock(seconds) + "." + String(Math.round((seconds % 1) * 100)).padStart(2, "0");
}

export function ConversionHero({ lang, initialPoster }: { lang: string; initialPoster: ReactNode }) {
  const zh = lang.startsWith("zh");
  const l = zh ? 0 : 1;
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(films[0].duration);
  const [autoAllowed, setAutoAllowed] = useState(false);
  const [videoRequested, setVideoRequested] = useState(false);
  const [intent, setIntent] = useState<"auto" | "play" | "pause">("auto");
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [overlay, setOverlay] = useState<"off" | "thirds" | "vertical" | "scope">("off");
  const [screening, setScreening] = useState(false);
  const film = films[index];
  const cueIndex = film.cues.reduce((found, cue, i) => elapsed + .001 >= cue.at ? i : found, 0);
  const mounted = videoRequested || autoAllowed;
  const still = !mounted && cueIndex > 0 ? "/home/studio-frame-" + film.key + "-" + (cueIndex + 1) + ".webp" : film.poster;
  const stage = useRef<HTMLDivElement>(null);
  const movie = useRef<HTMLVideoElement>(null);
  const projected = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLDialogElement>(null);
  const pendingSeek = useRef(0);
  const screeningStart = useRef(0);

  useEffect(() => {
    const rule = matchMedia("(min-width: 768px) and (prefers-reduced-motion: no-preference)");
    const sync = () => setAutoAllowed(rule.matches);
    sync();
    rule.addEventListener("change", sync);
    return () => rule.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const v = movie.current;
    if (!v || !stage.current) return;
    let visible = true;
    function sync() {
      if (!v) return;
      if (!visible || document.hidden || screening || intent === "pause") v.pause();
      else void v.play().catch(() => {});
    }
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    observer.observe(stage.current);
    document.addEventListener("visibilitychange", sync);
    sync();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [index, mounted, intent, screening]);

  useEffect(() => {
    if (screening && !screen.current?.open) screen.current?.showModal();
  }, [screening]);

  function choose(i: number) {
    if (i === index) return;
    pendingSeek.current = 0;
    setElapsed(0);
    setDuration(films[i].duration);
    setIntent("auto");
    setVideoRequested(false);
    setPlaying(false);
    setFailed(false);
    setIndex(i);
  }

  function seek(seconds: number) {
    pendingSeek.current = seconds;
    setElapsed(seconds);
    setIntent("pause");
    const v = movie.current;
    if (v && v.readyState >= 1) {
      v.pause();
      v.currentTime = seconds;
    }
  }

  function toggle() {
    if (playing) {
      movie.current?.pause();
      setIntent("pause");
    } else {
      setVideoRequested(true);
      setIntent("play");
      void movie.current?.play().catch(() => {});
    }
  }

  function finishScreening() {
    if (projected.current && projected.current.readyState >= 1) {
      setVideoRequested(true);
      seek(projected.current.currentTime);
    }
    setScreening(false);
  }

  const guideLabel = zh ? "构图参考线" : "Composition guides";
  const cinemaLabel = zh ? "纯净放映" : "Clean screening";
  const playLabel = playing ? (zh ? "暂停影片" : "Pause film") : (zh ? "播放影片" : "Play film");
  const selectedCue = film.cues[cueIndex];

  return <section id="conversion-hero" className={s.hero} aria-labelledby="creator-headline">
    <div className={s.studio}>
      <div ref={stage} className={s.screen} data-film={film.key}>
        <div className={s.picture} key={film.video}>
          {index === 0 && still === films[0].poster ? initialPoster : (
            <Image fill data-studio-poster="" unoptimized loading="eager" src={still} alt="" />
          )}
          {mounted && !failed && <video ref={movie} src={film.video} poster={film.poster} muted loop playsInline preload="metadata" tabIndex={-1}
            aria-label={film.title[l]} onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (Number.isFinite(v.duration) && v.duration > 0) setDuration(v.duration);
              if (pendingSeek.current) v.currentTime = Math.min(pendingSeek.current, v.duration);
            }}
            onTimeUpdate={(e) => setElapsed(e.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
            onError={() => { setFailed(true); setPlaying(false); }} />}
        </div>
        {overlay === "thirds" && <div className={s.guides} aria-hidden="true"><i/><i/><b/><b/></div>}
        {(overlay === "vertical" || overlay === "scope") && <div className={s.safeArea} data-format={overlay} aria-hidden="true" />}
        {overlay !== "off" && <fieldset className={s.guideMenu} aria-label={zh ? "构图参考样式" : "Composition overlay"}>
          {(["thirds","vertical","scope"] as const).map((g,i) => <button type="button" key={g} aria-pressed={g === overlay} onClick={() => setOverlay(g)}>{[zh ? "三分线" : "Thirds","9:16","2.39:1"][i]}</button>)}
        </fieldset>}
      </div>

      <div className={s.caption}>
        <div className={s.transport}>
          <label className={s.filmName}>
            <span className="sr-only">{zh ? "选择展映短片" : "Choose a featured film"}</span>
            <select value={index} onChange={e=>choose(Number(e.target.value))}>{films.map((f,i)=><option key={f.key} value={i}>{f.title[l]}</option>)}</select>
            <ChevronDown size={15} aria-hidden="true" />
          </label>
          <span className={s.clock}>{clock(elapsed)} <span>/ {clock(duration)}</span></span>
          <div className={s.tools}>
            <button type="button" aria-pressed={overlay !== "off"} aria-label={guideLabel} title={guideLabel} onClick={() => setOverlay(overlay === "off" ? "thirds" : "off")}><Crosshair size={17}/></button>
            <button type="button" aria-label={cinemaLabel} title={cinemaLabel} onClick={() => { screeningStart.current = movie.current?.currentTime ?? elapsed; setScreening(true); }}><Expand size={17}/></button>
            <button type="button" className={s.play} disabled={failed} aria-label={playLabel} title={playLabel} onClick={toggle}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
          </div>
        </div>
        <div className={s.scrubber} style={{ "--playhead": (Math.max(0, Math.min(1, elapsed / duration)) * 100) + "%" } as CSSProperties}>
          <div className={s.track}><i /></div>
          <label className="sr-only" htmlFor="cut-seek">{zh ? "拖动查看短片画格" : "Scrub through film frames"}</label>
          <input id="cut-seek" type="range" min={0} max={duration} step={.04} value={Math.min(elapsed, duration)} onChange={(e) => seek(Number(e.target.value))} disabled={failed} aria-valuetext={elapsed.toFixed(2) + " / " + duration.toFixed(2) + (zh ? " 秒" : " seconds")}/>
        </div>
      </div>

      <fieldset className={s.shots} aria-label={zh ? "分镜时间线" : "Storyboard timeline"}>
        {film.cues.map((cue,i) => <button type="button" key={cue.at} aria-pressed={i===cueIndex} onClick={() => seek(cue.at)}
          aria-label={cue.title[l] + " · " + cueTime(cue.at)} title={cue.title[l] + " · " + cueTime(cue.at)}>
          <img src={"/home/studio-frame-" + film.key + "-" + (i+1) + ".webp"} alt="" width={144} height={72} loading="lazy" decoding="async" />
          <span><small>{cueTime(cue.at)}</small><strong>{cue.title[l]}</strong></span>
        </button>)}
      </fieldset>
      <div className={s.console}>
        <MotionTitle><span>{zh ? <>AI 视频<wbr/>生成器。</> : <>AI VIDEO <wbr/>GENERATOR.</>}</span>{" "}<small>{zh ? "电影级创作效果。" : "STUDIO-GRADE RESULTS."}</small></MotionTitle>
        <PromptBox lang={lang} sourceShot={{title:selectedCue.title[l], prompt:selectedCue.prompt[l]}} />
      </div>

      {failed && <output className={s.notice}>{zh ? "暂时无法播放此短片。请选择其他影片。" : "This film could not load. Select another film."}</output>}
    </div>

    <dialog className={s.cinema} ref={screen} aria-labelledby="screening-title" onClose={finishScreening}>
      {screening && <><div><h2 id="screening-title">{film.title[l]}</h2><button type="button" aria-label={zh ? "关闭放映" : "Close screening"} title={zh ? "关闭放映" : "Close screening"} onClick={() => screen.current?.close()}><X size={20}/></button></div>
        <video ref={projected} src={film.video} poster={film.poster} controls autoPlay playsInline muted aria-label={film.title[l]} onLoadedMetadata={e => { e.currentTarget.currentTime = screeningStart.current; }} /></>}
    </dialog>
  </section>;
}
