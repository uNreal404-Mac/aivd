"use client";

import { ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Crosshair, Expand, Film, ImagePlus, Pause, Play, Scissors, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { TOOL_PREFILL_KEY } from "@/components/gallery/use-template";
import { localizedHref } from "@/lib/du-home";
import { cutroomFilms as films } from "./cutroom-films";
import s from "./premiere-hero.module.css";

function time(t: number) {
  const sec = Math.floor(Math.max(0, t || 0));
  return String(Math.floor(sec / 60)).padStart(2, "0") + ":" + String(sec % 60).padStart(2, "0");
}

export function PremiereHero({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh"), l = zh ? 0 : 1;
  const w = (cn: string, en: string) => zh ? cn : en;
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(films[0].duration);
  const [playing, setPlaying] = useState(false);
  const [intent, setIntent] = useState<"auto" | "play" | "pause">("auto");
  const [guides, setGuides] = useState<"off" | "thirds" | "vertical" | "scope">("off");
  const [panel, setPanel] = useState<"edit" | "film" | null>(null);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [source, setSource] = useState("");
  const drafts = useRef(new Map<string, string>());
  const video = useRef<HTMLVideoElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const projection = useRef<HTMLVideoElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const sourceTime = useRef(0);
  const film = films[index], progress = Math.min(1, elapsed / (duration || 1));
  const cueIndex = film.cues.reduce((found, c, i) => progress >= c.at ? i : found, 0);
  const cue = film.cues[cueIndex];
  const id = String(index + 1).padStart(2, "0");
  const draftKey = useRef("");
  useEffect(() => {
    const media = video.current;
    if (!media) return;
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    function sync() {
      if (document.hidden || panel || intent === "pause" || (m.matches && intent === "auto")) media?.pause();
      else void media?.play().catch(() => {});
    }
    sync();
    m.addEventListener("change", sync); document.addEventListener("visibilitychange", sync);
    return () => { m.removeEventListener("change", sync); document.removeEventListener("visibilitychange", sync); };
  }, [index, intent, panel]);
  useEffect(() => {
    if (!panel) return;
    if (!dialog.current?.open) dialog.current?.showModal();
    if (panel === "edit") editor.current?.focus({ preventScroll: true });
  }, [panel]);
  function choose(i: number) {
    if (i === index) return;
    setElapsed(0); setDuration(films[i].duration); setFailed(false); setPlaying(false); setIndex(i);
  }
  function toggle() {
    const media = video.current;
    if (!media || failed) return;
    if (!media.paused) { media.pause(); setIntent("pause"); }
    else { setIntent("play"); void media.play().catch(() => {}); }
  }
  function seek(value: number) {
    if (!video.current || !Number.isFinite(video.current.duration)) return;
    video.current.pause(); setIntent("pause"); video.current.currentTime = value; setElapsed(value);
  }
  function edit(blank = false) {
    const key = blank ? "blank" : index + ":" + cueIndex;
    draftKey.current = key;
    setSource(blank ? w("自由创作", "Original shot") : film.title[l] + "  /  " + cue.label[l] + "  ·  " + time(elapsed));
    setPrompt(drafts.current.get(key) ?? (blank ? "" : cue.prompt[l]));
    setError(""); setPanel("edit");
  }
  function studio(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      if (prompt.trim()) sessionStorage.setItem(TOOL_PREFILL_KEY, JSON.stringify({ prompt: prompt.trim() }));
      else sessionStorage.removeItem(TOOL_PREFILL_KEY);
    } catch {
      if (prompt.trim()) { setError(w("请允许站点存储，以便把分镜带到工作台。", "Allow site storage to carry this shot to the studio.")); return; }
    }
    window.location.assign(e.currentTarget.action);
  }
  function finishDialog() {
    const projected = projection.current;
    if (panel === "film" && projected && projected.readyState >= 1) {
      seek(Math.min(projected.currentTime, duration));
    }
    setPanel(null);
  }
  const close = () => dialog.current?.close();
  return <section className={s.cutroom} aria-labelledby="cut-title">
    <div className={s.stage} data-optics={index === 0}>
      <div className={s.picture} key={film.video}>
        <video ref={video} src={film.video} poster={film.poster} muted loop playsInline preload="metadata" aria-hidden="true"
          onLoadedMetadata={e => { if (Number.isFinite(e.currentTarget.duration) && e.currentTarget.duration > 0) setDuration(e.currentTarget.duration); }}
          onTimeUpdate={e => setElapsed(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onError={() => { setPlaying(false); setFailed(true); }} />
      </div>
      <div className={s.shade} />
      {guides === "thirds" && <div className={s.guides} aria-hidden="true"><i/><i/><b/><b/></div>}
      {(guides === "vertical" || guides === "scope") && <div className={s.safeArea} aria-hidden="true" data-format={guides}><span>{guides === "vertical" ? "9:16" : "2.39:1"}</span></div>}
      <div className={s.stageTop}>
        <span className={s.imprint}><i aria-hidden="true"/> AIVD <span>/</span> MOTION LAB</span>
        <div className={s.viewTools}>
          <button type="button" aria-pressed={guides !== "off"} onClick={() => setGuides(guides === "off" ? "thirds" : "off")} aria-label={w("构图线", "Composition guides")} title={w("三分构图线", "Rule of thirds")}><Crosshair size={16}/><span>{w("构图线", "Guides")}</span></button>
          <button type="button" onClick={() => { sourceTime.current = elapsed; setPanel("film"); }} aria-label={w("纯净放映", "Clean screening")} title={w("纯净放映", "Clean screening")}><Expand size={15}/><span>{w("纯净放映", "Cinema")}</span></button>
        </div>
      </div>
      {guides !== "off" && <div className={s.guideMenu} role="group" aria-label={w("构图参考样式", "Composition overlay")}>
        {(["thirds", "vertical", "scope"] as const).map((g,i) => <button key={g} type="button" aria-pressed={guides === g} onClick={() => setGuides(g)}>{[w("三分线","Thirds"),"9:16","2.39:1"][i]}</button>)}
      </div>}
      <div className={s.titleBlock} key={index}>
        <div className={s.kicker}><span>{'FILM / ' + id}</span><b/>{film.genre[l]}</div>
        <h1 id="cut-title" aria-label={w("AI 视频创作", "AI video studio") + " · " + film.title[l]}>
          <span lang="en">{film.display[0]}</span><em lang="en">{film.display[1]}<i>.</i></em>
        </h1>
        <div className={s.byline}><strong>{zh ? film.title[0] : "AIVD Motion Lab"}</strong><span/>{w("AI 视频创作实验室", "AI video studio")}</div>
        <div className={s.heroActions}>
          <button className={s.mainButton} type="button" onClick={() => edit()}><Scissors size={16}/>{w("用这个分镜创作", "Create from this shot")}<ArrowUpRight size={15}/></button>
          <button className={s.textButton} type="button" onClick={() => edit(true)}>{w("从零创作", "Start from scratch")}<ArrowRight size={14}/></button>
        </div>
      </div>
      <div className={s.frameId} aria-hidden="true"><i/> {id} <span>/</span> 05</div>
    </div>

    <div className={s.deck}>
      <div className={s.transport}>
        <div className={s.trackTitle}><Scissors size={15}/><strong>{w("剪辑台", "Cut room")}</strong><span>/ TIMELINE</span></div>
        <div className={s.currentCue} title={cue.label[l]}><i/>{cue.label[l]}</div>
        <div className={s.clock}>{time(elapsed)}<span> / {time(duration)}</span></div>
        <button className={s.play} type="button" onClick={toggle} disabled={failed} aria-label={playing ? w("暂停短片", "Pause film") : w("播放短片", "Play film")}>{playing ? <Pause size={14} fill="currentColor"/> : <Play size={14} fill="currentColor"/>}</button>
      </div>
      <div className={s.scrubber} style={{"--position": (progress * 100) + "%"} as CSSProperties}>
        <div className={s.frames} style={{backgroundImage: "url(" + film.strip + ")"}}/>
        <div className={s.divisions}/><div className={s.head}><i/></div>
        <label className="sr-only" htmlFor="cut-seek">{w("拖动查看短片画格", "Scrub through film frames")}</label>
        <input id="cut-seek" type="range" min={0} max={duration} step={0.04} value={Math.min(elapsed, duration)} onChange={e => seek(Number(e.target.value))} disabled={failed} aria-valuetext={elapsed.toFixed(2) + " / " + duration.toFixed(2) + w(" 秒", " seconds")}/>
      </div>
      <div className={s.library}>
        <span className={s.libraryLabel}><Film size={15}/>{w("精选片单", "Film index")}</span>
        <div className={s.films} role="group" aria-label={w("选择展映短片", "Choose a featured film")}>
          {films.map((f, i) => <button key={f.video} type="button" aria-pressed={i === index} onClick={e => { choose(i); if (window.matchMedia("(max-width: 720px)").matches) e.currentTarget.scrollIntoView({ block:"nearest", inline:"nearest" }); }}><small>{"0" + (i+1)}</small>{f.title[l]}</button>)}
        </div>
        <div className={s.prevNext}><button type="button" onClick={() => choose((index + films.length - 1) % films.length)} aria-label={w("上一部短片", "Previous film")}><ChevronLeft size={15}/></button><button type="button" onClick={() => choose((index + 1) % films.length)} aria-label={w("下一部短片", "Next film")}><ChevronRight size={15}/></button></div>
      </div>
      {failed && <p role="status" className={s.warning}>{w("短片暂时无法播放，可以切换片单或继续使用分镜。", "This film could not load. Select another film or use its shot notes.")}</p>}
    </div>
    <dialog ref={dialog} className={s.modal} data-panel={panel} aria-labelledby="cut-dialog-title" onClose={finishDialog} onClick={e => { if (e.target === dialog.current) close(); }}>
      {panel && <div className={s.modalBody}>
        <div className={s.modalBar}><span><i/>{panel === "film" ? "SCREENING ROOM" : "SHOT COMPOSER"}</span><button type="button" onClick={close} aria-label={w("关闭", "Close")}><X size={20}/></button></div>
        {panel === "film" ? <><h2 id="cut-dialog-title" className={s.cinemaTitle}>{film.title[l]}</h2><video ref={projection} className={s.projection} src={film.video} poster={film.poster} controls autoPlay muted playsInline onLoadedMetadata={e => { e.currentTarget.currentTime = sourceTime.current; }}/></> :
          <form className={s.form} action={localizedHref(lang, "/text-to-video")} onSubmit={studio}>
            <div className={s.source}>{source}</div>
            <h2 id="cut-dialog-title">{w("你的分镜", "Your shot")}<span>.</span></h2>
            <label htmlFor="cut-prompt">{w("镜头提示词", "Shot prompt")}</label>
            <textarea ref={editor} id="cut-prompt" value={prompt} rows={4} maxLength={2000} placeholder={w("写下你要拍的画面、机位与用光……", "Describe the frame, camera and light…")} onChange={e => { setPrompt(e.target.value); drafts.current.set(draftKey.current, e.target.value); setError(""); }}/>
            <div className={s.editorFoot}><a href={localizedHref(lang,"/image-to-video")}><ImagePlus size={15}/>{w("从图片开始", "Start with an image")}</a><button type="submit" className={s.mainButton}>{w("带入视频工作台", "Open video studio")}<ArrowUpRight size={16}/></button></div>
            {error && <p className={s.warning} role="alert">{error}</p>}
          </form>}
      </div>}
    </dialog>
  </section>;
}
