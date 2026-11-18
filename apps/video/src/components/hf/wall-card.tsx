"use client";

import Link from "next/link";
import { useRef } from "react";
import { Play, Sparkles } from "lucide-react";
import type { ShowMedia } from "@/lib/home-showcase";

// Slow camera moves played on a still while it is hovered, cycled by position.
const MOVES = ["wc-move-push", "wc-move-left", "wc-move-right", "wc-move-rise"] as const;

/**
 * One card in a model wall. Hovering plays a clip (or slowly moves the camera
 * over a still) and shows the prompt to make one like it; the card opens the
 * studio with that prompt and model filled in.
 */
export function WallCard({
  media,
  href,
  prompt,
  cta,
  ratio,
  position,
  zh,
}: {
  media: ShowMedia;
  href: string;
  prompt?: string;
  cta: string;
  ratio: string;
  position: number;
  zh: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const play = () => {
    const video = videoRef.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    void video.play().catch(() => undefined);
  };
  const stop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
  };

  return (
    <Link
      href={href}
      className={`hs-wall-item wc ${media.video ? "wc-video" : MOVES[position % MOVES.length]}`}
      style={{ aspectRatio: ratio }}
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      aria-label={prompt ? `${cta}: ${prompt}` : cta}
    >
      {media.video ? (
        <video
          ref={videoRef}
          src={`${media.src}#t=0.1`}
          poster={media.poster}
          muted
          loop
          playsInline
          preload="metadata"
        />
      ) : (
        <img src={media.src} alt="" loading="lazy" />
      )}
      <span className="wc-sheen" aria-hidden="true" />
      {media.video ? (
        <span className="wc-kind" aria-hidden="true">
          <Play className="h-3 w-3" />
          {zh ? "视频" : "Video"}
        </span>
      ) : null}
      <span className="wc-info" aria-hidden="true">
        {prompt ? <span className="wc-prompt">{prompt}</span> : null}
        <span className="wc-cta">
          <Sparkles className="h-3.5 w-3.5" />
          {cta}
        </span>
      </span>
    </Link>
  );
}
