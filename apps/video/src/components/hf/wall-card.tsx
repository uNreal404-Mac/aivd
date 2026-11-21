"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { Play, Sparkles } from "lucide-react";

import { VideoPlayToggle } from "@/components/hf/video-play-toggle";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { HOVER_INTENT_MS, bindHoverPlay } from "@/lib/hover-play";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import type { ShowMedia } from "@/lib/home-showcase";

// Slow camera moves played on a still while it is hovered, cycled by position.
const MOVES = ["wc-move-push", "wc-move-left", "wc-move-right", "wc-move-rise"] as const;

/**
 * One card in a model wall. Hovering plays a clip (or slowly moves the camera
 * over a still) and shows the prompt to make one like it; the card opens the
 * studio with that prompt and model filled in.
 *
 * With reduced motion a clip still plays on hover or keyboard focus, after a
 * short pause so a passing cursor does not start it, and the card shows a
 * play button for click and tap. The button sits beside the link, not in it.
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
  const cardRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  // Only here to re-bind when the visitor switches the system setting.
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const card = cardRef.current;
    const video = videoRef.current;
    if (!card || !video) return;
    return bindHoverPlay(card, video, { delay: prefersReducedMotion() ? HOVER_INTENT_MS : 0 });
  }, [reducedMotion]);

  return (
    <div
      ref={cardRef}
      className={`hs-wall-item wc ${media.video ? "wc-video" : MOVES[position % MOVES.length]}`}
      style={{ aspectRatio: ratio }}
      data-video-scope={media.video ? true : undefined}
    >
      <Link
        href={href}
        // Prompt links fill in the generator; they are not pages for search engines.
        rel={href.includes("prompt=") ? "nofollow" : undefined}
        className="wc-link"
        // Same words, same order as on the card, so voice control can use them.
        aria-label={[media.video ? (zh ? "视频" : "Video") : null, prompt, cta].filter(Boolean).join(" ")}
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
      {media.video ? <VideoPlayToggle zh={zh} className="wc-play" /> : null}
    </div>
  );
}
