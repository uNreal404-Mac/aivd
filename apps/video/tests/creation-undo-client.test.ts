import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InfiniteData } from "@tanstack/react-query";
import type { ListVideosResponse, Video } from "@/lib/types/dashboard";

type Target = {
  uuid: string;
  description: string;
  filter?: { mediaType?: string };
  undoToken?: string;
};
type Click = { preventDefault(): void };
type Toast = {
  id: string;
  message: string;
  description?: string;
  action?: { label: string; onClick(event: Click): void };
};
type Mutation = {
  mutationFn: (input: Target) => Promise<unknown>;
  onMutate?: (input: Target) => Promise<unknown> | unknown;
  onSuccess?: (result: unknown, input: Target, ctx: unknown) => void;
  onError?: (error: unknown, input: Target, ctx: unknown) => void;
};
const harness = vi.hoisted(() => ({
  toasts: new Map<string, Toast>(),
  cache: new Map<string, InfiniteData<ListVideosResponse>>(),
  invalidate: vi.fn(),
}));
vi.mock("react", async (orig) => ({
  ...(await orig<typeof import("react")>()),
  useCallback: (fn: unknown) => fn,
}));
vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("sonner", () => {
  // Sonner merges updates that reuse an id, including any previous action.
  const record = (message: string, opts: Toast) =>
    harness.toasts.set(opts.id, {
      ...harness.toasts.get(opts.id),
      ...opts,
      message,
    });
  return { toast: { success: record, error: record, loading: record } };
});
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    cancelQueries: async () => {},
    invalidateQueries: harness.invalidate,
    getQueryData: (key: unknown) => harness.cache.get(JSON.stringify(key)),
    setQueryData: (
      key: unknown,
      update: (
        old: InfiniteData<ListVideosResponse>,
      ) => InfiniteData<ListVideosResponse>,
    ) => {
      const id = JSON.stringify(key);
      harness.cache.set(id, update(harness.cache.get(id)!));
    },
  }),
  useInfiniteQuery: ({ queryKey }: { queryKey: unknown }) => ({
    data: harness.cache.get(JSON.stringify(queryKey)),
  }),
  useMutationState: () => [],
  useMutation: (options: Mutation) => {
    const mutateAsync = async (input: Target) => {
      const context = await options.onMutate?.(input);
      try {
        const data = await options.mutationFn(input);
        options.onSuccess?.(data, input, context);
        return data;
      } catch (error) {
        options.onError?.(error, input, context);
        throw error;
      }
    };
    return {
      mutateAsync,
      mutate: (input: Target) => {
        void mutateAsync(input).catch(() => {});
      },
    };
  },
}));
import { useVideos } from "@/hooks/use-videos";

const filter = { mediaType: "image" } as const;
const query = JSON.stringify(["videos", filter]);
const token = "d29106ea-4ead-48df-b5c3-443efb51aa82";
const call = vi.fn<typeof fetch>();
function result(data: unknown, status = 200) {
  return new Response(
    JSON.stringify(
      status === 200
        ? { success: true, data }
        : { success: false, error: { message: "failure" } },
    ),
    { status },
  );
}
function click(action: Toast["action"]) {
  const event = { preventDefault: vi.fn() };
  expect(action).toBeDefined();
  action!.onClick(event);
  // Without this, Sonner immediately dismisses a freshly updated error toast.
  expect(event.preventDefault).toHaveBeenCalled();
}
const message = (uuid = "image-A") => harness.toasts.get("delete:" + uuid);
beforeEach(() => {
  harness.cache.clear();
  harness.toasts.clear();
  harness.invalidate.mockReset();
  call.mockReset();
  const videos = [
    { uuid: "image-A", prompt: "Image A" },
    { uuid: "image-B", prompt: "Image B" },
  ] as Video[];
  harness.cache.set(query, {
    pages: [{ videos, nextCursor: null, hasMore: false }],
    pageParams: [undefined],
  });
  vi.stubGlobal("fetch", call);
});
afterEach(() => vi.unstubAllGlobals());

describe("undo notifications for creations", () => {
  it("preserves the correct token on an immediate restore failure and coalesces double presses", async () => {
    call
      .mockResolvedValueOnce(result({ deleted: true, undoToken: token }))
      .mockResolvedValueOnce(result(null, 503))
      .mockResolvedValueOnce(result({ restored: true }));
    await useVideos(filter).deleteVideo("image-A");
    expect(message()?.description).toBe("Image A");
    const undo = message()?.action;
    click(undo);
    click(undo);
    await vi.waitFor(() =>
      expect(message()?.message).toBe("actions.restoreError"),
    );
    const retry = message()?.action;
    click(retry);
    click(retry);
    await vi.waitFor(() => expect(message()?.message).toBe("actions.restored"));
    expect(message()?.action).toBeUndefined();
    expect(
      call.mock.calls.map(([url, init]) => [url, init?.method, init?.body]),
    ).toEqual([
      ["/api/v1/video/image-A", "DELETE", undefined],
      [
        "/api/v1/video/image-A/restore",
        "POST",
        JSON.stringify({ undoToken: token }),
      ],
      [
        "/api/v1/video/image-A/restore",
        "POST",
        JSON.stringify({ undoToken: token }),
      ],
    ]);
  });
  it("rolls back the individual row on failure, retries the same delete and exposes no stale action for a 404 receipt", async () => {
    call
      .mockResolvedValueOnce(result(null, 503))
      .mockResolvedValueOnce(result({ deleted: true, undoToken: token }))
      .mockResolvedValueOnce(result(null, 404));
    await expect(useVideos(filter).deleteVideo("image-B")).rejects.toThrow();
    expect(
      harness.cache.get(query)?.pages[0].videos.map((v) => v.uuid),
    ).toEqual(["image-A", "image-B"]);
    expect(message("image-B")?.description).toBe("Image B");
    const retry = message("image-B")?.action;
    click(retry);
    click(retry);
    await vi.waitFor(() =>
      expect(message("image-B")?.message).toBe("actions.deleteSuccess"),
    );
    expect(
      harness.cache.get(query)?.pages[0].videos.map((v) => v.uuid),
    ).toEqual(["image-A"]);
    click(message("image-B")?.action);
    await vi.waitFor(() =>
      expect(message("image-B")?.message).toBe("actions.undoExpired"),
    );
    expect(message("image-B")?.action).toBeUndefined();
    expect(call.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["/api/v1/video/image-B", "DELETE"],
      ["/api/v1/video/image-B", "DELETE"],
      ["/api/v1/video/image-B/restore", "POST"],
    ]);
  });
});
