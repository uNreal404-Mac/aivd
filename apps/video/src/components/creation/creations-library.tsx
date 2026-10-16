"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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

export function CreationsLibrary({ locale }: CreationsLibraryProps) {
  const t = useTranslations("dashboard.myCreations");
  const [tab, setTab] = useState<StatusTab>("all");
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
  } = useVideos({});

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
    if (!video.videoUrl && !video.errorMessage) {
      return;
    }
    setActiveVideo(video);
  }, []);

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
        <h1 className="cr-title">{t("title")}</h1>
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
          <a className="cr-cta" href={`/${locale}/ai/video`}>
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
                  <img
                    src={video.thumbnailUrl ?? PLACEHOLDER_SRC}
                    alt=""
                    loading="lazy"
                  />
                </div>
                <div className="cr-card-meta">
                  <span className="cr-model">{modelLabel(video.model)}</span>
                  <StatusPill tag={tag} label={t(TAG_KEYS[tag])} />
                </div>
                <div className="cr-created">
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
                  {video.videoUrl ? (
                    <a
                      className="cr-button cr-button--ghost"
                      href={video.videoUrl}
                      download={`${video.uuid}.mp4`}
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
          <div>
            <div className="cr-dialog-header">
              <div>
                <h2 className="cr-dialog-title">
                  {modelLabel(activeVideo.model)}
                </h2>
                <p className="cr-dialog-subtitle">
                  {formatCreatedAt(activeVideo.createdAt, locale)}
                </p>
              </div>
              <button
                type="button"
                className="cr-button cr-button--ghost"
                onClick={() => dialogRef.current?.close()}
              >
                {t("close")}
              </button>
            </div>
            {activeVideo.videoUrl ? (
              <video className="cr-video" src={activeVideo.videoUrl} controls>
                <track kind="captions" />
              </video>
            ) : null}
            {activeVideo.errorMessage ? (
              <p className="cr-error">{activeVideo.errorMessage}</p>
            ) : null}
            {activeVideo.videoUrl ? (
              <div className="cr-dialog-actions">
                <a
                  className="cr-button cr-button--primary"
                  href={activeVideo.videoUrl}
                  download={`${activeVideo.uuid}.mp4`}
                  rel="noopener"
                >
                  {t("actions.download")}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
