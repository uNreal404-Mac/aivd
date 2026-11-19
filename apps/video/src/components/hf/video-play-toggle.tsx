"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Pause, Play } from "lucide-react";

import { togglePinnedPlay } from "@/lib/hover-play";
import "./video-play-toggle.css";

/**
 * Play / pause button for the showcase clip in the nearest
 * `[data-video-scope]` element. It is only shown to visitors who asked for
 * reduced motion (see the stylesheet): clips do not start by themselves for
 * them, and this is how to start one by click, tap or keyboard.
 *
 * Place it next to the card's link, not inside it, so there is no button
 * within a link.
 */
export function VideoPlayToggle({ zh, className }: { zh: boolean; className?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [playing, setPlaying] = useState(false);

  const find = () => {
    const scope = ref.current?.closest<HTMLElement>("[data-video-scope]") ?? null;
    return { scope, video: scope?.querySelector("video") ?? null };
  };

  // The icon follows the clip, however it was started or stopped.
  useEffect(() => {
    const { video } = find();
    if (!video) return;
    const sync = () => setPlaying(!video.paused);
    sync();
    video.addEventListener("play", sync);
    video.addEventListener("pause", sync);
    return () => {
      video.removeEventListener("play", sync);
      video.removeEventListener("pause", sync);
    };
  }, []);

  const toggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const { scope, video } = find();
    if (scope && video) togglePinnedPlay(scope, video);
  };

  const label = playing ? (zh ? "暂停视频" : "Pause video") : zh ? "播放视频" : "Play video";
  return (
    <button ref={ref} type="button" className={className ? `vpt ${className}` : "vpt"} aria-label={label} title={label} onClick={toggle}>
      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
    </button>
  );
}
