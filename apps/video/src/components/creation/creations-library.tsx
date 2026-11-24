"use client";

import "./creations-library.css";
import type { CSSProperties } from "react";
import { localizedHref } from "@/lib/locale-path";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  AudioLines,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { CopyPromptButton } from "@/components/hf/studio-results";
import { failureReason } from "@/lib/failure-reason";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import type { CreationMediaType } from "@/lib/types/dashboard";
import { PRESENCE_EXIT_MS, usePresence } from "@/hooks/use-presence";
import { useDownloadVideo, useRefreshProcessingVideos, useVideos } from "@/hooks/use-videos";
import {
  DEFAULT_KIND,
  DEFAULT_VIEW_MODE,
  STATUS_TABS,
  type CreationsViewMode,
  type StatusTab,
  type StatusTag,
  emptyStateFor,
  formatCreatedAt,
  matchesTab,
  modelLabel,
  readKind,
  readViewMode,
  regenerateHref,
  statusTag,
  writeKind,
  writeViewMode,
} from "@/lib/creations-view";
import type { Video } from "@/lib/types/dashboard";

const PLACEHOLDER_SRC = "/images/placeholders/creation-placeholder.svg";
const SKELETON_COUNT = 8;
/** How long a pressed Delete waits for the second press before it disarms. */
const DELETE_ARM_MS = 3000;
/** A second press sooner than this is a double-click, not a confirmation. */
const DELETE_DOUBLE_CLICK_MS = 400;
/** How long a finished download keeps its check mark. */
const DOWNLOAD_DONE_MS = 1600;

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

