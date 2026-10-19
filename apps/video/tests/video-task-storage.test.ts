import { describe, expect, it } from "vitest";

import {
  MEASURED_GENERATION_SECONDS,
  VideoTaskStorage,
  estimateGenerationSeconds,
  estimateProgress,
  isActivePhase,
  taskPhase,
  type VideoTask,
} from "@/lib/video-task-storage";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key: string): string | null => map.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      map.set(key, value);
    },
  };
}

function makeTask(overrides: Partial<VideoTask> = {}): VideoTask {
  return {
    videoId: "vid-1",
    status: "generating",
    createdAt: 1_000,
    ...overrides,
  };
}

const HOUR_MS = 60 * 60 * 1000;

describe("VideoTaskStorage", () => {
  it("adds, upserts, updates and removes tasks", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);

    storage.addTask(makeTask({ videoId: "a", status: "generating" }));
    storage.addTask(makeTask({ videoId: "a", status: "failed" }));
    expect(storage.getTasks()).toHaveLength(1);
    expect(storage.getTasks()[0].status).toBe("generating");

    storage.upsertTask(
      makeTask({
        videoId: "a",
        status: "completed",
        phase: "completed",
        videoUrl: "https://cdn.test/a.mp4",
      }),
    );
    expect(storage.getTask("a")?.status).toBe("completed");
    expect(storage.getTask("a")?.videoUrl).toBe("https://cdn.test/a.mp4");
    expect(storage.getTask("missing")).toBeNull();

    storage.updateTask("a", { notified: true });
    expect(storage.getTask("a")?.notified).toBe(true);

    storage.removeTask("a");
    expect(storage.getTasks()).toEqual([]);
  });

  it("keeps phase in sync when a legacy caller only updates status", () => {
    const mem = memoryStorage();
    const storage = new VideoTaskStorage(() => mem);
    storage.upsertTask(makeTask({ userId: "u1", phase: "generating" }));
    storage.updateTask("vid-1", { status: "completed" }, "u1");
    expect(storage.getTask("vid-1", "u1")?.phase).toBe("completed");
    expect(storage.getGeneratingTasks("u1")).toEqual([]);
  });

  it("inserts a brand new row on upsert", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);

    storage.upsertTask(makeTask({ videoId: "new", status: "pending" }));
    expect(storage.getTasks().map((task) => task.videoId)).toEqual(["new"]);
  });

  it("returns tasks newest first", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);

    storage.addTask(makeTask({ videoId: "old", createdAt: 1_000 }));
    storage.addTask(makeTask({ videoId: "new", createdAt: 3_000 }));
    storage.addTask(makeTask({ videoId: "mid", createdAt: 2_000 }));

    expect(storage.getTasks().map((task) => task.videoId)).toEqual([
      "new",
      "mid",
      "old",
    ]);
  });

  it("isolates tasks per user", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);

    storage.addTask(makeTask({ videoId: "u1-task", userId: "user-1" }));
    storage.addTask(makeTask({ videoId: "u2-task", userId: "user-2" }));

    expect(storage.getTasks("user-1").map((task) => task.videoId)).toEqual([
      "u1-task",
    ]);
    expect(storage.getTasks("user-2").map((task) => task.videoId)).toEqual([
      "u2-task",
    ]);
    expect(storage.getTasks()).toEqual([]);
  });

  it("drops rows older than 24 hours on clearExpiredTasks", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);
    const now = Date.now();

    storage.addTask(
      makeTask({ videoId: "stale", createdAt: now - 25 * HOUR_MS }),
    );
    storage.addTask(
      makeTask({ videoId: "fresh", createdAt: now - 2 * HOUR_MS }),
    );

    storage.clearExpiredTasks();

    expect(storage.getTasks().map((task) => task.videoId)).toEqual(["fresh"]);
  });

  it("tolerates corrupted JSON", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);
    memory.map.set("videofly_video_tasks:anon", "{this is not json");

    expect(storage.getTasks()).toEqual([]);
    expect(() => storage.addTask(makeTask())).not.toThrow();
  });

  it("tolerates non-array JSON", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);
    memory.map.set(
      "videofly_video_tasks:anon",
      JSON.stringify({ tasks: [] }),
    );

    expect(storage.getTasks()).toEqual([]);
    expect(storage.getGeneratingTasks()).toEqual([]);
  });

  it("never throws when storage rejects writes (quota)", () => {
    const failing = {
      getItem: (): string | null => null,
      setItem: (): void => {
        throw new Error("QuotaExceededError");
      },
    };
    const storage = new VideoTaskStorage(() => failing);

    expect(() => storage.addTask(makeTask())).not.toThrow();
    expect(() => storage.upsertTask(makeTask({ videoId: "b" }))).not.toThrow();
    expect(() => storage.prune()).not.toThrow();
  });

  it("prunes only terminal tasks beyond the limit", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);

    for (let index = 0; index < 22; index += 1) {
      storage.addTask(
        makeTask({
          videoId: `done-${index}`,
          status: "completed",
          phase: "completed",
          createdAt: index,
        }),
      );
    }

    for (let index = 0; index < 3; index += 1) {
      storage.addTask(
        makeTask({
          videoId: `active-${index}`,
          status: "generating",
          phase: "generating",
          createdAt: index,
        }),
      );
    }

    expect(storage.getTasks()).toHaveLength(25);

    storage.prune(undefined, 20);

    const remaining = storage.getTasks();
    expect(remaining).toHaveLength(20);
    for (let index = 0; index < 3; index += 1) {
      expect(
        remaining.some((task) => task.videoId === `active-${index}`),
      ).toBe(true);
    }
  });

  it("keeps active tasks even when the limit is smaller than their count", () => {
    const memory = memoryStorage();
    const storage = new VideoTaskStorage(() => memory);

    for (let index = 0; index < 5; index += 1) {
      storage.addTask(
        makeTask({
          videoId: `active-${index}`,
          status: "generating",
          phase: "generating",
          createdAt: index,
        }),
      );
    }

    storage.prune(undefined, 2);
    expect(storage.getTasks()).toHaveLength(5);
  });
});

