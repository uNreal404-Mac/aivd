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
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Lock, Play } from "lucide-react";

import { GalleryDetailDialog } from "@/components/gallery/gallery-detail-dialog";
import {
  applyTemplate,
  unwrapApiData,
} from "@/components/gallery/use-template";
import type { GalleryItem } from "@/lib/gallery";
import { localizedHref } from "@/lib/du-home";
import "./home-gallery.css";

const PAGE_SIZE = 20;

const HOME_SAMPLES = [
  { image: "/home/hero-marina-poster.webp", zh: "海边的一刻", en: "A Moment by the Sea" },
  { image: "/home/gallery-sample-journey.jpg", zh: "共同旅程", en: "The Journey Together" },
  { image: "/home/samples/red-carpet.webp", zh: "红毯时刻", en: "Red Carpet Moment" },
  { image: "/home/samples/autumn-walk.webp", zh: "秋日同行", en: "Autumn Walk" },
  { image: "/home/samples/planet-impact.webp", zh: "星球撞击", en: "Planet Impact" },
  { image: "/home/samples/tomb-light.webp", zh: "古墓之光", en: "Light in the Tomb" },
] as const;

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

  return <span className="block h-full w-full bg-[var(--du-accent)]" />;
}

export function GallerySection({
  initialItemUuid,
  variant = "default",
}: {
  initialItemUuid?: string;
  variant?: "default" | "home";
} = {}) {
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
  const railRef = useRef<HTMLDivElement | null>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const updateScrollButtons = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    setCanScrollPrev(rail.scrollLeft > 2);
    setCanScrollNext(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2);
  }, []);

  useEffect(() => {
    if (variant !== "home") return;
    const rail = railRef.current;
    if (!rail) return;
    const observer = new ResizeObserver(updateScrollButtons);
    observer.observe(rail);
    const frame = requestAnimationFrame(updateScrollButtons);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [items.length, status, updateScrollButtons, variant]);

  const scrollHome = (direction: -1 | 1) => {
    const rail = railRef.current;
    const card = rail?.querySelector<HTMLElement>(".home-gallery-card");
    if (!rail || !card) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    rail.scrollBy({
      left: direction * (card.offsetWidth + 18),
      behavior: reducedMotion ? "instant" : "smooth",
    });
  };

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

  useEffect(() => {
    if (!initialItemUuid) return;

    let cancelled = false;
    const loadRequestedItem = async () => {
      try {
        const response = await fetch(`/api/v1/gallery/${initialItemUuid}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const item = unwrapApiData<GalleryItem>(await response.json());
        if (!cancelled) setActiveItem(item);
      } catch {
        // The list remains usable when a shared item was removed meanwhile.
      }
    };

    void loadRequestedItem();
    return () => {
      cancelled = true;
    };
  }, [initialItemUuid]);

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

  if (variant === "home") {
    const isChinese = locale.toLowerCase().startsWith("zh");
    const showSamples = status !== "ready" || items.length === 0;

    return (
      <section className="home-gallery-section mx-auto max-w-[1680px] px-4 py-16 sm:px-6" aria-label={isChinese ? "作品画廊" : "Community gallery"}>
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--du-accent-text)]">
              {isChinese ? "作品画廊" : "COMMUNITY GALLERY"}
            </p>
            <h2 className="mt-3 text-[clamp(1.9rem,3.4vw,3.5rem)] font-semibold leading-tight tracking-[-0.035em] text-[var(--du-text)]">
              {isChinese ? "探索每一种创作可能" : "Explore what we can create"}
            </h2>
            <p className="mt-2 text-sm text-[var(--du-text-muted)] sm:text-base">
              {isChinese ? "横向滑动，发现社区作品与灵感。" : "Slide through community creations and find your next idea."}
            </p>
          </div>
          <Link
            href={localizedHref(locale, "/gallery")}
            className="inline-flex w-fit items-center gap-2 border-b border-[var(--du-border-strong)] pb-1 text-sm font-semibold text-[var(--du-accent-text)] transition-colors hover:text-[var(--du-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--du-accent)]"
          >
            {isChinese ? "查看完整画廊" : "View the full gallery"}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="home-gallery-film relative overflow-hidden rounded-[24px] border border-[var(--du-border-strong)] sm:rounded-[30px]">
          <div className="home-gallery-perforation" aria-hidden="true" />
          <div className="relative px-4 py-5 sm:px-12 sm:py-7">
            <div
              ref={railRef}
              onScroll={updateScrollButtons}
              className="home-gallery-rail flex gap-[18px] overflow-x-auto overscroll-x-contain pb-1"
            >
              {showSamples
                ? HOME_SAMPLES.map((sample, index) => (
                    <article key={sample.image} className="home-gallery-card overflow-hidden rounded-[20px] border border-[var(--du-border-strong)] bg-[var(--du-surface)]">
                      <div className="relative aspect-[16/9] overflow-hidden">
                        <img src={sample.image} alt="" loading={index < 3 ? "eager" : "lazy"} className="h-full w-full object-cover" />
                        <span className="absolute left-3 top-3 rounded-full border border-[var(--du-border-strong)] bg-[var(--du-bg-elev)]/90 px-2.5 py-1 text-[10px] font-semibold text-[var(--du-accent-text)]">
                          {isChinese ? "示例" : "Example"}
                        </span>
                      </div>
                      <div className="home-gallery-card-copy p-4 sm:p-5">
                        <h3 className="truncate text-base font-semibold text-[var(--du-text)] sm:text-lg">
                          {isChinese ? sample.zh : sample.en}
                        </h3>
                      </div>
                    </article>
                  ))
                : items.map((item) => (
                    <article key={item.uuid} className="home-gallery-card overflow-hidden rounded-[20px] border border-[var(--du-border-strong)] bg-[var(--du-surface)]">
                      <button
                        type="button"
                        onClick={() => setActiveItem(item)}
                        aria-label={isChinese ? `查看作品：${item.title}` : `View creation: ${item.title}`}
                        className="group block w-full text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[var(--du-accent)]"
                      >
                        <div className="relative aspect-[16/9] overflow-hidden">
                          <GalleryThumb item={item} />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                          <span className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full border border-[var(--du-border-strong)] bg-[var(--du-bg-elev)]/80 text-[var(--du-accent-text)] transition-transform group-hover:scale-110">
                            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
                          </span>
                        </div>
                        <div className="home-gallery-card-copy p-4 sm:p-5">
                          <h3 className="truncate text-base font-semibold text-[var(--du-text)] sm:text-lg">{item.title}</h3>
                          <p className="mt-1 truncate text-xs text-[var(--du-text-muted)] sm:text-sm">{item.authorName} · {item.modelLabel}</p>
                        </div>
                      </button>
                    </article>
                  ))}
            </div>

            <button type="button" onClick={() => scrollHome(-1)} disabled={!canScrollPrev} aria-label={isChinese ? "向左滑动画廊" : "Scroll gallery left"} className="home-gallery-arrow home-gallery-arrow-left" >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => scrollHome(1)} disabled={!canScrollNext} aria-label={isChinese ? "向右滑动画廊" : "Scroll gallery right"} className="home-gallery-arrow home-gallery-arrow-right" >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="home-gallery-perforation" aria-hidden="true" />
        </div>

        {status === "error" ? <p className="mt-3 text-xs text-[var(--du-text-muted)]">{isChinese ? "画廊暂时无法加载，当前展示站内示例。" : "The gallery is temporarily unavailable. Showing site samples."}</p> : null}
        <GalleryDetailDialog item={activeItem} open={activeItem !== null} onOpenChange={(next) => { if (!next) setActiveItem(null); }} />
      </section>
    );
  }

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
                <span className="pointer-events-none absolute inset-0 bg-black/45" />
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
