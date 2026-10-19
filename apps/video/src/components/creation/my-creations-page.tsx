"use client";

// ============================================
// My Creations Page
// ============================================

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useVideos } from "@/hooks/use-videos";
import { useRefreshProcessingVideos } from "@/hooks/use-videos";
import {
  CreationCard,
  CreationGrid,
  CreationFilter,
  CreationEmpty,
  CreationSkeleton,
  VideoDetailDialog,
} from "@/components/creation";
import type { Video, VideoFilterOptions } from "@/lib/types/dashboard";
import { authClient } from "@/lib/auth/client";

interface MyCreationsPageProps {
  locale: string;
}

export function MyCreationsPage({ locale }: MyCreationsPageProps) {
  const t = useTranslations("dashboard.myCreations");
  const { data: session } = authClient.useSession();

  // Filter state
  const [filter, setFilter] = useState<VideoFilterOptions>({
    status: "all",
    model: "all",
    sortBy: "newest",
  });

  // Selected video for detail dialog
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Fetch videos
  const {
    videos,
    isLoading,
    hasMore,
    fetchNextPage,
    isFetchingNextPage,
    deleteVideo,
    isDeleting,
    refetch,
  } = useVideos(filter);

  // Auto-refresh processing videos
  useRefreshProcessingVideos(videos, refetch);

  useEffect(() => {
    if (!selectedVideo) return;
    const fresh = videos.find((video) => video.uuid === selectedVideo.uuid);
    if (fresh) setSelectedVideo(fresh);
  }, [selectedVideo, videos]);

  // Infinite scroll observer
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 1.0 }
    );

    const current = observerTarget.current;
    if (current) {
      observer.observe(current);
    }

    return () => {
      if (current) {
        observer.unobserve(current);
      }
    };
  }, [hasMore, isFetchingNextPage, fetchNextPage]);

  const handleFilterChange = (newFilter: Partial<VideoFilterOptions>) => {
    setFilter((prev) => ({ ...prev, ...newFilter }));
  };

  const handleVideoClick = (uuid: string) => {
    const video = videos.find((v) => v.uuid === uuid);
    if (video) {
      setSelectedVideo(video);
    }
  };

  const handleCloseDialog = () => {
    setSelectedVideo(null);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#0f1113] p-2 text-[#f7f7f8] sm:p-3">
      <div className="flex min-h-[calc(100vh-5.5rem)] flex-col rounded-2xl border border-white/[0.06] bg-[#131416]">
        {/* Header */}
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-white/[0.06] bg-[#131416]/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center">
            <h1 className="text-base font-semibold">{t("title")}</h1>
            <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-[#9a9ba0]">
              {videos.length}
            </span>
          </div>

          {/* Filter */}
          <CreationFilter filter={filter} onFilterChange={handleFilterChange} />
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-3">
          {isLoading ? (
            <CreationSkeleton />
          ) : videos.length === 0 ? (
            <CreationEmpty />
          ) : (
            <>
              <CreationGrid>
                {videos.map((video) => (
                  <CreationCard
                    key={video.uuid}
                    video={video}
                    onClick={handleVideoClick}
                    onDelete={deleteVideo}
                    isDeleting={isDeleting}
                  />
                ))}
              </CreationGrid>

              {/* Infinite scroll sentinel */}
              {hasMore && (
                <div ref={observerTarget} className="py-4 text-center text-sm text-[#9a9ba0]">
                  {isFetchingNextPage ? "Loading..." : ""}
                </div>
              )}
            </>
          )}
        </div>

        {/* Video Detail Dialog */}
        <VideoDetailDialog
          video={selectedVideo}
          open={!!selectedVideo}
          onClose={handleCloseDialog}
          onDelete={deleteVideo}
          onPublished={() => void refetch()}
          onUnpublished={() => void refetch()}
          isSuperAccount={Boolean(session?.user?.isSuperAccount)}
          isDeleting={isDeleting}
        />
      </div>
    </div>
  );
}
