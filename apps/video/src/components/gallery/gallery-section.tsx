"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Play } from "lucide-react";

import { GalleryDetailDialog } from "@/components/gallery/gallery-detail-dialog";
import {
  applyTemplate,
  unwrapApiData,
} from "@/components/gallery/use-template";
import type { GalleryItem } from "@/lib/gallery";

const PAGE_SIZE = 20;

interface GalleryListResponse {
  items: GalleryItem[];
  nextCursor: string | null;
}

type LoadStatus = "loading" | "ready" | "error";

/** Poster/video preview that plays muted on hover unless motion is reduced. */
function GalleryThumb({ item }: { item: GalleryItem }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const reducedMotion = useRef<boolean | null>(null);

  const prefersReducedMotion = () => {
    if (reducedMotion.current === null) {
      reducedMotion.current =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return reducedMotion.current;
  };

  const play = () => {
    const video = videoRef.current;
    if (!video || prefersReducedMotion()) return;
    void video.play().catch(() => undefined);
  };

  const stop = () => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    try {
      video.currentTime = 0;
    } catch {
      // Seeking can fail before metadata is ready; nothing to clean up.
    }
  };

  if (item.videoUrl) {
    return (
      <video
        ref={videoRef}
        src={item.videoUrl}
        poster={item.thumbnailUrl ?? undefined}
        muted
        loop
        playsInline
        preload="none"
        onMouseEnter={play}
        onMouseLeave={stop}
        className="h-full w-full object-cover"
      />
    );
  }

  if (item.thumbnailUrl) {
    return (
      <img
        src={item.thumbnailUrl}
        alt={item.title}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    );
  }

  return <span className="block h-full w-full bg-[image:var(--du-gradient)]" />;
}

export function GallerySection() {
  const t = useTranslations("Gallery");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeItem, setActiveItem] = useState<GalleryItem | null>(null);
  const [pendingUuid, setPendingUuid] = useState<string | null>(null);
  const [actionFailed, setActionFailed] = useState(false);

  const fetchPage = useCallback(async (cursor: string | null) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`/api/v1/gallery?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Failed to load gallery");

    return unwrapApiData<GalleryListResponse>(await response.json());
  }, []);

  const loadInitial = useCallback(async () => {
    setStatus("loading");
    try {
      const page = await fetchPage(null);
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, [fetchPage]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextCursor);
      setItems((prev) => [...prev, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      // Keep the current page; the button stays available for a retry.
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, loadingMore, nextCursor]);

  const handleUseTemplate = useCallback(
    async (uuid: string, event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (pendingUuid) return;
      setPendingUuid(uuid);
      setActionFailed(false);
      const ok = await applyTemplate(uuid, router, locale);
      setPendingUuid(null);
      if (!ok) setActionFailed(true);
    },
    [locale, pendingUuid, router]
  );

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--du-text-dim)]">
          {t("title")}
        </p>
        <h2 className="text-[32px] font-bold leading-tight text-[var(--du-text)] sm:text-[40px]">
          {t("subtitle")}
        </h2>
      </div>

      {status === "loading" ? (
        <p className="mt-8 inline-flex items-center gap-2 text-sm text-[var(--du-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {tc("loading")}
        </p>
      ) : null}

      {status === "error" ? (
        <p className="mt-8 text-sm text-[var(--du-text-muted)]">
          {tc("error")}
        </p>
      ) : null}

      {status === "ready" && items.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--du-text-muted)]">
          {t("empty")}
        </p>
      ) : null}

      {items.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.uuid}
              className="du-glass flex flex-col overflow-hidden"
            >
              <button
                type="button"
                aria-label={item.title}
                onClick={() => setActiveItem(item)}
                className="group relative block aspect-video w-full overflow-hidden border-b border-[var(--du-border)]"
              >
                <GalleryThumb item={item} />
                <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,var(--du-bg),transparent_60%)]" />
                <span className="du-glass-btn du-glass-round du-glass-on-media pointer-events-none absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <Play
                    className="h-4 w-4 text-[var(--du-on-accent)]"
                    aria-hidden="true"
                  />
                </span>
                {item.promptProtected ? (
                  <span className="du-glass-btn du-glass-on-media pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 px-2 py-1 text-[11px]">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    {t("protectedPromptBadge")}
                  </span>
                ) : null}
              </button>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-[15px] font-semibold text-[var(--du-text)]">
                  {item.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--du-text-muted)]">
                  {item.authorName} · {item.modelLabel}
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={(event) => void handleUseTemplate(item.uuid, event)}
                    disabled={pendingUuid === item.uuid}
                    className="du-glass-btn inline-flex h-9 items-center gap-2 px-3 text-xs disabled:opacity-60"
                  >
                    {pendingUuid === item.uuid ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : null}
                    {t("useTemplate")}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {actionFailed ? (
        <p className="mt-6 text-sm text-[var(--du-text-muted)]">
          {tc("error")}
        </p>
      ) : null}

      {nextCursor ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="du-glass-btn inline-flex h-11 items-center gap-2 px-5 text-sm disabled:opacity-60"
          >
            {loadingMore ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {t("loadMore")}
          </button>
        </div>
      ) : null}

      <GalleryDetailDialog
        item={activeItem}
        open={activeItem !== null}
        onOpenChange={(next) => {
          if (!next) setActiveItem(null);
        }}
      />
    </section>
  );
}
