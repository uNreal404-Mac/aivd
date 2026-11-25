"use client";

// ============================================
// Video Hooks
// ============================================

import { useCallback, useEffect } from "react";
import { useInfiniteQuery, useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { apiClient } from "@/lib/api/dashboard-client";
import type { VideoFilterOptions } from "@/lib/types/dashboard";

const DELETE_MUTATION_KEY = ["videos", "delete"] as const;

/**
 * Fetch videos with infinite scroll
 */
export function useVideos(filter?: VideoFilterOptions, options: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const t = useTranslations("dashboard.myCreations");

  const {
    data,
    isLoading,
    isFetching,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["videos", filter],
    queryFn: async ({ pageParam }) => {
      return apiClient.getVideos({
        limit: 20,
        cursor: pageParam,
        type: filter?.mediaType,
      });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    refetchOnWindowFocus: false,
    enabled: options.enabled ?? true,
  });

  // Flatten pages
  const videos = data?.pages.flatMap((page) => page.videos) || [];
  const hasMore = hasNextPage || false;

  const restoreMutation = useMutation({
    mutationFn: (uuid: string) => apiClient.restoreVideo(uuid),
    onSuccess: (_result, uuid) => {
      toast.success(t("actions.restored"), { id: `delete:${uuid}` });
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (_error, uuid) => {
      toast.error(t("actions.restoreError"), {
        id: `delete:${uuid}`,
        action: { label: t("actions.retry"), onClick: () => restoreMutation.mutate(uuid) },
      });
    },
  });

  // 删除视频
  const deleteMutation = useMutation({
    mutationKey: DELETE_MUTATION_KEY,
    mutationFn: async (uuid: string) => {
      return apiClient.deleteVideo(uuid);
    },
    onMutate: async (uuid) => {
      // A refresh already on its way (processing items poll every few
      // seconds) would put the deleted item back, so it is called off first.
      await queryClient.cancelQueries({ queryKey: ["videos", filter] });
      // 乐观删除. Remember only this item and where it was: if the delete
      // fails, it alone comes back (a whole-list snapshot would also bring back
      // anything deleted successfully in the meantime).
      const previous: any = queryClient.getQueryData(["videos", filter]);
      let removed: { item: any; page: number; index: number } | null = null;
      previous?.pages?.forEach((page: any, pageIndex: number) => {
        const index = page.videos?.findIndex((v: any) => v.uuid === uuid) ?? -1;
        if (index >= 0 && !removed) removed = { item: page.videos[index], page: pageIndex, index };
      });
      queryClient.setQueryData(
        ["videos", filter],
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              videos: page.videos.filter((v: any) => v.uuid !== uuid),
            })),
          };
        }
      );

      return { removed };
    },
    onSuccess: (_data, uuid) => {
      toast.success(t("actions.deleteSuccess"), {
        id: `delete:${uuid}`,
        duration: 10000,
        action: { label: t("actions.undoDelete"), onClick: () => restoreMutation.mutate(uuid) },
      });
    },
    onError: (_error, uuid, context) => {
      // 回滚: put back just this item, where it was.
      const removed = context?.removed as { item: any; page: number; index: number } | null | undefined;
      if (removed) {
        queryClient.setQueryData(["videos", filter], (old: any) => {
          if (!old?.pages?.[removed.page] || old.pages.some((page: any) => page.videos?.some((v: any) => v.uuid === uuid))) return old;
          return {
            ...old,
            pages: old.pages.map((page: any, pageIndex: number) => {
              if (pageIndex !== removed.page) return page;
              const videos = [...page.videos];
              videos.splice(Math.min(removed.index, videos.length), 0, removed.item);
              return { ...page, videos };
            }),
          };
        });
      }
      toast.error(t("actions.deleteError"), {
        id: `delete:${uuid}`,
        action: { label: t("actions.retry"), onClick: () => deleteMutation.mutate(uuid) },
      });
    },
  });

  // Only the items being deleted, so one deletion never dims the others.
  const deletingIds = useMutationState({
    filters: { mutationKey: DELETE_MUTATION_KEY, status: "pending" },
    select: (mutation) => mutation.state.variables as string,
  });

  // 重试失败视频
  const retryMutation = useMutation({
    mutationFn: async (uuid: string) => {
      return apiClient.retryVideo(uuid);
    },
    onSuccess: () => {
      toast.success(t("actions.retrySuccess") || "Retry initiated");
      refetch();
    },
    onError: () => {
      toast.error(t("actions.retryError") || "Failed to retry");
    },
  });

  // 删除单个视频
  const deleteVideo = useCallback(
    async (uuid: string) => {
      await deleteMutation.mutateAsync(uuid);
    },
    [deleteMutation]
  );

  // 重试单个视频
  const retryVideo = useCallback(
    async (uuid: string) => {
      await retryMutation.mutateAsync(uuid);
    },
    [retryMutation]
  );

  return {
    videos,
    isLoading,
    isFetching,
    error,
    hasMore,
    fetchNextPage,
    isFetchingNextPage,
    refetch,
    deleteVideo,
    retryVideo,
    isDeleting: deleteMutation.isPending,
    deletingIds,
  };
}

/**
 * Get single video
 */
export function useVideo(uuid: string) {
  return useQuery({
    queryKey: ["video", uuid],
    queryFn: () => apiClient.getVideo(uuid),
    enabled: !!uuid,
    select: (data) => data.video,
  });
}

const BLOB_EXTENSIONS: Readonly<Record<string, string>> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
};

/** Gives the file the extension its content really has, when that is known. */
function filenameFor(filename: string, type: string): string {
  const extension = BLOB_EXTENSIONS[type.split(";")[0].trim().toLowerCase()];
  if (!extension) return filename;
  return `${filename.replace(/\.[a-z0-9]+$/i, "")}.${extension}`;
}

/**
 * Download a file to disk.
 *
 * Media lives on another origin, where browsers ignore `<a download>` and
 * open the file instead, so it is fetched and saved from a blob. Resolves
 * true once the save has started. On failure it shows a toast: with `retry`
 * the toast offers to try again; without it (a repeat failure) it offers to
 * open the file in a new tab, so the user can always still get it.
 */
export function useDownloadVideo() {
  const t = useTranslations("dashboard.myCreations");

  const download = useCallback(
    async (fileUrl: string, filename: string, retry?: () => void): Promise<boolean> => {
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filenameFor(filename, blob.type);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoking at once can cancel the save in some browsers.
        window.setTimeout(() => window.URL.revokeObjectURL(url), 10_000);
        return true;
      } catch {
        toast.error(t(retry ? "actions.downloadError" : "actions.downloadErrorOpen"), {
          id: `download:${fileUrl}`,
          action: retry
            ? { label: t("actions.retry"), onClick: retry }
            : { label: t("actions.openFile"), onClick: () => window.open(fileUrl, "_blank", "noopener,noreferrer") },
        });
        return false;
      }
    },
    [t],
  );

  return { download };
}

/**
 * Auto-refresh processing videos
 */
export function useRefreshProcessingVideos(
  videos: Array<{ status?: string }>,
  refetch: () => void,
  interval = 5000
) {
  const hasProcessing = videos.some((v) => {
    const status = (v.status || "").toLowerCase();
    return status === "generating" || status === "uploading" || status === "pending";
  });

  useEffect(() => {
    if (!hasProcessing) return;

    const timer = setInterval(() => {
      refetch();
    }, interval);

    return () => clearInterval(timer);
  }, [hasProcessing, interval, refetch]);
}
