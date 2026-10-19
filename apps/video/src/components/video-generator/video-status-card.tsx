"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { GeneratingProgressBar } from "@/components/tool/generating-progress-bar";
import { cn } from "@/components/ui";
import { I2V_MODELS } from "@/lib/image-to-video";
import {
  estimateProgress,
  taskPhase,
  type QueuePhase,
  type VideoTask,
} from "@/lib/video-task-storage";

interface VideoStatusCardProps {
  task: VideoTask;
  now: number;
  onDismiss?: (videoId: string) => void;
  className?: string;
}

function modelLabel(model?: string): string | null {
  if (!model) {
    return null;
  }
  return I2V_MODELS.find((option) => option.id === model)?.label ?? model;
}

function aspectClass(aspectRatio?: string): string {
  switch (aspectRatio) {
    case "16:9":
      return "aspect-video";
    case "9:16":
      return "aspect-[9/16] max-h-[420px] mx-auto";
    case "1:1":
      return "aspect-square";
    default:
      return "aspect-video";
  }
}

const BADGE_CLASS: Record<QueuePhase, string> = {
  queued: "text-[var(--du-text-muted)]",
  generating:
    "text-[var(--du-accent-text)] bg-[var(--du-accent-soft)]",
  completed: "text-[var(--du-success)]",
  failed: "text-[var(--du-danger)]",
  stalled: "text-[var(--du-warning)]",
};

const CHIP_CLASS =
  "rounded-full border border-[var(--du-border)] px-2.5 py-1 text-xs text-[var(--du-text-muted)]";

export function VideoStatusCard({
  task,
  now,
  onDismiss,
  className,
}: VideoStatusCardProps) {
  const t = useTranslations("GenerationQueue");
  const phase = taskPhase(task);

  const badgeLabels: Record<QueuePhase, string> = {
    queued: t("queued"),
    generating: t("generating"),
    completed: t("completed"),
    failed: t("failed"),
    stalled: t("stalled"),
  };

  const terminal =
    phase === "completed" || phase === "failed" || phase === "stalled";

  const progress =
    phase === "generating"
      ? estimateProgress(
          {
            phase,
            model: task.model,
            duration: task.duration,
            createdAt: task.createdAt,
            startedAt: task.startedAt,
          },
          now,
        )
      : null;

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-[var(--du-border)] bg-[var(--du-surface)] p-4 text-[var(--du-text)]",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            BADGE_CLASS[phase],
          )}
        >
          {phase === "generating" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : phase === "completed" ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          ) : phase === "failed" ? (
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span aria-live="polite">{badgeLabels[phase]}</span>
        </span>

        {modelLabel(task.model) ? (
          <span className={CHIP_CLASS}>{modelLabel(task.model)}</span>
        ) : null}
        {typeof task.duration === "number" ? (
          <span className={CHIP_CLASS}>{`${task.duration}s`}</span>
        ) : null}
        {task.aspectRatio ? (
          <span className={CHIP_CLASS}>{task.aspectRatio}</span>
        ) : null}
      </div>

      {task.prompt ? (
        <p className="line-clamp-2 text-sm text-[var(--du-text-muted)]">
          {task.prompt}
        </p>
      ) : null}

      {phase === "queued" ? (
        <div className="flex flex-col gap-2">
          <GeneratingProgressBar label={badgeLabels.queued} />
          <p className="text-xs text-[var(--du-text-muted)]">
            {t("queuedHint")}
          </p>
        </div>
      ) : null}

      {phase === "generating" ? (
        <div className="flex flex-col gap-2">
          {progress && progress.percent !== null ? (
            <>
              <GeneratingProgressBar
                percent={progress.percent}
                label={badgeLabels.generating}
              />
              <p className="text-xs text-[var(--du-text-muted)]">
                {t("generatingPercent", { percent: progress.percent })}
              </p>
              <p className="text-xs text-[var(--du-text-muted)]">
                {progress.overdue
                  ? t("almostDone")
                  : progress.remainingSeconds !== null
                    ? t("etaEstimated", { seconds: progress.remainingSeconds })
                    : null}
              </p>
            </>
          ) : (
            <>
              <GeneratingProgressBar label={badgeLabels.generating} />
              <p className="text-xs text-[var(--du-text-muted)]">
                {t("generating")}
              </p>
              <p className="text-xs text-[var(--du-text-muted)]">
                {t("noEstimate")}
              </p>
            </>
          )}
        </div>
      ) : null}

      {phase === "completed" ? (
        task.videoUrl ? (
          <div className="flex flex-col gap-2">
            <video
              controls
              playsInline
              preload="metadata"
              src={task.videoUrl}
              className={cn(
                "w-full rounded-lg bg-[var(--du-surface-2)]",
                aspectClass(task.aspectRatio),
              )}
            />
            <a
              href={task.videoUrl}
              download
              className="inline-flex w-fit items-center gap-1.5 rounded-md border border-[var(--du-border)] px-3 py-1.5 text-xs font-medium text-[var(--du-text)] hover:bg-[var(--du-surface-2)]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              {t("download")}
            </a>
          </div>
        ) : (
          <p className="text-sm text-[var(--du-text-muted)]">
            {t("completedNoUrl")}
          </p>
        )
      ) : null}

      {phase === "failed" ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-[var(--du-danger)]">
            {t("failedTitle")}
          </p>
          {task.errorMessage ? (
            <p className="line-clamp-3 text-xs text-[var(--du-text-muted)]">
              {task.errorMessage}
            </p>
          ) : null}
          {task.creditsRefunded ? (
            <p className="flex items-center gap-1.5 text-xs text-[var(--du-success)]">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              {t("creditsRefunded")}
            </p>
          ) : null}
        </div>
      ) : null}

      {phase === "stalled" ? (
        <p className="text-sm text-[var(--du-warning)]">{t("stalledHint")}</p>
      ) : null}

      {terminal ? (
        <button
          type="button"
          onClick={() => onDismiss?.(task.videoId)}
          className="inline-flex w-fit items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--du-text-muted)] hover:bg-[var(--du-surface-2)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t("dismiss")}
        </button>
      ) : null}
    </article>
  );
}