/** Still being made: there is nothing to show, download or delete yet. */
function isPending(tag: StatusTag): boolean {
  return tag === "queued" || tag === "generating";
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

const STUDIO_PATHS: Record<CreationMediaType, string> = { video: "/ai/video", image: "/ai/image", audio: "/audio" };

/** The first output file of a creation, whatever its type. */
function mediaUrl(video: Video): string | null {
  return video.mediaUrls?.[0] ?? video.videoUrl ?? null;
}

function downloadName(video: Video, kind: CreationMediaType): string {
  return `aivd-${video.uuid}.${EXTENSIONS[kind]}`;
}

/** Card picture: the image itself, the clip's first frame, or an audio tile. */
function CreationThumb({ video, kind, zh, pendingLabel }: { video: Video; kind: CreationMediaType; zh: boolean; pendingLabel: string }) {
  const url = mediaUrl(video);
  const tag = videoTag(video);
  // A failed job gets a clear failed tile, not the "in progress" placeholder.
  if (tag === "failed" && !url) {
    return (
      <span className="cr-thumb-failed">
        <AlertTriangle aria-hidden="true" />
        {zh ? "生成失败" : "Failed"}
      </span>
    );
  }
  if (isPending(tag) && !url) {
    return (
      <span className="cr-thumb-pending">
        <Loader2 className="animate-spin" aria-hidden="true" />
        {pendingLabel}
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

type ActionVariant = "card" | "row" | "detail";

/**
 * Delete in two presses: the first turns the button red and asks, the second
 * (within a few seconds) deletes. Waiting, pressing Escape or moving away
 * puts it back. A double-click counts as one press, so it never deletes by
 * accident.
 */
function DeleteButton({ variant, onConfirm }: { variant: ActionVariant; onConfirm: () => void }) {
  const t = useTranslations("dashboard.myCreations");
  const [armed, setArmed] = useState(false);
  const armedAt = useRef(0);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), DELETE_ARM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const label = armed ? t("actions.confirmDelete") : t("actions.delete");
  const className =
    variant === "card" ? "cr-tool cr-del" : variant === "row" ? "cr-button cr-button--ghost cr-del" : "cr-button cr-del cr-del--detail";

  return (
    <button
      type="button"
      className={className}
      data-armed={armed ? "" : undefined}
      aria-label={label}
      title={armed ? `${t("deleteConfirm.title")} ${t("deleteConfirm.message")}` : label}
      onClick={(event) => {
        event.stopPropagation();
        if (!armed) {
          armedAt.current = Date.now();
          setArmed(true);
          return;
        }
        if (Date.now() - armedAt.current < DELETE_DOUBLE_CLICK_MS) return;
        setArmed(false);
        onConfirm();
      }}
      onBlur={() => setArmed(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && armed) {
          event.preventDefault();
          event.stopPropagation();
          setArmed(false);
        }
      }}
    >
      <Trash2 aria-hidden="true" />
      {variant === "card" && !armed ? null : (
        <span key={armed ? "armed" : "idle"} data-swap="">
          {label}
        </span>
      )}
    </button>
  );
}

/**
 * Saves the file instead of opening it (see useDownloadVideo). Shows a
 * spinner while the file comes down and a check once it is saved; a failure
 * offers a retry, and a second one offers to open the file in a new tab.
 */
function DownloadButton({ url, filename, variant }: { url: string; filename: string; variant: ActionVariant }) {
  const t = useTranslations("dashboard.myCreations");
  const { download } = useDownloadVideo();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const failures = useRef(0);
  const doneTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(doneTimer.current), []);

  async function run(): Promise<void> {
    setState("busy");
    const ok = await download(url, filename, failures.current === 0 ? () => void run() : undefined);
    if (ok) {
      failures.current = 0;
      setState("done");
      window.clearTimeout(doneTimer.current);
      doneTimer.current = window.setTimeout(() => setState("idle"), DOWNLOAD_DONE_MS);
    } else {
      failures.current += 1;
      setState("idle");
    }
  }

  const label = state === "busy" ? t("actions.downloading") : state === "done" ? t("actions.downloaded") : t("actions.download");
  const icon =
    state === "busy" ? (
      <Loader2 key="busy" data-swap="" className="animate-spin" aria-hidden="true" />
    ) : state === "done" ? (
      <Check key="done" data-swap="" aria-hidden="true" />
    ) : (
      <Download key="idle" aria-hidden="true" />
    );
  const className = variant === "card" ? "cr-tool" : variant === "row" ? "cr-button cr-button--ghost" : "cr-button cr-button--primary";

  return (
    <button
      type="button"
      className={className}
      aria-busy={state === "busy"}
      aria-label={label}
      title={label}
      data-state={state}
      onClick={(event) => {
        event.stopPropagation();
        if (state !== "busy") void run();
      }}
    >
      {icon}
      {variant === "card" ? null : <span>{label}</span>}
    </button>
  );
}

export function CreationsLibrary({ locale }: CreationsLibraryProps) {
  const t = useTranslations("dashboard.myCreations");
  const [tab, setTab] = useState<StatusTab>("all");
  const [kind, setKind] = useState<CreationMediaType>(DEFAULT_KIND);
  const zh = locale.toLowerCase().startsWith("zh");
  const [viewMode, setViewMode] = useState<CreationsViewMode>(DEFAULT_VIEW_MODE);
  // The remembered type and view are read before the first fetch, so a visit
  // does not load videos only to switch to images a moment later.
  const [prefsReady, setPrefsReady] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Cards playing their exit before the delete goes out.
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(() => new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const {
    videos,
    isLoading,
    isFetching,
    error,
    hasMore,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
    deleteVideo,
    deletingIds,
  } = useVideos({ mediaType: kind }, { enabled: prefsReady });

  useRefreshProcessingVideos(videos, refetch);

  useEffect(() => {
    setViewMode(readViewMode(window.localStorage));
    setKind(readKind(window.localStorage));
    setPrefsReady(true);
  }, []);

  const changeViewMode = useCallback((mode: CreationsViewMode) => {
    setViewMode(mode);
    writeViewMode(window.localStorage, mode);
  }, []);

  const changeKind = useCallback((next: CreationMediaType) => {
    setKind(next);
    writeKind(window.localStorage, next);
  }, []);

  const visibleVideos = useMemo(
    () => videos.filter((video) => matchesTab(String(video.status), tab)),
    [videos, tab],
  );

  const loading = !prefsReady || isLoading;
  const emptyState = emptyStateFor({ total: videos.length, visible: visibleVideos.length, hasMore });

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
        void fetchNextPage({ cancelRefetch: false });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  // A filtered tab with no match among the pages loaded so far keeps looking
  // through the rest before it says there is nothing.
  useEffect(() => {
    if (!loading && emptyState === "loading" && !isFetchingNextPage) {
      void fetchNextPage({ cancelRefetch: false });
    }
  }, [loading, emptyState, isFetchingNextPage, fetchNextPage]);

  const isLeaving = useCallback(
    (uuid: string) => leaving.has(uuid) || deletingIds.includes(uuid),
    [leaving, deletingIds],
  );

  // The open item comes from the live list, so one still generating turns
  // into its result in place when it finishes.
  const activeVideo = activeId ? (videos.find((video) => video.uuid === activeId) ?? null) : null;
  const detail = usePresence(activeVideo !== null);
  const lastShown = useRef<Video | null>(null);
  useEffect(() => {
    if (activeVideo) lastShown.current = activeVideo;
  });
  // While the dialog plays its exit it keeps showing what it showed.
  const shownVideo = activeVideo ?? (detail.mounted ? lastShown.current : null);

  const closeDetail = useCallback(() => setActiveId(null), []);
  const showDialog = useCallback((node: HTMLDialogElement | null) => {
    if (node && !node.open) node.showModal();
  }, []);

  // Previous / next among the items on screen, also on ← and →.
  const openable = visibleVideos.filter((video) => !isLeaving(video.uuid));
  const activeIndex = activeVideo ? openable.findIndex((item) => item.uuid === activeVideo.uuid) : -1;
  const step = (delta: number) => {
    const next = openable[activeIndex + delta];
    if (next) setActiveId(next.uuid);
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

  /** Plays the card's exit, then deletes; a failed delete brings it back. */
  const removeVideo = useCallback(
    (uuid: string) => {
      setLeaving((previous) => new Set(previous).add(uuid));
      const commit = async () => {
        try {
          await deleteVideo(uuid);
        } catch {
          // The hook restores the item and offers a retry in a toast.
        } finally {
          setLeaving((previous) => {
            const next = new Set(previous);
            next.delete(uuid);
            return next;
          });
        }
      };
      window.setTimeout(() => void commit(), prefersReducedMotion() ? 0 : PRESENCE_EXIT_MS);
    },
    [deleteVideo],
  );

  /** Deleting from the viewer moves on to the next item, or closes it. */
  const removeFromDetail = (video: Video) => {
    const next = activeIndex < 0 ? null : (openable[activeIndex + 1] ?? openable[activeIndex - 1] ?? null);
    setActiveId(next ? next.uuid : null);
    removeVideo(video.uuid);
  };

  const pendingLabel = (tag: StatusTag) => t(TAG_KEYS[tag]);

  const skeletons = (count: number) => (
    <div className={viewMode === "grid" ? "cr-grid" : "cr-list"}>
      {Array.from({ length: count }, (_, index) =>
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
  );

  const shownTag = shownVideo ? videoTag(shownVideo) : null;
  const shownUrl = shownVideo ? mediaUrl(shownVideo) : null;
  const againHref = shownVideo && shownTag && !isPending(shownTag) ? regenerateHref(shownVideo, kind, locale) : null;

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
                  onClick={() => changeKind(item.id)}
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

      {loading ? (
        skeletons(SKELETON_COUNT)
      ) : error && videos.length === 0 ? (
        <div className="cr-empty cr-empty-in">
          <h2 className="cr-empty-title">{t("loadError.title")}</h2>
          <p className="cr-empty-description">{t("loadError.description")}</p>
          <button type="button" className="cr-cta" aria-busy={isFetching} disabled={isFetching} onClick={() => void refetch()}>
            {isFetching ? <Loader2 key="busy" data-swap="" className="animate-spin" aria-hidden="true" /> : null}
            {t("actions.retry")}
          </button>
        </div>
      ) : emptyState === "loading" ? (
        skeletons(SKELETON_COUNT / 2)
      ) : emptyState === "kind" ? (
        <div className="cr-empty cr-empty-in">
          <img
            className="cr-empty-illustration"
            src={PLACEHOLDER_SRC}
            alt=""
            width={160}
            height={120}
          />
          <h2 className="cr-empty-title">{t(`empty.${kind}.title`)}</h2>
          <p className="cr-empty-description">{t(`empty.${kind}.description`)}</p>
          <a className="cr-cta" href={localizedHref(locale, STUDIO_PATHS[kind])}>
            {t(`empty.${kind}.cta`)}
          </a>
        </div>
      ) : emptyState === "filtered" ? (
        <div className="cr-empty cr-empty-in">
          <h2 className="cr-empty-title">{t(`empty.filtered.${tab}`, { kind: t(`kindNoun.${kind}`) })}</h2>
          <p className="cr-empty-description">{t("empty.filtered.description", { kind: t(`kindNoun.${kind}`) })}</p>
          <button type="button" className="cr-cta" onClick={() => setTab("all")}>
            {t("empty.filtered.showAll")}
          </button>
        </div>
      ) : viewMode === "grid" ? (
        <div className="cr-grid">
          {visibleVideos.map((video) => {
            const tag = videoTag(video);
            const url = mediaUrl(video);
            const canDelete = !isPending(tag);
            return (
              <div
                key={video.uuid}
                className="cr-card"
                data-leaving={isLeaving(video.uuid) ? "" : undefined}
              >
                <button type="button" className="cr-card-open" onClick={() => setActiveId(video.uuid)}>
                  <div className="cr-thumb">
                    <CreationThumb video={video} kind={kind} zh={zh} pendingLabel={pendingLabel(tag)} />
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
                {url || canDelete ? (
                  <div className="cr-card-tools">
                    {url ? <DownloadButton variant="card" url={url} filename={downloadName(video, kind)} /> : null}
                    {canDelete ? <DeleteButton variant="card" onConfirm={() => removeVideo(video.uuid)} /> : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="cr-list">
          {visibleVideos.map((video) => {
            const tag = videoTag(video);
            const url = mediaUrl(video);
            return (
              <div
                key={video.uuid}
                className="cr-row"
                data-leaving={isLeaving(video.uuid) ? "" : undefined}
              >
                <button
                  type="button"
                  className="cr-row-main"
                  style={ROW_BUTTON_STYLE}
                  onClick={() => setActiveId(video.uuid)}
                >
                  <span className="cr-prompt">{video.prompt}</span>
                  <span className="cr-row-sub">
                    <span>{modelLabel(video.model)}</span>
                    <span>{formatCreatedAt(video.createdAt, locale)}</span>
                  </span>
                </button>
                <div className="cr-row-actions">
                  <StatusPill tag={tag} label={t(TAG_KEYS[tag])} />
                  {url ? <DownloadButton variant="row" url={url} filename={downloadName(video, kind)} /> : null}
                  {isPending(tag) ? null : <DeleteButton variant="row" onConfirm={() => removeVideo(video.uuid)} />}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="cr-footer">
        {isFetchingNextPage && emptyState === "none" ? (
          <div
            className={viewMode === "grid" ? "cr-skeleton-card" : "cr-skeleton-row"}
          >
            <div className="cr-skeleton-block cr-skeleton-block--line" />
          </div>
        ) : hasMore && emptyState === "none" ? (
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

      {detail.mounted && shownVideo && shownTag ? (
        <dialog
          ref={showDialog}
          className="cr-dialog"
          data-presence="dialog"
          data-state={detail.state}
          aria-label={`${modelLabel(shownVideo.model)} · ${formatCreatedAt(shownVideo.createdAt, locale)}`}
          onCancel={(event) => {
            // Escape closes through the exit animation, not at once.
            event.preventDefault();
            closeDetail();
          }}
          onClose={closeDetail}
          onClick={(event) => {
            // A click on the backdrop (the dialog itself, outside its content) closes it.
            if (event.target === event.currentTarget) closeDetail();
          }}
        >
          <div className="cr-detail">
            <div className="cr-detail-media">
              {shownUrl ? (
                kind === "image" ? (
                  <img className="cr-video" src={shownUrl} alt={shownVideo.prompt ?? ""} />
                ) : kind === "audio" ? (
                  <div className="cr-detail-audio">
                    <AudioLines aria-hidden="true" />
                    <audio className="cr-audio" src={shownUrl} controls autoPlay>
                      <track kind="captions" />
                    </audio>
                  </div>
                ) : (
                  <video key={shownVideo.uuid} className="cr-video" src={shownUrl} controls autoPlay playsInline loop>
                    <track kind="captions" />
                  </video>
                )
              ) : isPending(shownTag) ? (
                <output className="cr-detail-pending">
                  <Loader2 className="animate-spin" aria-hidden="true" />
                  <strong>{t(shownTag === "queued" ? "processing.queuedTitle" : "processing.title")}</strong>
                  <span>{t("processing.hint")}</span>
                </output>
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
                  {activeIndex >= 0 ? (
                    <>
                      <button type="button" className="cr-icon-btn" aria-label={zh ? "上一个" : "Previous"} disabled={activeIndex <= 0} onClick={() => step(-1)}>
                        <ChevronLeft aria-hidden="true" />
                      </button>
                      <span className="cr-detail-count">
                        {activeIndex + 1} / {openable.length}
                      </span>
                      <button type="button" className="cr-icon-btn" aria-label={zh ? "下一个" : "Next"} disabled={activeIndex >= openable.length - 1} onClick={() => step(1)}>
                        <ChevronRight aria-hidden="true" />
                      </button>
                    </>
                  ) : null}
                </div>
                <button type="button" className="cr-icon-btn" aria-label={t("close")} onClick={closeDetail}>
                  <X aria-hidden="true" />
                </button>
              </div>

              <div className="cr-detail-block">
                <div className="cr-detail-label">
                  {zh ? "提示词" : "Prompt"}
                  {shownVideo.prompt ? <CopyPromptButton prompt={shownVideo.prompt} zh={zh} className="cr-icon-btn cr-icon-btn-sm" /> : null}
                </div>
                <p className="cr-detail-prompt">{shownVideo.prompt || (zh ? "（没有提示词）" : "(No prompt)")}</p>
              </div>

              <dl className="cr-detail-meta">
                <div>
                  <dt>{zh ? "模型" : "Model"}</dt>
                  <dd>{modelLabel(shownVideo.model)}</dd>
                </div>
                <div>
                  <dt>{zh ? "时间" : "Created"}</dt>
                  <dd>{formatCreatedAt(shownVideo.createdAt, locale)}</dd>
                </div>
                {kind === "video" && shownVideo.duration ? (
                  <div>
                    <dt>{zh ? "时长" : "Length"}</dt>
                    <dd>{shownVideo.duration}s</dd>
                  </div>
                ) : null}
                {kind !== "audio" && shownVideo.aspectRatio ? (
                  <div>
                    <dt>{zh ? "画面比例" : "Aspect ratio"}</dt>
                    <dd>{shownVideo.aspectRatio}</dd>
                  </div>
                ) : null}
                {shownVideo.creditsUsed && shownTag !== "failed" ? (
                  <div>
                    <dt>{t("detail.cost")}</dt>
                    <dd data-num="">{t("credits", { count: shownVideo.creditsUsed })}</dd>
                  </div>
                ) : null}
              </dl>

              {shownTag === "failed" ? (
                <div className="cr-error">
                  <p>{zh ? "这次生成失败了，积分已自动退回。" : "This one failed. Your credits were returned automatically."}</p>
                  {shownVideo.errorMessage ? (
                    <details>
                      <summary>{zh ? "错误详情" : "Details"}</summary>
                      {failureReason(shownVideo.errorMessage, zh)}
                    </details>
                  ) : null}
                </div>
              ) : null}

              <div className="cr-detail-actions">
                {againHref ? (
                  <a
                    className="cr-button cr-button--ghost"
                    href={againHref}
                  >
                    <Sparkles aria-hidden="true" />
                    {t("actions.regenerate")}
                  </a>
                ) : null}
                {shownUrl ? (
                  <DownloadButton
                    key={`download-${shownVideo.uuid}`}
                    variant="detail"
                    url={shownUrl}
                    filename={downloadName(shownVideo, kind)}
                  />
                ) : null}
              </div>

              {isPending(shownTag) ? null : (
                <div className="cr-detail-danger">
                  <DeleteButton key={`delete-${shownVideo.uuid}`} variant="detail" onConfirm={() => removeFromDetail(shownVideo)} />
                </div>
              )}
            </aside>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
