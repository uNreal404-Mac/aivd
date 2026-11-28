import { describe, expect, it } from "vitest";

import {
  DEFAULT_KIND,
  DEFAULT_VIEW_MODE,
  KIND_STORAGE_KEY,
  STATUS_TABS,
  VIEW_MODE_STORAGE_KEY,
  emptyStateFor,
  formatCreatedAt,
  matchesTab,
  modelLabel,
  readKind,
  readViewMode,
  regenerateHref,
  statusTag,
  tabToFilterStatus,
  writeKind,
  writeViewMode,
  type ViewModeStorage,
} from "../src/lib/creations-view";

function createFakeStorage(initial: Record<string, string> = {}): ViewModeStorage {
  const store: Record<string, string> = { ...initial };
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
}

describe("STATUS_TABS", () => {
  it("exposes the tabs in display order", () => {
    expect([...STATUS_TABS]).toEqual([
      "all",
      "queued",
      "generating",
      "done",
      "failed",
    ]);
  });
});

describe("tabToFilterStatus", () => {
  it("passes each tab through as-is", () => {
    expect(tabToFilterStatus("all")).toBe("all");
    expect(tabToFilterStatus("queued")).toBe("queued");
    expect(tabToFilterStatus("generating")).toBe("generating");
    expect(tabToFilterStatus("done")).toBe("done");
    expect(tabToFilterStatus("failed")).toBe("failed");
  });
});

describe("statusTag", () => {
  it("maps PENDING to queued", () => {
    expect(statusTag("PENDING")).toBe("queued");
  });

  it("shows UPLOADING as generating", () => {
    expect(statusTag("UPLOADING")).toBe("generating");
    expect(statusTag("GENERATING")).toBe("generating");
  });

  it("maps COMPLETED to done and FAILED to failed", () => {
    expect(statusTag("COMPLETED")).toBe("done");
    expect(statusTag("FAILED")).toBe("failed");
  });

  it("accepts lowercase statuses from the dashboard type", () => {
    expect(statusTag("pending")).toBe("queued");
    expect(statusTag("generating")).toBe("generating");
    expect(statusTag("uploading")).toBe("generating");
    expect(statusTag("completed")).toBe("done");
    expect(statusTag("failed")).toBe("failed");
  });

  it("falls back to queued for unknown values", () => {
    expect(statusTag("SOMETHING_ELSE")).toBe("queued");
    expect(statusTag("")).toBe("queued");
  });
});

describe("matchesTab", () => {
  it("matches every video for the all tab", () => {
    expect(matchesTab("completed", "all")).toBe(true);
    expect(matchesTab("pending", "all")).toBe(true);
    expect(matchesTab("", "all")).toBe(true);
  });

  it("matches by normalized status tag", () => {
    expect(matchesTab("GENERATING", "generating")).toBe(true);
    expect(matchesTab("generating", "generating")).toBe(true);
    expect(matchesTab("uploading", "generating")).toBe(true);
    expect(matchesTab("UPLOADING", "generating")).toBe(true);
    expect(matchesTab("PENDING", "queued")).toBe(true);
    expect(matchesTab("completed", "done")).toBe(true);
    expect(matchesTab("FAILED", "failed")).toBe(true);
  });

  it("rejects statuses belonging to other tabs", () => {
    expect(matchesTab("completed", "failed")).toBe(false);
    expect(matchesTab("failed", "done")).toBe(false);
    expect(matchesTab("pending", "generating")).toBe(false);
  });
});

describe("formatCreatedAt", () => {
  it("formats a date with medium date and short time", () => {
    const value = formatCreatedAt(
      new Date(Date.UTC(2024, 0, 15, 10, 30)),
      "en-US",
    );
    expect(value).toContain("2024");
    expect(value.length).toBeGreaterThan(0);
  });

  it("accepts ISO strings and timestamps", () => {
    expect(formatCreatedAt("2024-01-15T10:30:00.000Z", "en-US")).toContain("2024");
    expect(formatCreatedAt(Date.UTC(2024, 0, 15, 10, 30), "en-US")).toContain("2024");
  });

  it("respects the locale", () => {
    const date = new Date(Date.UTC(2024, 0, 15, 10, 30));
    expect(formatCreatedAt(date, "en-US")).not.toBe(formatCreatedAt(date, "zh-CN"));
  });

  it("returns an empty string for invalid input", () => {
    expect(formatCreatedAt("not-a-date", "en-US")).toBe("");
    expect(formatCreatedAt(new Date(Number.NaN), "en-US")).toBe("");
  });
});

