"use client";

import type { CSSProperties } from "react";
import { localizedHref } from "@/lib/locale-path";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, AudioLines, ChevronLeft, ChevronRight, Clapperboard, Download, Image as ImageIcon, Sparkles, X } from "lucide-react";
import { CopyPromptButton } from "@/components/hf/studio-results";
import { failureReason } from "@/lib/failure-reason";
import type { CreationMediaType } from "@/lib/types/dashboard";
import { useRefreshProcessingVideos, useVideos } from "@/hooks/use-videos";
import {
  DEFAULT_VIEW_MODE,
  STATUS_TABS,
  type CreationsViewMode,
  type StatusTab,
  type StatusTag,
  formatCreatedAt,
  matchesTab,
  modelLabel,
  readViewMode,
  statusTag,
  writeViewMode,
} from "@/lib/creations-view";
import type { Video } from "@/lib/types/dashboard";

const PLACEHOLDER_SRC = "/images/placeholders/creation-placeholder.svg";
const SKELETON_COUNT = 8;

const TAB_KEYS = {
  all: "tabs.all",
  queued: "tabs.queued",
  generating: "tabs.generating",
  done: "tabs.done",
  failed: "tabs.failed",
} as const;

const TAG_KEYS = {
  queued: "tag.queued",
  generating: "tag.generating",
  done: "tag.done",
  failed: "tag.failed",
} as const;

const ROW_BUTTON_STYLE: CSSProperties = {
  background: "transparent",
  border: 0,
  padding: 0,
  color: "inherit",
  textAlign: "left",
  cursor: "pointer",
};

interface CreationsLibraryProps {
  locale: string;
}

/** Normalizes raw API statuses (either case) before mapping to a visual tag. */
function videoTag(video: Video): StatusTag {
  return statusTag(String(video.status ?? "").toUpperCase());
}

