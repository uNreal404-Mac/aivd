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
import { ArrowRight, ChevronLeft, ChevronRight, Loader2, Lock, Play, RotateCcw, Sparkles, WifiOff } from "lucide-react";
import { StateBlock } from "@/components/states/state-block";
import { GridSkeleton } from "@/components/states/skeletons";

import { GalleryDetailDialog } from "@/components/gallery/gallery-detail-dialog";
import {
  applyTemplate,
  unwrapApiData,
} from "@/components/gallery/use-template";
import type { GalleryItem } from "@/lib/gallery";
import { localizedHref } from "@/lib/du-home";
import { HOVER_INTENT_MS, playQuietly } from "@/lib/hover-play";
import { prefersReducedMotion, scrollMotion } from "@/lib/reduced-motion";
import "./home-gallery.css";
import "./gallery.css";

const PAGE_SIZE = 20;

const HOME_SAMPLES = [
  { image: "/home/hero-marina-poster.webp", zh: "海边的一刻", en: "A Moment by the Sea" },
  { image: "/home/gallery-sample-journey.jpg", zh: "共同旅程", en: "The Journey Together" },
  { image: "/home/samples/red-carpet.webp", zh: "红毯时刻", en: "Red Carpet Moment" },
  { image: "/home/samples/autumn-walk.webp", zh: "秋日同行", en: "Autumn Walk" },
  { image: "/home/samples/planet-impact.webp", zh: "星球撞击", en: "Planet Impact" },
  { image: "/home/samples/tomb-light.webp", zh: "古墓之光", en: "Light in the Tomb" },
] as const;

type GalleryFilter = "all" | "video" | "cinema" | "commercial";

interface CuratedGalleryEntry extends GalleryItem {
  category: Exclude<GalleryFilter, "all">;
}