describe("modelLabel", () => {
  it("maps known model ids to display names", () => {
    expect(modelLabel("seedance-1.5-pro")).toBe("Seedance 1.5 Pro");
    expect(modelLabel("veo-3.1")).toBe("Veo 3.1");
    expect(modelLabel("sora-2")).toBe("Sora 2");
  });

  it("names Wan 2.6 by the id it is stored under, and the older spelling", () => {
    expect(modelLabel("wan2.6")).toBe("Wan 2.6");
    expect(modelLabel("wan-2.6")).toBe("Wan 2.6");
  });

  it("uses the studio's name for market models of every type", () => {
    expect(modelLabel("bytedance/seedance-2-5")).toBe("Seedance 2.5");
    expect(modelLabel("kling/v4-reference-to-video")).toBe("Kling 4.0");
    expect(modelLabel("seedream-5-5")).toBe("Seedream 5.5");
    expect(modelLabel("gpt-image-2-6-flare")).toBe("GPT Image 2.6 Flare");
    expect(modelLabel("elevenlabs-v3")).toBe("Eleven v3");
    expect(modelLabel("suno-music")).toBe("Suno V6");
  });

  it("falls back to the catalogue for models not on sale yet", () => {
    expect(modelLabel("bytedance/seedance-2-mini")).toBe("Seedance 2.0 Mini");
    expect(modelLabel("google/imagen4")).toBe("Imagen 4");
  });

  it("returns the raw id for unknown models", () => {
    expect(modelLabel("some-future-model")).toBe("some-future-model");
  });

  it("returns an empty string for empty input", () => {
    expect(modelLabel("")).toBe("");
  });
});

describe("readViewMode", () => {
  it("falls back to grid when storage is missing", () => {
    expect(readViewMode(null)).toBe(DEFAULT_VIEW_MODE);
    expect(readViewMode(undefined)).toBe("grid");
  });

  it("reads a persisted list mode", () => {
    expect(readViewMode(createFakeStorage({ [VIEW_MODE_STORAGE_KEY]: "list" }))).toBe(
      "list",
    );
  });

  it("reads a persisted grid mode", () => {
    expect(readViewMode(createFakeStorage({ [VIEW_MODE_STORAGE_KEY]: "grid" }))).toBe(
      "grid",
    );
  });

  it("ignores unknown stored values", () => {
    expect(
      readViewMode(createFakeStorage({ [VIEW_MODE_STORAGE_KEY]: "carousel" })),
    ).toBe("grid");
  });

  it("survives a throwing storage", () => {
    const throwing: ViewModeStorage = {
      getItem: () => {
        throw new Error("nope");
      },
      setItem: () => {
        throw new Error("nope");
      },
    };
    expect(readViewMode(throwing)).toBe("grid");
    expect(() => writeViewMode(throwing, "list")).not.toThrow();
  });
});

describe("writeViewMode", () => {
  it("persists the selected mode under du.creations.view", () => {
    const storage = createFakeStorage();
    writeViewMode(storage, "list");
    expect(storage.getItem(VIEW_MODE_STORAGE_KEY)).toBe("list");
    writeViewMode(storage, "grid");
    expect(storage.getItem(VIEW_MODE_STORAGE_KEY)).toBe("grid");
  });

  it("is a no-op without storage", () => {
    expect(() => writeViewMode(null, "list")).not.toThrow();
  });
});

describe("view mode round trip", () => {
  it("returns what was written", () => {
    const storage = createFakeStorage();
    writeViewMode(storage, "list");
    expect(readViewMode(storage)).toBe("list");
  });
});

