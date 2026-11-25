"use client";

import Link from "next/link";
import { Play, Sparkles } from "lucide-react";

import { VideoPlayToggle } from "@/components/hf/video-play-toggle";
import { InViewVideo } from "@/components/hf/in-view-video";
import type { ShowMedia } from "@/lib/home-showcase";

// Slow camera moves played on a still while it is hovered, cycled by position.
const MOVES = ["wc-move-push", "wc-move-left", "wc-move-right", "wc-move-rise"] as const;

/**
 * The homepage previews visible clips. Model walls preview on hover or focus.
 * The media link opens its studio and the separate button controls playback.
 */
export function WallCard({
  media,
  href,
  prompt,
  cta,
  ratio,
  position,
  zh,
  viewportPlayback = false,
}: {
  media: ShowMedia;
  href: string;
  prompt?: string;
  cta: string;
  ratio: string;
  position: number;
  zh: boolean;
  viewportPlayback?: boolean;
}) {
  return (
    <div
      className={`hs-wall-item wc ${media.video ? "wc-video" : MOVES[position % MOVES.length]}`}
      style={{ aspectRatio: ratio }}
      data-video-scope={media.video ? true : undefined}
    >
      <Link
        href={href}
        // Example links fill in the generator; they are not pages for search engines.
        rel={href.includes("prompt=") || href.includes("sample=") ? "nofollow" : undefined}
        className="wc-link"
        // Same words, same order as on the card, so voice control can use them.
        aria-label={[media.video ? (zh ? "视频" : "Video") : null, prompt, cta].filter(Boolean).join(" ")}
      >
        {media.video ? (
          <InViewVideo
            src={media.src}
            poster={media.poster}
            playback={viewportPlayback ? "viewport" : "hover"}
            hoverPlay={!viewportPlayback}
            documentGallery={viewportPlayback}
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
