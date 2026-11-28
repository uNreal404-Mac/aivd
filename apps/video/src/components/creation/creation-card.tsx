"use client";

// ============================================
// Creation Card Component
// ============================================

import { useRef, useState } from "react";
import Link from "next/link";
import { Play, Clock, AlertCircle, MoreHorizontal, Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { cn } from "@/components/ui";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Video } from "@/lib/types/dashboard";
import { generatedDownloadUrl } from "@/lib/generated-download";

interface CreationCardProps {
  video: Video;
  onClick: (uuid: string) => void;
  onDelete?: (uuid: string) => void;
  isDeleting?: boolean;
}

const statusConfig = {
  completed: {
    icon: Play,
    iconBg: "bg-primary",
    labelKey: "status.completed",
    labelColor: "bg-[var(--du-surface)] text-[var(--du-accent-text)] border-[var(--du-border-strong)]",
  },
  pending: {
    icon: Clock,
    iconBg: "bg-muted",
    labelKey: "status.pending",
    labelColor: "bg-[var(--du-surface)] text-[var(--du-text-muted)] border-[var(--du-border)]",
  },
  generating: {
    icon: Clock,
    iconBg: "bg-muted",
    labelKey: "status.generating",
    labelColor: "bg-[var(--du-surface)] text-[var(--du-accent-text)] border-[var(--du-border)]",
  },
  uploading: {
    icon: Clock,
    iconBg: "bg-muted",
    labelKey: "status.uploading",
    labelColor: "bg-[var(--du-surface)] text-[var(--du-accent-text)] border-[var(--du-border)]",
  },
  failed: {
    icon: AlertCircle,
    iconBg: "bg-destructive/10",
    labelKey: "status.failed",
    labelColor: "bg-[var(--du-surface)] text-[var(--du-text)] border-[var(--du-border)]",
  },
};