describe("readKind / writeKind", () => {
  it("defaults to video without storage or a stored value", () => {
    expect(readKind(null)).toBe(DEFAULT_KIND);
    expect(readKind(createFakeStorage())).toBe("video");
  });

  it("remembers the last type", () => {
    const storage = createFakeStorage();
    writeKind(storage, "image");
    expect(storage.getItem(KIND_STORAGE_KEY)).toBe("image");
    expect(readKind(storage)).toBe("image");
    writeKind(storage, "audio");
    expect(readKind(storage)).toBe("audio");
  });

  it("ignores unknown stored values and a throwing storage", () => {
    expect(readKind(createFakeStorage({ [KIND_STORAGE_KEY]: "gif" }))).toBe("video");
    const throwing: ViewModeStorage = {
      getItem: () => {
        throw new Error("nope");
      },
      setItem: () => {
        throw new Error("nope");
      },
    };
    expect(readKind(throwing)).toBe("video");
    expect(() => writeKind(throwing, "image")).not.toThrow();
  });
});

describe("emptyStateFor", () => {
  it("shows cards when any match", () => {
    expect(emptyStateFor({ total: 3, visible: 1, hasMore: true })).toBe("none");
  });

  it("keeps loading while a filtered tab has more pages to search", () => {
    expect(emptyStateFor({ total: 20, visible: 0, hasMore: true })).toBe("loading");
  });

  it("says the type is empty when nothing of it exists, on any tab", () => {
    expect(emptyStateFor({ total: 0, visible: 0, hasMore: false })).toBe("kind");
  });

  it("says the filter is empty when other statuses have items", () => {
    expect(emptyStateFor({ total: 4, visible: 0, hasMore: false })).toBe("filtered");
  });
});

describe("regenerateHref", () => {
  const base = { prompt: "a fox in snow", model: "wan2.6", duration: 10, aspectRatio: "9:16" };

  function query(href: string | null): URLSearchParams {
    return new URL(href ?? "", "https://aivd.test").searchParams;
  }

  it("carries prompt, model, length and aspect to the video studio", () => {
    const href = regenerateHref(base, "video", "en");
    expect(href?.startsWith("/ai/video?")).toBe(true);
    const params = query(href);
    expect(params.get("prompt")).toBe("a fox in snow");
    expect(params.get("model")).toBe("wan2.6");
    expect(params.get("duration")).toBe("10");
    expect(params.get("aspect")).toBe("9:16");
  });

  it("leaves out a missing length or aspect", () => {
    const params = query(regenerateHref({ ...base, duration: 0, aspectRatio: "" }, "video", "en"));
    expect(params.has("duration")).toBe(false);
    expect(params.has("aspect")).toBe(false);
  });

  it("sends images to the image studio without a length", () => {
    const href = regenerateHref({ ...base, model: "seedream-5-5", aspectRatio: "1:1" }, "image", "zh");
    expect(href?.startsWith("/zh/ai/image?")).toBe(true);
    const params = query(href);
    expect(params.get("aspect")).toBe("1:1");
    expect(params.has("duration")).toBe(false);
  });

  it("opens the audio studio on the same model with the same script", () => {
    const href = regenerateHref({ ...base, model: "elevenlabs-v3" }, "audio", "en");
    expect(href?.startsWith("/audio?")).toBe(true);
    const params = query(href);
    expect(params.get("audioModel")).toBe("elevenlabs-v3");
    expect(params.get("prompt")).toBe(base.prompt);
  });

  it("returns null without a prompt", () => {
    expect(regenerateHref({ ...base, prompt: "  " }, "video", "en")).toBeNull();
  });

  it("returns null for video tool models so creations never fall back to create mode", () => {
    expect(regenerateHref({ ...base, model: "kling-3.0-omni/transformation" }, "video", "zh")).toBeNull();
    expect(regenerateHref({ ...base, model: "kling-3.0/motion-control" }, "video", "en")).toBeNull();
    expect(regenerateHref({ ...base, model: "pixverse-v6/extend" }, "video", "en")).toBeNull();
  });
});
