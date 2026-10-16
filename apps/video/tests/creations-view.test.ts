import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIEW_MODE,
  STATUS_TABS,
  VIEW_MODE_STORAGE_KEY,
  formatCreatedAt,
  matchesTab,
  modelLabel,
  readViewMode,
  statusTag,
  tabToFilterStatus,
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
    expect(modelLabel("wan-2.6")).toBe("Wan 2.6");
    expect(modelLabel("veo-3.1")).toBe("Veo 3.1");
    expect(modelLabel("sora-2")).toBe("Sora 2");
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
