"use client";

import { ArrowUpRight, Check, Clapperboard, Pause, Play, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import styles from "./screening-player.module.css";

const shots = [
  {
    video: "/home/hero-marina-loop.mp4",
    poster: "/home/hero-marina-poster.png",
    duration: 9.72,
    en: {
      title: "Harbor toast",
      prompt: "Frame a group of friends on the stern of a yacht. They lift their glasses, one pops a bottle, and the spray catches the soft daylight. Keep the marina in view.",
    },
    zh: {
      title: "港湾举杯",
      prompt: "中远景拍摄停在码头的游艇。朋友们在船尾举杯，一人打开酒瓶，飞溅的酒花映着柔和的天光，背景留出港湾。",
    },
  },
  {
    video: "/home/hero-showcase-02.mp4",
    poster: "/home/screening-02.webp",
    duration: 5.04,
    en: {
      title: "First glimmer",
      prompt: "Hold a steady close two-shot of a smiling couple in a leafy park. As they turn toward each other, a red mark spreads across his cheek and a warm light flares around their eyes.",
    },
    zh: {
      title: "微光初现",
      prompt: "在绿树掩映的公园里，用固定近景拍摄微笑的两个人。他们转头相望，男子的脸颊浮现一抹红色，暖光在两人眼周闪现。",
    },
  },
  {
    video: "/home/hero-showcase-03.mp4",
    poster: "/home/screening-03.webp",
    duration: 5.04,
    en: {
      title: "Ember eyes",
      prompt: "Two people turn toward each other and clasp hands in a sunlit park. As they meet each other's gaze, their eyes glow amber. Keep the camera still and the trees softly out of focus.",
    },
    zh: {
      title: "琥珀目光",
      prompt: "阳光下的公园里，两个人转身相视，双手握在一起，眼睛泛起琥珀色的光。保持镜头平稳，背景树木柔和虚化。",
    },
  },
];

function timecode(seconds: number) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

interface ScreeningPlayerProps {
  lang: string;
  onUsePrompt: (prompt: string) => void;
}

export function ScreeningPlayer({ lang, onUsePrompt }: ScreeningPlayerProps) {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [metadataDuration, setMetadataDuration] = useState(0);
  const [playbackError, setPlaybackError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const language = lang.toLowerCase().startsWith("zh") ? "zh" : "en";
  const chinese = language === "zh";
  const shot = shots[selected];
  const duration = metadataDuration || shot.duration;
  const ended = elapsed >= duration - 0.04;
  const actionLabel = playing ? (chinese ? "暂停样片" : "Pause sample") :
    ended ? (chinese ? "重新播放样片" : "Replay sample") : (chinese ? "播放样片" : "Play sample");

  function selectShot(index: number) {
    if (index === selected) return;
    videoRef.current?.pause();
    setPlaying(false);
    setElapsed(0);
    setMetadataDuration(0);
    setPlaybackError(false);
    setSelected(index);
  }

  async function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;
    if (!video.paused) {
      video.pause();
      return;
    }
    if (video.error) video.load();
    setPlaybackError(false);
    try {
      if (video.ended) video.currentTime = 0;
      await video.play();
    } catch (error) {
      if (videoRef.current === video && !(error instanceof DOMException && error.name === "AbortError")) {
        setPlaybackError(true);
      }
    }
  }

  return (
    <section className={styles.monitor} aria-label={chinese ? "样片放映室" : "Screening room"}>
      <div className={styles.bar}>
        <span className={styles.barTitle}><Clapperboard size={16} aria-hidden="true" />{chinese ? "样片放映室" : "Screening room"}</span>
        <span className={styles.counter} aria-live="polite">{shot[language].title}</span>
      </div>
      <div className={styles.stage}>
        <video
          key={shot.video}
          ref={videoRef}
          src={shot.video}
          poster={shot.poster}
          aria-label={shot[language].title}
          preload="metadata"
          muted
          playsInline
          onLoadedMetadata={(event) => {
            const seconds = event.currentTarget.duration;
            if (Number.isFinite(seconds) && seconds > 0) setMetadataDuration(seconds);
          }}
          onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onError={() => { setPlaying(false); setPlaybackError(true); }}
        />
        {playbackError && (
          <p role="status" className={styles.error}>{chinese ? "样片暂时无法播放，可重试或切换镜头。" : "Playback unavailable. Retry or choose another reel."}</p>
        )}
      </div>
      <div className={styles.transport}>
        <button type="button" className={styles.play} aria-label={actionLabel} onClick={togglePlayback}>
          {playing ? <Pause size={15} fill="currentColor" aria-hidden="true" /> :
            ended ? <RotateCcw size={17} aria-hidden="true" /> : <Play size={15} fill="currentColor" aria-hidden="true" />}
        </button>
        <span className={styles.time}>{timecode(elapsed)} / {timecode(duration)}</span>
        <input
          className={styles.seek}
          type="range"
          min={0} max={duration} step="0.01"
          value={Math.min(elapsed, duration)}
          aria-label={chinese ? "样片进度" : "Sample position"}
          aria-valuetext={timecode(elapsed)}
          onChange={(event) => {
            if (videoRef.current && videoRef.current.readyState > 0) {
              videoRef.current.currentTime = Number(event.target.value);
              setElapsed(videoRef.current.currentTime);
            }
          }}
        />
        <button className={styles.usePrompt} type="button" onClick={() => onUsePrompt(shot[language].prompt)}>{chinese ? "使用此提示词" : "Use this prompt"}<ArrowUpRight size={15} aria-hidden="true" /></button>
      </div>
      <div className={styles.reels} role="group" aria-label={chinese ? "选择样片" : "Choose a reel"}>
        {shots.map((item, index) => (
          <button key={item.video} type="button" aria-pressed={index === selected} onClick={() => selectShot(index)} className={styles.reel}>
            <span className={styles.thumb}>
              <img src={item.poster} alt="" />
              {index === selected && <span className={styles.selectedMark}><Check size={11} strokeWidth={3} aria-hidden="true" /></span>}
            </span>
            <span className={styles.reelInfo}>
              <span className={styles.sceneId}>{chinese ? "镜头" : "Scene"} {String(index + 1).padStart(2, "0")}</span>
              <span>{item[language].title}</span>
              <small>{timecode(item.duration)}</small>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
