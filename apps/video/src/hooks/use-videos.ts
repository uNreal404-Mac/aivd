"use client";

// ============================================
// Video Hooks
// ============================================

import { useCallback, useEffect } from "react";
import { type InfiniteData, useInfiniteQuery, useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { apiClient, DashboardRequestError } from "@/lib/api/dashboard-client";
import type { ListVideosResponse, VideoFilterOptions } from "@/lib/types/dashboard";

type DeleteTarget = { uuid: string; description: string; filter?: VideoFilterOptions };
type RestoreTarget = DeleteTarget & { undoToken: string };
type VideoPages = InfiniteData<ListVideosResponse>;

// Sonner dismisses a toast after its action unless the event was prevented.
// The request owns its next state, including an immediate failure or a retry.
function creationAction(label: string, run: () => void) {
  let started = false;
  return {
    label,
    onClick(event: { preventDefault(): void }) {
      event.preventDefault();
      if (started) return;
      started = true;
      run();
    },
  };
}

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

  function progress(target: DeleteTarget, message: string) {
    toast.loading(message, {
      id: `delete:${target.uuid}`,
      description: target.description,
      action: undefined,
    });
  }
  const restoreMutation = useMutation({
    mutationFn: (target: RestoreTarget) => apiClient.restoreVideo(target.uuid, target.undoToken),
    onMutate: (target) => progress(target, t("actions.restoring")),
    onSuccess: (_result, target) => {
      toast.success(t("actions.restored"), {
        id: `delete:${target.uuid}`,
        description: target.description,
        action: undefined,
        duration: 4000,
      });
      void queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
    onError: (error, target) => {
      const expired = error instanceof DashboardRequestError && error.status === 404;
      toast.error(t(expired ? "actions.undoExpired" : "actions.restoreError"), {
        id: `delete:${target.uuid}`,
        description: target.description,
        duration: expired ? 5000 : 10000,
        action: expired
          ? undefined
          : creationAction(t("actions.retry"), () => restoreMutation.mutate(target)),
      });
      if (expired) void queryClient.invalidateQueries({ queryKey: ["videos"] });
    },
  });

  const deleteMutation = useMutation({
    mutationKey: DELETE_MUTATION_KEY,
    mutationFn: (target: DeleteTarget) => apiClient.deleteVideo(target.uuid),
    onMutate: async (target) => {
      const key = ["videos", target.filter] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<VideoPages>(key);
      const page =
        previous?.pages.findIndex((p) => p.videos.some((v) => v.uuid === target.uuid)) ?? -1;
      const index = previous?.pages[page]?.videos.findIndex((v) => v.uuid === target.uuid) ?? -1;
      const item = previous?.pages[page]?.videos[index];
      queryClient.setQueryData<VideoPages>(
        key,
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              videos: p.videos.filter((v) => v.uuid !== target.uuid),
            })),
          },
      );
      return { key, item, page, index };
    },
    onSuccess: (receipt, target) => {
      const undo =
        receipt?.deleted === true && typeof receipt.undoToken === "string" && receipt.undoToken
          ? creationAction(t("actions.undoDelete"), () =>
              restoreMutation.mutate({ ...target, undoToken: receipt.undoToken }),
            )
          : undefined;
      toast.success(t("actions.deleteSuccess"), {
        id: `delete:${target.uuid}`,
        description: target.description,
        duration: 10000,
        action: undo,
      });
      void queryClient.invalidateQueries({ queryKey: ["videos"], refetchType: "none" });
    },
    onError: (_error, target, context) => {
      // Restore only this row, in the query that originally contained it.
      // Switching media tabs during the request must not move it to another list.
      if (context?.item) {
        const { key, item, page, index } = context;
        queryClient.setQueryData<VideoPages>(key, (old) => {
          if (
            !old?.pages[page] ||
            old.pages.some((p) => p.videos.some((v) => v.uuid === target.uuid))
          )
            return old;
          return {
            ...old,
            pages: old.pages.map((p, i) => {
              if (i !== page) return p;
              const videos = [...p.videos];
              videos.splice(Math.min(index, videos.length), 0, item);
              return { ...p, videos };
            }),
          };
        });
      }
      toast.error(t("actions.deleteError"), {
        id: `delete:${target.uuid}`,
        description: target.description,
        duration: 10000,
        action: creationAction(t("actions.retry"), () => {
          progress(target, t("actions.deleting"));
          deleteMutation.mutate(target);
        }),
      });
    },
  });

  // Only the items being deleted, so one deletion never dims the others.
  const deletingIds = useMutationState({
    filters: { mutationKey: DELETE_MUTATION_KEY, status: "pending" },
    select: (mutation) => (mutation.state.variables as DeleteTarget).uuid,
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
      const item=videos.find(video=>video.uuid===uuid);
      const name=item?.prompt?.trim() || item?.model || uuid;
      const characters=Array.from(name);
      const description=characters.length>72 ? characters.slice(0,71).join("")+"…" : name;
      await deleteMutation.mutateAsync({uuid,description,filter});
    },
    [deleteMutation,videos,filter]
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