describe("taskPhase", () => {
  it("maps legacy rows onto the queue vocabulary", () => {
    expect(taskPhase({ status: "pending" })).toBe("queued");
    expect(taskPhase({ status: "generating" })).toBe("generating");
    expect(taskPhase({ status: "completed" })).toBe("completed");
    expect(taskPhase({ status: "failed" })).toBe("failed");
  });

  it("prefers the explicit phase when present", () => {
    expect(taskPhase({ status: "generating", phase: "stalled" })).toBe(
      "stalled",
    );
  });

  it("knows which phases are active", () => {
    expect(isActivePhase("queued")).toBe(true);
    expect(isActivePhase("generating")).toBe(true);
    expect(isActivePhase("completed")).toBe(false);
    expect(isActivePhase("failed")).toBe(false);
    expect(isActivePhase("stalled")).toBe(false);
  });
});

describe("estimateGenerationSeconds", () => {
  it("scales the single measured timing", () => {
    expect(MEASURED_GENERATION_SECONDS["seedance-1.5-pro"]).toEqual({
      clipSeconds: 4,
      wallSeconds: 35,
    });
    expect(estimateGenerationSeconds("seedance-1.5-pro", 4)).toBe(35);
    expect(estimateGenerationSeconds("seedance-1.5-pro", 8)).toBe(70);
  });

  it("falls back to the measured clip length when no duration is given", () => {
    expect(estimateGenerationSeconds("seedance-1.5-pro")).toBe(35);
    expect(estimateGenerationSeconds("seedance-1.5-pro", 0)).toBe(35);
  });

  it("returns null for models without a measurement", () => {
    expect(estimateGenerationSeconds("sora-2", 10)).toBeNull();
    expect(estimateGenerationSeconds("unknown-model", 4)).toBeNull();
    expect(estimateGenerationSeconds(undefined, 4)).toBeNull();
  });
});

describe("estimateProgress", () => {
  const base = {
    model: "seedance-1.5-pro",
    duration: 4,
    createdAt: 0,
  } as const;

  it("reports a queued task as 0 % with the full estimate remaining", () => {
    expect(estimateProgress({ ...base, phase: "queued" }, 1_000)).toEqual({
      percent: 0,
      remainingSeconds: 35,
      overdue: false,
    });
  });

  it("reports mid-flight generating progress and remaining seconds", () => {
    expect(
      estimateProgress(
        { ...base, phase: "generating", startedAt: 0 },
        10_000,
      ),
    ).toEqual({
      percent: 28,
      remainingSeconds: 25,
      overdue: false,
    });
  });

  it("clamps overdue generating progress at 95 %", () => {
    expect(
      estimateProgress(
        { ...base, phase: "generating", startedAt: 0 },
        60_000,
      ),
    ).toEqual({
      percent: 95,
      remainingSeconds: 0,
      overdue: true,
    });
  });

  it("never reports less than 1 % while generating", () => {
    expect(
      estimateProgress({ ...base, phase: "generating", startedAt: 0 }, 0)
        .percent,
    ).toBe(1);
  });

  it("returns nulls for unmeasured models", () => {
    expect(
      estimateProgress(
        { phase: "generating", model: "sora-2", duration: 10, createdAt: 0 },
        5_000,
      ),
    ).toEqual({ percent: null, remainingSeconds: null, overdue: false });
  });

  it("reports completed, failed and stalled tasks", () => {
    expect(estimateProgress({ ...base, phase: "completed" }, 1_000)).toEqual({
      percent: 100,
      remainingSeconds: 0,
      overdue: false,
    });
    expect(estimateProgress({ ...base, phase: "failed" }, 1_000)).toEqual({
      percent: null,
      remainingSeconds: null,
      overdue: false,
    });
    expect(estimateProgress({ ...base, phase: "stalled" }, 1_000)).toEqual({
      percent: null,
      remainingSeconds: null,
      overdue: false,
    });
  });
});