export function CreationCard({
  video,
  onClick,
  onDelete,
  isDeleting,
}: CreationCardProps) {
  const t = useTranslations("dashboard.myCreations");
  const tg = useTranslations("Gallery");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const normalizedStatus = (video.status || "pending").toLowerCase() as keyof typeof statusConfig;
  const config = statusConfig[normalizedStatus] ?? statusConfig.pending;
  const StatusIcon = config.icon;
  const statusLabel = t(config.labelKey as "status.completed");

  const isProcessing =
    normalizedStatus === "pending" ||
    normalizedStatus === "generating" ||
    normalizedStatus === "uploading";
  const isFailed = normalizedStatus === "failed";
  const isCompleted = normalizedStatus === "completed";
  /** Older rows may omit `visibility`; anything but "public" counts as private. */
  const isPublic = video.visibility === "public";

  const handleDelete = async () => {
    setShowDeleteDialog(false);
    await onDelete?.(video.uuid);
  };

  const handleDownload = () => {
    if (video.videoUrl) {
      const link = document.createElement("a");
      link.href = generatedDownloadUrl(video.uuid);
      link.download = `dreamutopia-${video.uuid}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(t("actions.downloadSuccess"));
    }
  };

  const handlePreviewStart = () => {
    if (!isCompleted || !video.videoUrl) return;
    const element = videoRef.current;
    if (!element) return;
    element.currentTime = 0;
    element.play().catch(() => {});
  };

  const handlePreviewStop = () => {
    const element = videoRef.current;
    if (!element) return;
    element.pause();
    element.currentTime = 0;
  };

  return (
    <>
      <div
        className={cn(
          "group relative cursor-pointer overflow-hidden rounded-xl bg-[var(--du-surface)] ring-1 ring-[var(--du-border)] transition hover:ring-[var(--du-border-strong)]",
          isDeleting && "opacity-50 pointer-events-none"
        )}
        onClick={() => onClick(video.uuid)}
        onMouseEnter={handlePreviewStart}
        onMouseLeave={handlePreviewStop}
      >
        {/* Thumbnail / Preview */}
        <div className="relative aspect-video w-full overflow-hidden bg-[var(--du-bg-elev)]">
          {isCompleted && video.videoUrl ? (
            <video
              ref={videoRef}
              src={video.videoUrl}
              poster={video.thumbnailUrl || undefined}
              muted
              loop
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
            />
          ) : video.thumbnailUrl ? (
            <img
              src={video.thumbnailUrl}
              alt={video.prompt}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-3 text-center">
              <StatusIcon className="h-12 w-12 text-[var(--du-text-muted)]" />
              {isFailed && video.errorMessage && (
                <p className="text-[11px] text-destructive line-clamp-3">
                  {(() => {
                    try {
                      const parsed = JSON.parse(video.errorMessage);
                      return parsed.error?.message || parsed.message || video.errorMessage;
                    } catch {
                      return video.errorMessage;
                    }
                  })()}
                </p>
              )}
            </div>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-black/50" />

          {/* Overlay for completed videos */}
          {isCompleted && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                type="button"
                aria-label={t("actions.play")}
                onClick={(e) => {
                  e.stopPropagation();
                  onClick(video.uuid);
                }}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--du-accent)] ring-1 ring-[var(--du-border-strong)] opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:opacity-100 transition-opacity"
              >
                <Play className="ml-0.5 h-4 w-4 fill-[var(--du-on-accent)] text-[var(--du-on-accent)]" />
              </button>
            </div>
          )}

          {/* Status + gallery visibility badges */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5">
            <Badge
              className={cn(
                config.labelColor,
                "rounded-md border text-[11px]"
              )}
              variant="outline"
            >
              {statusLabel}
            </Badge>
            {isCompleted && (
              <Badge
                variant="outline"
                className={cn(
                  "rounded-md backdrop-blur",
                  isPublic
                    ? "border-[var(--du-accent)] bg-[var(--du-bg-elev)] text-[var(--du-accent-text)]"
                    : "border-[var(--du-border)] bg-[var(--du-bg-elev)] text-[var(--du-text-muted)]"
                )}
              >
                {isPublic ? tg("publicBadge") : tg("privateBadge")}
              </Badge>
            )}
          </div>

          {/* Duration badge (completed only) */}
          {isCompleted && video.duration > 0 && (
            <div className="absolute bottom-2 right-2">
              <Badge
                variant="secondary"
                className="rounded-md bg-[var(--du-surface)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--du-text)]"
              >
                {Math.floor(video.duration)}s
              </Badge>
            </div>
          )}

          {/* Action menu */}
          <div className="absolute top-2 right-2 flex gap-1.5">
            {isCompleted && video.videoUrl && (
              <Button
                variant="secondary"
                size="icon"
                aria-label={t("actions.download")}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload();
                }}
                className="h-8 w-8 rounded-lg bg-[var(--du-surface)] text-[var(--du-text)] hover:bg-[var(--du-surface-2)] opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:opacity-100 transition-opacity"
              >
                <Download className="h-4 w-4" />
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-lg bg-[var(--du-surface)] text-[var(--du-text)] hover:bg-[var(--du-surface-2)] opacity-100 md:opacity-0 md:group-hover:opacity-100 [@media(hover:none)]:opacity-100 focus-visible:opacity-100 transition-opacity"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isCompleted && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(); }}>
                    <Download className="h-4 w-4 mr-2" />
                    {t("actions.download")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); setShowDeleteDialog(true); }}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("actions.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Card info */}
        <div className="px-2.5 py-2 space-y-1">
          {/* Model & Aspect Ratio */}
          <div className="flex items-center justify-between text-[11px] text-[var(--du-text-muted)]">
            <span className="font-medium capitalize">{video.model}</span>
            <span>{video.aspectRatio}</span>
          </div>

          {/* Prompt */}
          <div className="line-clamp-1 text-xs text-[var(--du-text)]">
            {video.prompt}
          </div>

          {/* Date */}
          <div className="text-[11px] text-[var(--du-text-muted)]">
            {formatDistanceToNow(new Date(video.createdAt), { addSuffix: true })}
          </div>

          {/* Error is displayed in the preview area for failed videos */}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteConfirm.message")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("deleteConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("deleteConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
