import { beforeEach, describe, expect, it, vi } from "vitest";

const { selectMock, updateMock } = vi.hoisted(() => ({
  selectMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock("@/db", () => ({
  db: { select: selectMock, update: updateMock },
}));
vi.mock("@/lib/storage", () => ({
  signMediaRef: (ref: string | null) => ref,
}));
vi.mock("@/config/credits", () => ({
  getAvailableModels: async () => [],
}));

import { ApiError } from "@/lib/api/error";
import { galleryService } from "@/services/gallery";

/**
 * Minimal Drizzle-like builder: every chainable method returns itself and the
 * terminal awaited call (`limit`, or `then`) resolves/rejects with the promise
 * configured for the test.
 */
function makeChain(result: Promise<unknown>) {
  const chain: Record<string, unknown> = {};
  const passthrough = () => chain;

  chain.select = passthrough;
  chain.from = passthrough;
  chain.innerJoin = passthrough;
  chain.where = passthrough;
  chain.orderBy = passthrough;
  chain.limit = () => result;
  // biome-ignore lint/suspicious/noThenProperty: mocks the thenable drizzle query builder
  chain.then = (resolve: unknown, reject: unknown) =>
    result.then(
      resolve as (value: unknown) => unknown,
      reject as (reason: unknown) => unknown
    );

  return chain;
}

describe("GalleryService.listPublic", () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
  });

  it("returns an empty page when migration 0003 is not applied", async () => {
    selectMock.mockReturnValue(makeChain(Promise.reject({ code: "42703" })));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(galleryService.listPublic({})).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(warn).toHaveBeenCalledWith(
      "[gallery] schema not migrated (0003_gallery.sql); returning empty list"
    );

    warn.mockRestore();
  });

  it("returns an empty page when there are no published works", async () => {
    selectMock.mockReturnValue(makeChain(Promise.resolve([])));

    await expect(galleryService.listPublic({})).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("rethrows unrelated errors", async () => {
    const boom = new Error("connection refused");
    selectMock.mockReturnValue(makeChain(Promise.reject(boom)));

    await expect(galleryService.listPublic({})).rejects.toBe(boom);
  });
});

describe("GalleryService.getPublic", () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
  });

  it("maps a missing-schema error to a 404", async () => {
    selectMock.mockReturnValue(makeChain(Promise.reject({ code: "42P01" })));

    await expect(galleryService.getPublic("video-1")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("still reports a genuine not-found row as a 404", async () => {
    selectMock.mockReturnValue(makeChain(Promise.resolve([])));

    await expect(galleryService.getPublic("video-1")).rejects.toBeInstanceOf(
      ApiError
    );
  });

  it("rethrows unrelated errors", async () => {
    const boom = new Error("connection refused");
    selectMock.mockReturnValue(makeChain(Promise.reject(boom)));

    await expect(galleryService.getPublic("video-1")).rejects.toBe(boom);
  });
});

describe("GalleryService.getTemplate", () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
  });

  it("maps a missing-schema error to a 404", async () => {
    selectMock.mockReturnValue(makeChain(Promise.reject({ code: "42703" })));

    await expect(galleryService.getTemplate("video-1")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("GalleryService.publish authorization", () => {
  beforeEach(() => {
    selectMock.mockReset();
    updateMock.mockReset();
  });

  it("rejects a protected-prompt request from a regular account", async () => {
    selectMock
      .mockReturnValueOnce(
        makeChain(
          Promise.resolve([
            {
              uuid: "video-1",
              userId: "user-1",
              prompt: "private original",
              status: "COMPLETED",
              videoUrl: "videos/video-1.mp4",
              visibility: "private",
              isDeleted: false,
            },
          ])
        )
      )
      .mockReturnValueOnce(
        makeChain(Promise.resolve([{ isSuperAccount: false }]))
      );

    await expect(
      galleryService.publish("user-1", "video-1", {
        title: "Protected work",
        protectPrompt: true,
        publicPrompt: "public version",
      })
    ).rejects.toMatchObject({ status: 403 });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