function buildCuratedGallery(zh: boolean): CuratedGalleryEntry[] {
  return [
    {
      uuid: "curated-dragon",
      category: "video",
      title: zh ? "苍穹巨龙穿云航拍" : "Sky Dragon Aerial",
      description: zh ? "Seedance 2.5 1080p 航拍环绕大片" : "Seedance 2.5 1080p epic aerial shot",
      authorName: "Aivd Studio",
      model: "bytedance/seedance-2-5",
      modelLabel: "Seedance 2.5",
      thumbnailUrl: "/home/example-dragon-full-poster.webp",
      videoUrl: "/home/example-dragon-full.mp4",
      publicPrompt: zh ? "史诗级航拍环绕镜头，东方巨龙破开金色云海翱翔，鳞片在逆光中折射金属光泽，气势磅礴" : "Epic aerial orbiting shot of a dragon soaring through golden storm clouds, sunlight catching iridescent scales",
      promptProtected: false,
      aspectRatio: "16:9",
      duration: 8,
      resolution: "1080p",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-samurai-cat",
      category: "video",
      title: zh ? "武士猫樱花电影特写" : "Samurai Cat Cinema",
      description: zh ? "浅景深电影级近景拔刀运镜" : "Shallow DOF cinematic katana draw",
      authorName: "Aivd Studio",
      model: "veo-3.1",
      modelLabel: "Veo 3.1",
      thumbnailUrl: "/home/example-samurai-cat-7s-poster.webp",
      videoUrl: "/home/example-samurai-cat-7s.mp4",
      publicPrompt: zh ? "浅景深近景特写，身穿精致甲胄的武士猫站在飘落的樱花雨中缓缓拔刀，微风吹动披风，电影级布光" : "Shallow depth-of-field close-up of an armored samurai cat in drifting cherry blossoms slowly drawing its katana",
      promptProtected: false,
      aspectRatio: "9:16",
      duration: 7,
      resolution: "1080p",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-whale-origami",
      category: "video",
      title: zh ? "折纸鲸鱼云海奇境" : "Origami Whale Dream",
      description: zh ? "发光折纸鲸鱼穿梭深蓝云海" : "Luminous origami whale in cobalt cloud sea",
      authorName: "Aivd Studio",
      model: "bytedance/seedance-2-5",
      modelLabel: "Seedance 2.5",
      thumbnailUrl: "/home/example-whale-origami-7s-poster.webp",
      videoUrl: "/home/example-whale-origami-7s.mp4",
      publicPrompt: zh ? "梦幻微距跟拍，一只由发光折纸折成的巨鲸在深蓝云海中优雅游动，纸张纹理清晰，柔和体积光" : "Dreamlike tracking shot of a luminous origami whale gliding through a cobalt cloud sea, crisp paper folds",
      promptProtected: false,
      aspectRatio: "16:9",
      duration: 7,
      resolution: "1080p",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-couture-dress",
      category: "commercial",
      title: zh ? "高定流光丝绸时装大片" : "Couture Silk Editorial",
      description: zh ? "高速升格棚拍高定布料飘动" : "Slow-motion studio couture fabric flow",
      authorName: "Aivd Studio",
      model: "kling/v4-reference-to-video",
      modelLabel: "Kling 4.0",
      thumbnailUrl: "/home/example-dress-10-20-poster.webp",
      videoUrl: "/home/example-dress-10-20.mp4",
      publicPrompt: zh ? "高级时装棚拍慢动作，流光丝绸礼服随风舒展飘动，暗调极简背景，轮廓光勾勒织物质感" : "High-fashion slow-motion editorial of flowing iridescent silk couture against an obsidian studio backdrop",
      promptProtected: false,
      aspectRatio: "9:16",
      duration: 5,
      resolution: "1080p",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-japan",
      category: "video",
      title: zh ? "东京深夜街头食光" : "Tokyo Late-Night Konbini",
      description: zh ? "35mm 胶片手持慢推日系都市氛围" : "35mm handheld slow push-in Tokyo night",
      authorName: "Aivd Studio",
      model: "bytedance/seedance-2-5",
      modelLabel: "Seedance 2.5",
      thumbnailUrl: "/home/example-japan-6s-poster.webp",
      videoUrl: "/home/example-japan-6s.mp4",
      publicPrompt: zh ? "电影级手持慢推镜头，东京深夜便利店暖光与街头霓虹交织，近景呈现日系美食与温馨都市氛围，35mm 胶片质感" : "Cinematic handheld push-in through a warm late-night Tokyo convenience store glowing against neon streets",
      promptProtected: false,
      aspectRatio: "16:9",
      duration: 6,
      resolution: "1080p",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-marina",
      category: "cinema",
      title: zh ? "黄金时刻海岸游艇航拍" : "Golden Hour Marina Aerial",
      description: zh ? "日落余晖与海面波光电影感运镜" : "Sunset golden hour yacht glide",
      authorName: "Aivd Studio",
      model: "veo-3.1",
      modelLabel: "Veo 3.1",
      thumbnailUrl: "/home/hero-marina-poster.webp",
      videoUrl: "/home/hero-marina-loop.mp4",
      publicPrompt: zh ? "电影级航拍缓推，日落黄金时刻地中海游艇码头波光粼粼，海风轻拂，柔和胶片暖色调" : "Cinematic aerial glide over a Mediterranean marina at golden hour sunset, warm shimmering water",
      promptProtected: false,
      aspectRatio: "16:9",
      duration: 8,
      resolution: "1080p",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-food",
      category: "commercial",
      title: zh ? "电影级美食升格微距广告" : "Macro Food Commercial",
      description: zh ? "高速升格香料洒落与热气质感" : "High-speed macro commercial spice fall",
      authorName: "Aivd Studio",
      model: "veo-3.1",
      modelLabel: "Veo 3.1",
      thumbnailUrl: "/home/example-fried-chicken-22-29-poster.webp",
      videoUrl: "/home/example-fried-chicken-22-29.mp4",
      publicPrompt: zh ? "高速升格微距商业广告镜头，金黄酥脆炸鸡热气升腾，辣椒粉与香料颗粒在慢动作中凌空洒落，诱人高光" : "High-speed macro commercial shot of crispy fried chicken with rising steam and spices falling in slow motion",
      promptProtected: false,
      aspectRatio: "16:9",
      duration: 5,
      resolution: "1080p",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-rain-couple",
      category: "cinema",
      title: zh ? "霓虹雨夜双人电影剧照" : "Neon Rain Cinema Still",
      description: zh ? "Nano Banana Pro 4K 电影级氛围光影" : "Nano Banana Pro 4K atmospheric film still",
      authorName: "Aivd Studio",
      model: "nano-banana-pro",
      modelLabel: "Nano Banana Pro",
      thumbnailUrl: "/home/samples/rain-couple.webp",
      videoUrl: null,
      publicPrompt: zh ? "霓虹雨夜东京街头电影感中景，湿润反光柏油路面，青蓝与洋红霓虹光斑，35mm 胶片颗粒，浅景深" : "Neon Tokyo rain street cinematic medium shot, wet asphalt reflections in cyan and magenta, 35mm film grain",
      promptProtected: false,
      aspectRatio: "3:4",
      duration: null,
      resolution: "4K",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-red-carpet",
      category: "commercial",
      title: zh ? "星光红毯高定肖像大片" : "Red Carpet Haute Portrait",
      description: zh ? "Kling Image 4.0 杂志级闪光灯人像" : "Kling Image 4.0 editorial flash portrait",
      authorName: "Aivd Studio",
      model: "kling-image-4",
      modelLabel: "Kling Image 4.0",
      thumbnailUrl: "/home/samples/red-carpet.webp",
      videoUrl: null,
      publicPrompt: zh ? "国际电影节红毯高定晚礼服人像，闪光灯与散景交错，高级时尚杂志封面质感，4K 皮肤与织物细节" : "International film festival red carpet couture portrait, flash photography bokeh, luxury editorial 4K",
      promptProtected: false,
      aspectRatio: "4:5",
      duration: null,
      resolution: "4K",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-cosmic-bloom",
      category: "cinema",
      title: zh ? "星云水晶花超现实视觉" : "Cosmic Crystal Bloom",
      description: zh ? "青蓝体积光与玻璃折射艺术大片" : "Cyan volumetric light & crystal refraction art",
      authorName: "Aivd Studio",
      model: "nano-banana-pro",
      modelLabel: "Nano Banana Pro",
      thumbnailUrl: "/home/samples/cosmic-bloom.webp",
      videoUrl: null,
      publicPrompt: zh ? "超现实微距艺术摄影，深邃暗夜中一朵透明水晶花绽放出青蓝色星云光晕，丁达尔体积光，8K 细节" : "Surreal macro fine-art photography of a translucent crystal flower glowing with cyan-blue nebula light in deep dark space",
      promptProtected: false,
      aspectRatio: "1:1",
      duration: null,
      resolution: "4K",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-mech",
      category: "cinema",
      title: zh ? "赛博机甲战士概念视觉" : "Cyber Mech Concept Art",
      description: zh ? "科幻硬表面金属磨损与电影布光" : "Sci-fi hard-surface armor & cinema lighting",
      authorName: "Aivd Studio",
      model: "gpt-image-2-6-sunburst",
      modelLabel: "GPT Image 2.6",
      thumbnailUrl: "/home/samples/mech-warrior.webp",
      videoUrl: null,
      publicPrompt: zh ? "科幻电影概念设定，身披战损钛合金机甲的未来战士立于烟雾之中，青蓝能量核心微光，史诗级硬光质感" : "Sci-fi film concept art of a battle-worn titanium mech warrior standing in atmospheric mist with glowing cyan core",
      promptProtected: false,
      aspectRatio: "3:4",
      duration: null,
      resolution: "4K",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
    {
      uuid: "curated-studio",
      category: "commercial",
      title: zh ? "极简光影建筑商业空间" : "Minimal Architectural Space",
      description: zh ? "高端空间摄影与柔光质感" : "High-end architectural daylight study",
      authorName: "Aivd Studio",
      model: "nano-banana-pro",
      modelLabel: "Nano Banana Pro",
      thumbnailUrl: "/home/samples/studio-room.webp",
      videoUrl: null,
      publicPrompt: zh ? "极简现代主义摄影棚空间，落地窗自然侧光洒在微水泥墙面，建筑感几何光影，高端商业杂志视觉" : "Minimalist architectural studio room bathed in natural side-window daylight, crisp geometric shadows, editorial 4K",
      promptProtected: false,
      aspectRatio: "4:3",
      duration: null,
      resolution: "4K",
      publishedAt: null,
      assetsReusable: true,
      hasStartImage: false,
      startImageUrl: null,
    },
  ];
}
interface GalleryListResponse {
  items: GalleryItem[];
  nextCursor: string | null;
}

type LoadStatus = "loading" | "ready" | "error";

/** Poster/video preview that plays muted while hovered. */
function GalleryThumb({ item }: { item: GalleryItem }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A preview still waiting to start must not start after the card is gone.
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Hovering is the visitor asking for a preview, so it also works with
  // reduced motion; there it waits a moment so a passing cursor does not
  // start it.
  const play = () => {
    const video = videoRef.current;
    if (!video) return;
    clearTimeout(hoverTimer.current);
    if (prefersReducedMotion()) hoverTimer.current = setTimeout(() => playQuietly(video), HOVER_INTENT_MS);
    else playQuietly(video);
  };

  const stop = () => {
    clearTimeout(hoverTimer.current);
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
  const [filter, setFilter] = useState<GalleryFilter>("all");
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
    rail.scrollBy({ left: direction * (card.offsetWidth + 18), behavior: scrollMotion() });
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

    // The homepage shows this section only when creators have published
    // something. Until then the idea templates above carry the visuals, and
    // a "community" row of site samples would repeat them.
    if (showSamples) return null;

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
                        <span className="absolute left-3 top-3 rounded-full border border-[var(--du-border-strong)] bg-[var(--du-bg-elev)]/90 px-2.5 py-1 text-[11px] font-semibold text-[var(--du-accent-text)]">
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
        <GalleryDetailDialog item={activeItem} open={activeItem !== null} onOpenChange={(next) => { if (!next) setActiveItem(null); }} />
      </section>
    );
  }

  const zh = locale.toLowerCase().startsWith("zh");
  const isCuratedFallback = status === "ready" && items.length === 0;
  const curatedAll = isCuratedFallback ? buildCuratedGallery(zh) : [];
  const displayedItems: GalleryItem[] = isCuratedFallback
    ? filter === "all"
      ? curatedAll
      : curatedAll.filter((entry) => entry.category === filter)
    : items;

  const handleRemix = (item: GalleryItem, event: MouseEvent<HTMLButtonElement>) => {
    if (item.uuid.startsWith("curated-")) {
      event.stopPropagation();
      const target = item.videoUrl ? "/ai/video" : "/ai/image";
      const qs = new URLSearchParams();
      if (item.publicPrompt) qs.set("prompt", item.publicPrompt);
      if (item.model) qs.set("model", item.model);
      router.push(`${localizedHref(locale, target)}?${qs.toString()}`);
      return;
    }
    void handleUseTemplate(item.uuid, event);
  };

  return (
    <section className="gl" aria-label={t("subtitle")}>
      {isCuratedFallback ? (
        <fieldset className="gl-chips" aria-label={zh ? "作品分类" : "Gallery category"}>
          {([
            ["all", zh ? "全部精选" : "All Featured"],
            ["video", zh ? "动态视频" : "Motion Video"],
            ["cinema", zh ? "电影大片" : "Cinema & Art"],
            ["commercial", zh ? "商业广告" : "Commercial"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={filter === key}
              className={filter === key ? "gl-chip gl-chip-on" : "gl-chip"}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </fieldset>
      ) : null}

      {status === "loading" ? <GridSkeleton count={5} height={320} /> : null}

      {status === "error" ? (
        <StateBlock
          framed
          tone="error"
          icon={WifiOff}
          title={zh ? "作品没能加载出来" : "The gallery did not load"}
          body={zh ? "可能是网络不稳定，稍后再试一次。" : "The connection may be unsteady. Try again in a moment."}
          actions={[{ label: zh ? "重试" : "Try again", onClick: () => void loadInitial(), icon: RotateCcw, primary: true }]}
        />
      ) : null}

      {displayedItems.length > 0 ? (
        <ul className="gl-grid">
          {displayedItems.map((item) => (
            <li key={item.uuid} className="gl-item">
              <article
                className="gl-card"
                style={{ aspectRatio: (item.aspectRatio ?? "16:9").replace(":", " / ") }}
              >
                <button
                  type="button"
                  className="gl-open"
                  aria-label={zh ? `查看作品：${item.title}` : `View creation: ${item.title}`}
                  onClick={() => setActiveItem(item)}
                >
                  <GalleryThumb item={item} />
                </button>
                {item.promptProtected ? (
                  <span className="gl-tag">
                    <Lock aria-hidden="true" />
                    {t("protectedPromptBadge")}
                  </span>
                ) : (
                  <span className="gl-tag">{item.modelLabel}</span>
                )}
                {item.videoUrl ? (
                  <span className="gl-play" aria-hidden="true">
                    <Play />
                  </span>
                ) : null}
                <div className="gl-over">
                  <div className="gl-text">
                    <h3 className="gl-name">{item.title}</h3>
                    <p className="gl-meta">
                      {item.authorName} · {item.resolution ?? item.modelLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="gl-use"
                    onClick={(event) => handleRemix(item, event)}
                    disabled={pendingUuid === item.uuid}
                  >
                    {pendingUuid === item.uuid ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
                    {zh ? "做同款" : "Remix"}
                  </button>
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : null}

      {actionFailed ? (
        <p className="gl-note">
          {tc("error")}
        </p>
      ) : null}

      {nextCursor ? (
        <div className="gl-more-row">
          <button type="button" onClick={() => void loadMore()} disabled={loadingMore} className="gl-more">
            {loadingMore ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
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