function StatusPill({ tag, label }: { tag: StatusTag; label: string }) {
  return (
    <span className={`cr-tag cr-tag--${tag}`}>
      <span className="cr-tag-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

const KINDS: { id: CreationMediaType; zh: string; en: string; icon: typeof Clapperboard }[] = [
  { id: "video", zh: "视频", en: "Videos", icon: Clapperboard },
  { id: "image", zh: "图片", en: "Images", icon: ImageIcon },
  { id: "audio", zh: "音频", en: "Audio", icon: AudioLines },
];

const EXTENSIONS: Record<CreationMediaType, string> = { video: "mp4", image: "png", audio: "mp3" };

/** The first output file of a creation, whatever its type. */
function mediaUrl(video: Video): string | null {
  return video.mediaUrls?.[0] ?? video.videoUrl ?? null;
}

/** Card picture: the image itself, the clip's first frame, or an audio tile. */
function CreationThumb({ video, kind, zh }: { video: Video; kind: CreationMediaType; zh: boolean }) {
  const url = mediaUrl(video);
  // A failed job gets a clear failed tile, not the "in progress" placeholder.
  if (videoTag(video) === "failed" && !url) {
    return (
      <span className="cr-thumb-failed">
        <AlertTriangle aria-hidden="true" />
        {zh ? "生成失败" : "Failed"}
      </span>
    );
  }
  if (kind === "audio") {
    return (
      <span className="cr-thumb-audio" aria-hidden="true">
        <AudioLines />
      </span>
    );
  }
  if (video.thumbnailUrl) return <img src={video.thumbnailUrl} alt="" loading="lazy" />;
  if (url && kind === "image") return <img src={url} alt="" loading="lazy" />;
  if (url && kind === "video") {
    return (
      <video
        src={`${url}#t=0.1`}
        muted
        loop
        playsInline
        preload="metadata"
        onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
        onMouseLeave={(event) => event.currentTarget.pause()}
      />
    );
  }
  return <img src={PLACEHOLDER_SRC} alt="" loading="lazy" />;
}

export function CreationsLibrary({ locale }: CreationsLibraryProps) {
  const t = useTranslations("dashboard.myCreations");
  const [tab, setTab] = useState<StatusTab>("all");
  const [kind, setKind] = useState<CreationMediaType>("video");
  const zh = locale.toLowerCase().startsWith("zh");
  const [viewMode, setViewMode] = useState<CreationsViewMode>(DEFAULT_VIEW_MODE);
  const [activeVideo, setActiveVideo] = useState<Video | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const {
    videos,
    isLoading,
    hasMore,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
    deleteVideo,
    isDeleting,
  } = useVideos({ mediaType: kind });

  useRefreshProcessingVideos(videos, refetch);

  useEffect(() => {
    setViewMode(readViewMode(window.localStorage));
  }, []);

  const changeViewMode = useCallback((mode: CreationsViewMode) => {
    setViewMode(mode);
    writeViewMode(window.localStorage, mode);
  }, []);

  const visibleVideos = useMemo(
    () => videos.filter((video) => matchesTab(String(video.status), tab)),
    [videos, tab],
  );

  useEffect(() => {
    if (!hasMore || isFetchingNextPage) {
      return;
    }
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        fetchNextPage();
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (activeVideo && !dialog.open) {
      dialog.showModal();
    } else if (!activeVideo && dialog.open) {
      dialog.close();
    }
  }, [activeVideo]);

  const handleSelect = useCallback((video: Video) => {
    if (!mediaUrl(video) && !video.errorMessage) {
      return;
    }
    setActiveVideo(video);
  }, []);

  // Previous / next among the items that can be opened, also on ← and →.
  const openable = visibleVideos.filter((video) => mediaUrl(video) || video.errorMessage);
  const activeIndex = activeVideo ? openable.findIndex((item) => item.uuid === activeVideo.uuid) : -1;
  const step = (delta: number) => {
    const next = openable[activeIndex + delta];
    if (next) setActiveVideo(next);
  };
  useEffect(() => {
    if (!activeVideo) return;
    const onKey = (event: KeyboardEvent) => {
      // Arrows switch items even with focus on the player; only typing is left alone.
      if ((event.target as HTMLElement | null)?.closest("input, textarea")) return;
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const handleDelete = useCallback(
    async (uuid: string) => {
      try {
        await deleteVideo(uuid);
      } catch {
        // Failures are already surfaced with a toast by the hook.
      }
    },
    [deleteVideo],
  );

  return (
    <div className="cr-library">
      <header className="cr-header">
        <div className="cr-heading">
          <h1 className="cr-title">{t("title")}</h1>
          <div className="cr-kinds" role="tablist" aria-label={zh ? "作品类型" : "Creation type"}>
            {KINDS.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={kind === item.id}
                  className={kind === item.id ? "cr-kind cr-kind-on" : "cr-kind"}
                  onClick={() => setKind(item.id)}
                >
                  <Icon aria-hidden="true" />
                  {zh ? item.zh : item.en}
                </button>
              );
            })}
          </div>
        </div>
        <div className="cr-header-actions">
          <div className="cr-tabs">
            {STATUS_TABS.map((item) => (
              <button
                key={item}
                type="button"
                className="cr-tab"
                aria-pressed={item === tab}
                onClick={() => setTab(item)}
              >
                {t(TAB_KEYS[item])}
              </button>
            ))}
          </div>
          <div className="cr-toggle">
            <button
              type="button"
              className="cr-toggle-button"
              aria-pressed={viewMode === "grid"}
              onClick={() => changeViewMode("grid")}
            >
              {t("view.grid")}
            </button>
            <button
              type="button"
              className="cr-toggle-button"
              aria-pressed={viewMode === "list"}
              onClick={() => changeViewMode("list")}
            >
              {t("view.list")}
            </button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className={viewMode === "grid" ? "cr-grid" : "cr-list"}>
          {Array.from({ length: SKELETON_COUNT }, (_, index) =>
            viewMode === "grid" ? (
              <div key={`skeleton-${index}`} className="cr-skeleton-card">
                <div className="cr-skeleton-block cr-skeleton-block--thumb" />
                <div className="cr-skeleton-block cr-skeleton-block--line" />
                <div className="cr-skeleton-block cr-skeleton-block--line-short" />
              </div>
            ) : (
              <div key={`skeleton-${index}`} className="cr-skeleton-row">
                <div className="cr-skeleton-block cr-thumb-square" />
                <div className="cr-skeleton-block cr-skeleton-block--line" />
              </div>
            ),
          )}
        </div>
      ) : visibleVideos.length === 0 ? (
        <div className="cr-empty">
          <img
            className="cr-empty-illustration"
            src={PLACEHOLDER_SRC}
            alt=""
            width={160}
            height={120}
          />
          <h2 className="cr-empty-title">{t("empty.title")}</h2>
          <p className="cr-empty-description">{t("empty.description")}</p>
          <a className="cr-cta" href={localizedHref(locale, kind === "image" ? "/ai/image" : kind === "audio" ? "/audio" : "/ai/video")}>
            {t("empty.ctaStart")}
          </a>
        </div>
      ) : viewMode === "grid" ? (
        <div className="cr-grid">
          {visibleVideos.map((video) => {
            const tag = videoTag(video);
            return (
              <button
                key={video.uuid}
                type="button"
                className="cr-card"
                onClick={() => handleSelect(video)}
              >
                <div className="cr-thumb">
                  <CreationThumb video={video} kind={kind} zh={zh} />
                </div>
                <div className="cr-card-meta">
                  <span className="cr-model" title={video.prompt ?? undefined}>
                    {video.prompt?.trim() || modelLabel(video.model)}
                  </span>
                  <StatusPill tag={tag} label={t(TAG_KEYS[tag])} />
                </div>
                <div className="cr-created">
                  {video.prompt?.trim() ? `${modelLabel(video.model)} · ` : ""}
                  {formatCreatedAt(video.createdAt, locale)}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="cr-list">
          {visibleVideos.map((video) => {
            const tag = videoTag(video);
            return (
              <div key={video.uuid} className="cr-row">
                <button
                  type="button"
                  className="cr-row-main"
                  style={ROW_BUTTON_STYLE}
                  onClick={() => handleSelect(video)}
                >
                  <span className="cr-prompt">{video.prompt}</span>
                  <span className="cr-row-sub">
                    <span>{modelLabel(video.model)}</span>
                    <span>{formatCreatedAt(video.createdAt, locale)}</span>
                  </span>
                </button>
                <div className="cr-row-actions">
                  <StatusPill tag={tag} label={t(TAG_KEYS[tag])} />
                  {mediaUrl(video) ? (
                    <a
                      className="cr-button cr-button--ghost"
                      href={mediaUrl(video) ?? undefined}
                      download={`${video.uuid}.${EXTENSIONS[kind]}`}
                      rel="noopener"
                    >
                      {t("actions.download")}
                    </a>
                  ) : null}
                  {tag === "done" || tag === "failed" ? (
                    <button
                      type="button"
                      className="cr-button cr-button--ghost"
                      disabled={isDeleting}
                      onClick={() => void handleDelete(video.uuid)}
                    >
                      {t("actions.delete")}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="cr-footer">
        {isFetchingNextPage ? (
          <div
            className={viewMode === "grid" ? "cr-skeleton-card" : "cr-skeleton-row"}
          >
            <div className="cr-skeleton-block cr-skeleton-block--line" />
          </div>
        ) : hasMore ? (
          <button
            type="button"
            className="cr-button cr-button--ghost"
            onClick={() => void fetchNextPage()}
          >
            {t("loadMore")}
          </button>
        ) : null}
      </div>
      <div ref={sentinelRef} className="cr-sentinel" aria-hidden="true" />

      <dialog
        ref={dialogRef}
        className="cr-dialog"
        onClose={() => setActiveVideo(null)}
      >
        {activeVideo ? (
          <div className="cr-detail">
            <div className="cr-detail-media">
              {mediaUrl(activeVideo) ? (
                kind === "image" ? (
                  <img className="cr-video" src={mediaUrl(activeVideo) ?? undefined} alt={activeVideo.prompt ?? ""} />
                ) : kind === "audio" ? (
                  <div className="cr-detail-audio">
                    <AudioLines aria-hidden="true" />
                    <audio className="cr-audio" src={mediaUrl(activeVideo) ?? undefined} controls autoPlay>
                      <track kind="captions" />
                    </audio>
                  </div>
                ) : (
                  <video key={activeVideo.uuid} className="cr-video" src={mediaUrl(activeVideo) ?? undefined} controls autoPlay playsInline loop>
                    <track kind="captions" />
                  </video>
                )
              ) : (
                <span className="cr-thumb-failed">
                  <AlertTriangle aria-hidden="true" />
                  {zh ? "生成失败" : "Failed"}
                </span>
              )}
            </div>

            <aside className="cr-detail-side">
              <div className="cr-detail-top">
                <div className="cr-detail-nav">
                  <button type="button" className="cr-icon-btn" aria-label={zh ? "上一个" : "Previous"} disabled={activeIndex <= 0} onClick={() => step(-1)}>
                    <ChevronLeft aria-hidden="true" />
                  </button>
                  <span className="cr-detail-count">
                    {activeIndex + 1} / {openable.length}
                  </span>
                  <button type="button" className="cr-icon-btn" aria-label={zh ? "下一个" : "Next"} disabled={activeIndex >= openable.length - 1} onClick={() => step(1)}>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </div>
                <button type="button" className="cr-icon-btn" aria-label={t("close")} onClick={() => dialogRef.current?.close()}>
                  <X aria-hidden="true" />
                </button>
              </div>

              <div className="cr-detail-block">
                <div className="cr-detail-label">
                  {zh ? "提示词" : "Prompt"}
                  {activeVideo.prompt ? <CopyPromptButton prompt={activeVideo.prompt} zh={zh} className="cr-icon-btn cr-icon-btn-sm" /> : null}
                </div>
                <p className="cr-detail-prompt">{activeVideo.prompt || (zh ? "（没有提示词）" : "(No prompt)")}</p>
              </div>

              <dl className="cr-detail-meta">
                <div>
                  <dt>{zh ? "模型" : "Model"}</dt>
                  <dd>{modelLabel(activeVideo.model)}</dd>
                </div>
                <div>
                  <dt>{zh ? "时间" : "Created"}</dt>
                  <dd>{formatCreatedAt(activeVideo.createdAt, locale)}</dd>
                </div>
                {kind === "video" && activeVideo.duration ? (
                  <div>
                    <dt>{zh ? "时长" : "Length"}</dt>
                    <dd>{activeVideo.duration}s</dd>
                  </div>
                ) : null}
                {kind !== "audio" && activeVideo.aspectRatio ? (
                  <div>
                    <dt>{zh ? "比例" : "Aspect"}</dt>
                    <dd>{activeVideo.aspectRatio}</dd>
                  </div>
                ) : null}
                {activeVideo.creditsUsed && videoTag(activeVideo) !== "failed" ? (
                  <div>
                    <dt>{zh ? "消耗" : "Credits"}</dt>
                    <dd>{activeVideo.creditsUsed}</dd>
                  </div>
                ) : null}
              </dl>

              {videoTag(activeVideo) === "failed" ? (
                <div className="cr-error">
                  <p>{zh ? "这次没有生成成功，冻结的积分已经退回。" : "This one did not come out. The credits held for it were returned."}</p>
                  {activeVideo.errorMessage ? (
                    <details>
                      <summary>{zh ? "错误详情" : "Details"}</summary>
                      {failureReason(activeVideo.errorMessage, zh)}
                    </details>
                  ) : null}
                </div>
              ) : null}

              <div className="cr-detail-actions">
                {kind !== "audio" && activeVideo.prompt ? (
                  <a
                    className="cr-button cr-button--ghost"
                    href={localizedHref(locale, `${kind === "image" ? "/ai/image" : "/ai/video"}?${new URLSearchParams({ prompt: activeVideo.prompt, model: activeVideo.model })}`)}
                  >
                    <Sparkles aria-hidden="true" />
                    {zh ? "用这个提示词再生成" : "Generate again"}
                  </a>
                ) : null}
                {mediaUrl(activeVideo) ? (
                  <a
                    className="cr-button cr-button--primary"
                    href={mediaUrl(activeVideo) ?? undefined}
                    download={`${activeVideo.uuid}.${EXTENSIONS[kind]}`}
                    rel="noopener"
                  >
                    <Download aria-hidden="true" />
                    {t("actions.download")}
                  </a>
                ) : null}
              </div>
            </aside>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
