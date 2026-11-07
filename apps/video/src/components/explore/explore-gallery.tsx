"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Clock3, Play, TrendingUp, Video } from "lucide-react";
import { GalleryDetailDialog } from "@/components/gallery/gallery-detail-dialog";
import { unwrapApiData } from "@/components/gallery/use-template";
import { localizedHref } from "@/lib/du-home";
import type { GalleryItem } from "@/lib/gallery";

type Tab = "aivd" | "hot" | "new";
const SITE_VIDEOS = [
  { src: "/home/hero-marina-loop.mp4", poster: "/home/hero-marina-poster.png", zh: "海边时刻", en: "Marina moments", tall: true },
  { src: "/home/hero-showcase-02.mp4", poster: "/home/video-pro.webp", zh: "电影质感", en: "Cinematic motion", tall: false },
  { src: "/home/hero-showcase-03.mp4", poster: "/home/coast-drive.webp", zh: "灵感速写", en: "Ideas in motion", tall: false },
];

export function ExploreGallery({ lang }: { lang: string }) {
  const zh = lang === "zh";
  const [tab, setTab] = useState<Tab>("aivd");
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  useEffect(() => {
    if (tab === "aivd") return;
    let active = true;
    setLoading(true);
    setFailed(false);
    fetch(`/api/v1/gallery?limit=24${tab === "hot" ? "&sort=rating" : ""}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("Gallery unavailable"); return response.json(); })
      .then((payload: unknown) => {
        if (!active) return;
        const data = unwrapApiData<{ items: GalleryItem[] }>(payload);
        setItems(data.items ?? []);
      })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab]);

  const tabs = [
    { id: "aivd" as const, label: "aivd", Icon: Video },
    { id: "hot" as const, label: zh ? "社区热门" : "Community Hot", Icon: TrendingUp },
    { id: "new" as const, label: zh ? "社区最新" : "Community New", Icon: Clock3 },
  ];

  return <div className="w-full">
    <div role="tablist" aria-label={zh ? "探索分类" : "Explore categories"} className="mx-auto mb-8 flex w-fit max-w-full flex-wrap justify-center gap-1 rounded-full border border-[var(--du-border)] bg-[var(--du-surface)] p-1.5">
      {tabs.map(({ id, label, Icon }) => <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)} className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors sm:px-5 ${tab === id ? "bg-[var(--du-text)] text-[var(--du-bg)]" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}><Icon size={17} aria-hidden="true" />{label}</button>)}
    </div>
    {tab === "aivd" ? <div className="grid auto-rows-[220px] gap-4 md:grid-cols-2">
      {SITE_VIDEOS.map((item) => <Link key={item.src} href={localizedHref(lang, "/ai/video")} className={`group relative overflow-hidden rounded-[24px] border border-[var(--du-border)] bg-[var(--du-surface)] ${item.tall ? "row-span-2" : ""}`}>
        <video src={item.src} poster={item.poster} muted loop playsInline preload="metadata" onMouseEnter={(event) => { void event.currentTarget.play().catch(() => undefined); }} onMouseLeave={(event) => { event.currentTarget.pause(); }} className="h-full w-full object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" /><span className="absolute bottom-5 left-5 text-lg font-semibold text-white">{zh ? item.zh : item.en}</span><span className="absolute bottom-5 right-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur"><Play size={18} aria-hidden="true" /></span>
      </Link>)}
    </div> : <>
      {loading ? <p className="py-20 text-center text-[var(--du-text-muted)]">{zh ? "正在加载作品…" : "Loading creations…"}</p> : null}
      {failed ? <p className="py-20 text-center text-[var(--du-text-muted)]">{zh ? "暂时无法加载社区作品。" : "Community creations are temporarily unavailable."}</p> : null}
      {!loading && !failed && items.length === 0 ? <p className="py-20 text-center text-[var(--du-text-muted)]">{zh ? "还没有公开作品。发布到 Gallery 后会显示在这里。" : "No public creations yet. Shared Gallery videos will appear here."}</p> : null}
      {!loading && !failed && items.length > 0 ? <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {items.map((item) => <button key={item.uuid} type="button" onClick={() => setSelected(item)} className="group relative mb-4 block w-full break-inside-avoid overflow-hidden rounded-[24px] border border-[var(--du-border)] bg-[var(--du-surface)] text-left">
          <div className="aspect-[4/5] w-full overflow-hidden bg-[var(--du-surface)]">{item.videoUrl ? <video src={item.videoUrl} poster={item.thumbnailUrl ?? undefined} muted loop playsInline preload="none" onMouseEnter={(event) => { void event.currentTarget.play().catch(() => undefined); }} onMouseLeave={(event) => { event.currentTarget.pause(); }} className="h-full w-full object-cover" /> : item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}</div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-16 text-white"><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-white/70">{item.authorName} · {item.modelLabel}{item.ratingCount ? ` · ★ ${item.ratingAverage?.toFixed(1)} (${item.ratingCount})` : ""}</p></div>
        </button>)}
      </div> : null}
    </>}
    <GalleryDetailDialog item={selected} open={selected !== null} onOpenChange={(open) => { if (!open) setSelected(null); }} />
  </div>;
}
