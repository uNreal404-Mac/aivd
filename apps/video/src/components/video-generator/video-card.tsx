"use client";

import * as React from "react";
import { Play, Download, Trash2, Sparkles, Clock, Zap } from "lucide-react";
import { cn } from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { BlurFade } from "@/components/magicui/blur-fade";

interface Video {
  uuid: string;
  prompt: string;
  model: string;
  status: string;
  video_url?: string | null;
  thumbnail_url?: string | null;
  created_at: string | Date;
  credits_used: number;
  duration?: string;
  resolution?: string;
}

interface VideoCardProps {
  video: Video;
  onDelete?: () => void;
  showActions?: boolean;
}

const statusConfig = {
  PENDING: {
    label: "Pending",
    color: "bg-[var(--du-warning)]/20 text-[var(--du-warning)] border-[var(--du-warning)]/30",
    icon: Clock,
  },
  GENERATING: {
    label: "Generating",
    color: "bg-[var(--du-accent)]/20 text-[var(--du-accent-text)] border-[var(--du-accent)]/30",
    icon: Sparkles,
  },
  UPLOADING: {
    label: "Uploading",
    color: "bg-[var(--du-accent-2)]/20 text-[var(--du-accent-text)] border-[var(--du-accent-2)]/30",
    icon: Zap,
  },
  COMPLETED: {
    label: "Completed",
    color: "bg-[var(--du-success)]/20 text-[var(--du-success)] border-[var(--du-success)]/30",
    icon: Sparkles,
  },
  FAILED: {
    label: "Failed",
    color: "bg-[var(--du-danger)]/20 text-[var(--du-danger)] border-[var(--du-danger)]/30",
    icon: null,
  },
};

function VideoThumbnail({ video }: { video: Video }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [showOverlay, setShowOverlay] = React.useState(false);

  const handleMouseEnter = () => {
    setShowOverlay(true);
    if (videoRef.current && video.status === "COMPLETED" && video.video_url) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleMouseLeave = () => {
    setShowOverlay(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const config = statusConfig[video.status as keyof typeof statusConfig] || statusConfig.PENDING;
  const StatusIcon = config.icon;

  return (
    <div
      className="relative aspect-video bg-[var(--du-surface)] overflow-hidden rounded-t-xl group/thumbnail"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Video or Image Preview */}
      {video.status === "COMPLETED" && video.video_url ? (
        <video
          ref={videoRef}
          src={video.video_url}
          className="w-full h-full object-cover"
          muted
          loop
          playsInline
        />
      ) : video.thumbnail_url ? (
        <img
          src={video.thumbnail_url}
          alt={video.prompt}
          className="w-full h-full object-cover opacity-80"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[var(--du-surface)]/50">
          <div className="flex flex-col items-center gap-2">
            {StatusIcon && <StatusIcon className="w-8 h-8 text-[var(--du-text-dim)]" />}
            <span className={cn("text-sm font-medium", config.color)}>
              {config.label}
            </span>
          </div>
        </div>
      )}

      {/* Overlay Gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-[var(--du-bg)]/80 via-[var(--du-bg)]/20 to-transparent transition-opacity duration-300",
          showOverlay || video.status !== "COMPLETED" ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Status Badge */}
      {video.status !== "COMPLETED" && (
        <div className="absolute top-3 left-3">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-sm",
              config.color
            )}
          >
            {StatusIcon && <StatusIcon className="w-3 h-3" />}
            {config.label}
          </span>
        </div>
      )}

      {/* Video Info Overlay */}
      {(video.duration || video.resolution) && video.status === "COMPLETED" && (
        <div className="absolute bottom-3 left-3 flex items-center gap-2">
          {video.duration && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--du-glass-overlay-scrim)] backdrop-blur-sm text-xs text-[var(--du-text)]">
              <Clock className="w-3 h-3" />
              {video.duration}
            </span>
          )}
          {video.resolution && (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--du-glass-overlay-scrim)] backdrop-blur-sm text-xs text-[var(--du-text)]">
              {video.resolution}
            </span>
          )}
        </div>
      )}

      {/* Play Button Overlay */}
      {video.status === "COMPLETED" && video.video_url && (
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center transition-opacity duration-300",
            showOverlay ? "opacity-100" : "opacity-0"
          )}
        >
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--du-glass-bg)] backdrop-blur-sm border border-[var(--du-glass-border)] group-hover/thumbnail:scale-110 transition-transform">
            <Play className="w-6 h-6 text-[var(--du-text)] ml-1" />
          </div>
        </div>
      )}
    </div>
  );
}

function VideoActions({ video, onDelete }: { video: Video; onDelete?: () => void }) {
  if (video.status !== "COMPLETED" || !video.video_url) return null;

  return (
    <div className="flex items-center gap-2">
      <a
        href={video.video_url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
          "bg-[var(--du-surface-2)] hover:bg-[var(--du-surface)] text-[var(--du-text)]"
        )}
      >
        <Play className="w-4 h-4" />
        Play
      </a>
      <a
        href={video.video_url}
        download
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
          "bg-[var(--du-surface-2)] hover:bg-[var(--du-surface)] text-[var(--du-text)]"
        )}
        title="Download"
      >
        <Download className="w-4 h-4" />
      </a>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className={cn(
            "flex items-center justify-center w-10 h-10 rounded-xl transition-all",
            "bg-[var(--du-danger)]/10 hover:bg-[var(--du-danger)]/20 text-[var(--du-danger)]"
          )}
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function VideoCard({ video, onDelete, showActions = true }: VideoCardProps) {
  const createdAt = new Date(video.created_at).toLocaleDateString();

  return (
    <BlurFade inView>
      <Card className="group overflow-hidden border-[var(--du-border)] bg-[var(--du-surface)]/50 hover:bg-[var(--du-surface)]/80 transition-colors duration-300">
        <VideoThumbnail video={video} />

        <CardContent className="p-4 space-y-4">
          {/* Prompt */}
          <p
            className="text-sm text-[var(--du-text-muted)] line-clamp-2 leading-relaxed"
            title={video.prompt}
          >
            {video.prompt}
          </p>

          {/* Meta Info */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span className="text-[var(--du-text-muted)]">{video.model}</span>
              <span className="text-[var(--du-text-dim)]">•</span>
              <span className="text-[var(--du-text-muted)]">{createdAt}</span>
            </div>
            <span className="flex items-center gap-1 text-[var(--du-text-muted)]">
              <Sparkles className="w-3 h-3" />
              {video.credits_used}
            </span>
          </div>

          {/* Actions */}
          {showActions && <VideoActions video={video} onDelete={onDelete} />}
        </CardContent>
      </Card>
    </BlurFade>
  );
}
