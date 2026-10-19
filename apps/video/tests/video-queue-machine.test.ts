import { describe, expect, it } from "vitest";

import { JOB_CAP_MS, applyPollResult, pollQueueOnce } from "@/hooks/use-video-polling";
import {
  fetchJobStatus,
  type FetchLike,
  type JobStatusResult,
} from "@/lib/image-to-video";
import {
  VideoTaskStorage,
  estimateProgress,
  type VideoTask,
} from "@/lib/video-task-storage";

interface StubResponse {
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(status: number, body: unknown): StubResponse {
  return { status, json: async () => body };
}

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
    status: "pending",
    phase: "queued",
    createdAt: 0,
    ...overrides,
  };
}

function scriptedFetch(responses: StubResponse[]): FetchLike {
  let index = 0;
  return async () => {
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return response;
  };
}

function statusFetcher(mockFetch: FetchLike) {
  return (videoUuid: string): Promise<JobStatusResult | null> =>
    fetchJobStatus(videoUuid, mockFetch);
}

describe("applyPollResult", () => {
  it("moves a queued task into generating on PENDING", () => {
    const task = makeTask();
    const { task: next, event } = applyPollResult(
      task,
      { status: "PENDING" },
      1_000,
    );

    expect(event).toBe("progress");
    expect(next.phase).toBe("generating");
    expect(next.status).toBe("generating");
    expect(next.serverStatus).toBe("PENDING");
  });

  it("moves a generating task to completed with the video url", () => {
    const task = makeTask({
      status: "generating",
      phase: "generating",
      startedAt: 0,
    });

    const { task: next, event } = applyPollResult(
      task,
      { status: "COMPLETED", videoUrl: "https://cdn.test/v.mp4" },
      5_000,
    );

    expect(event).toBe("completed");
    expect(next.phase).toBe("completed");
    expect(next.status).toBe("completed");
    expect(next.videoUrl).toBe("https://cdn.test/v.mp4");
    expect(next.finishedAt).toBe(5_000);
  });

  it("marks FAILED tasks as refunded", () => {
    const task = makeTask({ status: "generating", phase: "generating" });

    const { task: next, event } = applyPollResult(
      task,
      { status: "FAILED", errorMessage: "provider rejected the input" },
      7_000,
    );

    expect(event).toBe("failed");
    expect(next.phase).toBe("failed");
    expect(next.status).toBe("failed");
    expect(next.errorMessage).toBe("provider rejected the input");
    expect(next.creditsRefunded).toBe(true);
    expect(next.finishedAt).toBe(7_000);
  });

  it("treats unknown statuses as progress", () => {
    const task = makeTask({ status: "generating", phase: "generating" });
    const { task: next, event } = applyPollResult(
      task,
      { status: "UPLOADING" },
      2_000,
    );

    expect(event).toBe("progress");
    expect(next.phase).toBe("generating");
    expect(next.serverStatus).toBe("UPLOADING");
  });

  it("returns the task unchanged on a null result before the cap", () => {
    const task = makeTask({ status: "generating", phase: "generating" });
    const { task: next, event } = applyPollResult(task, null, 1_000);

    expect(event).toBe("none");
    expect(next).toBe(task);
  });

  it("treats a 2xx without a status like a null result", () => {
    const task = makeTask({ status: "generating", phase: "generating" });
    const { task: next, event } = applyPollResult(
      task,
      { videoUrl: null, errorMessage: null },
      1_000,
    );

    expect(event).toBe("none");
    expect(next).toBe(task);
  });

  it("stalls a job past the cap instead of failing it", () => {
    const task = makeTask({
      status: "generating",
      phase: "generating",
      createdAt: 0,
      startedAt: 0,
    });

    const { task: next, event } = applyPollResult(task, null, JOB_CAP_MS);

    expect(event).toBe("stalled");
    expect(next.phase).toBe("stalled");
    expect(next.status).toBe("generating");
    expect(next.creditsRefunded).toBeUndefined();
  });

  it("stalls a job that keeps progressing past the cap", () => {
    const task = makeTask({
      status: "generating",
      phase: "generating",
      createdAt: 0,
      startedAt: 0,
    });

    const { task: next, event } = applyPollResult(
      task,
      { status: "GENERATING" },
      JOB_CAP_MS + 1,
    );

    expect(event).toBe("stalled");
    expect(next.phase).toBe("stalled");
  });

  it("is idempotent for terminal tasks", () => {
    const completed = makeTask({
      status: "completed",
      phase: "completed",
      videoUrl: "https://cdn.test/v.mp4",
    });

    const result = applyPollResult(
      completed,
      { status: "FAILED", errorMessage: "late failure" },
      9_000,
    );

    expect(result.event).toBe("none");
    expect(result.task).toBe(completed);

    const failed = makeTask({ status: "failed", phase: "failed" });
    expect(applyPollResult(failed, null, 9_000).event).toBe("none");
  });
});

describe("pollQueueOnce", () => {
  it("follows PENDING → GENERATING → COMPLETED with a scripted fetch", async () => {
    const mockFetch = scriptedFetch([
      jsonResponse(200, { success: true, data: { status: "PENDING" } }),
      jsonResponse(200, { success: true, data: { status: "GENERATING" } }),
      jsonResponse(200, {
        success: true,
        data: {
          status: "COMPLETED",
          videoUrl: "https://cdn.test/done.mp4",
        },
      }),
    ]);
    const fetchStatus = statusFetcher(mockFetch);

    let task = makeTask({ status: "generating", phase: "generating" });

    const first = await pollQueueOnce([task], fetchStatus, 1_000);
    expect(first[0].event).toBe("progress");
    expect(first[0].task.serverStatus).toBe("PENDING");
    task = first[0].task;

    const second = await pollQueueOnce([task], fetchStatus, 2_000);
    expect(second[0].event).toBe("progress");
    expect(second[0].task.serverStatus).toBe("GENERATING");
    task = second[0].task;

    const third = await pollQueueOnce([task], fetchStatus, 3_000);
    expect(third[0].event).toBe("completed");
    expect(third[0].task.videoUrl).toBe("https://cdn.test/done.mp4");
    expect(third[0].task.phase).toBe("completed");
  });

  it("marks FAILED responses as refunded", async () => {
    const fetchStatus = statusFetcher(
      scriptedFetch([
        jsonResponse(200, {
          success: true,
          data: { status: "FAILED", errorMessage: "provider error" },
        }),
      ]),
    );

    const results = await pollQueueOnce(
      [makeTask({ status: "generating", phase: "generating" })],
      fetchStatus,
      1_000,
    );

    expect(results[0].event).toBe("failed");
    expect(results[0].task.creditsRefunded).toBe(true);
    expect(results[0].task.errorMessage).toBe("provider error");
  });

  it("leaves the task untouched on a 500", async () => {
    const fetchStatus = statusFetcher(
      scriptedFetch([jsonResponse(500, { success: false })]),
    );
    const task = makeTask({ status: "generating", phase: "generating" });

    const results = await pollQueueOnce([task], fetchStatus, 1_000);

    expect(results[0].event).toBe("none");
    expect(results[0].task).toBe(task);
  });

  it("treats a thrown fetch as a null result", async () => {
    const throwing: FetchLike = async () => {
      throw new Error("offline");
    };
    const task = makeTask({ status: "generating", phase: "generating" });

    const results = await pollQueueOnce(
      [task],
      statusFetcher(throwing),
      1_000,
    );

    expect(results[0].event).toBe("none");
    expect(results[0].task).toBe(task);
  });

  it("polls two tasks in parallel with independent results and estimates", async () => {
    const mockFetch: FetchLike = async (input: string) => {
      if (input.includes("vid-done")) {
        return jsonResponse(200, {
          success: true,
          data: { status: "COMPLETED", videoUrl: "https://cdn.test/a.mp4" },
        });
      }
      return jsonResponse(200, {
        success: true,
        data: { status: "FAILED", errorMessage: "nope" },
      });
    };

    const done = makeTask({
      videoId: "vid-done",
      status: "generating",
      phase: "generating",
      model: "seedance-1.5-pro",
      duration: 4,
      startedAt: 0,
    });
    const broken = makeTask({
      videoId: "vid-broken",
      status: "generating",
      phase: "generating",
      model: "sora-2",
      duration: 10,
      startedAt: 0,
    });

    const results = await pollQueueOnce(
      [done, broken],
      statusFetcher(mockFetch),
      10_000,
    );

    const byId = new Map(results.map((entry) => [entry.task.videoId, entry]));
    expect(byId.get("vid-done")?.event).toBe("completed");
    expect(byId.get("vid-broken")?.event).toBe("failed");

    expect(
      estimateProgress(
        { ...done, phase: "generating", startedAt: 0 },
        10_000,
      ),
    ).toEqual({ percent: 28, remainingSeconds: 25, overdue: false });
    expect(
      estimateProgress(
        { phase: "generating", model: "sora-2", duration: 10, createdAt: 0 },
        10_000,
      ),
    ).toEqual({ percent: null, remainingSeconds: null, overdue: false });
  });

  it("never polls local:* tasks", async () => {
    const calls: string[] = [];
    const mockFetch: FetchLike = async (input: string) => {
      calls.push(input);
      return jsonResponse(200, {
        success: true,
        data: { status: "COMPLETED", videoUrl: "https://cdn.test/l.mp4" },
      });
    };

    const local = makeTask({
      videoId: "local:abc",
      phase: "queued",
      status: "pending",
    });
    const remote = makeTask({
      videoId: "vid-remote",
      phase: "generating",
      status: "generating",
    });

    const results = await pollQueueOnce(
      [local, remote],
      statusFetcher(mockFetch),
      1_000,
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("vid-remote");
    expect(results).toHaveLength(1);
    expect(results[0].task.videoId).toBe("vid-remote");
  });

  it("keeps polling after a refresh with a fresh storage instance", async () => {
    const memory = memoryStorage();
    const first = new VideoTaskStorage(() => memory);

    first.upsertTask(
      makeTask({
        videoId: "vid-refresh",
        userId: "user-1",
        status: "generating",
        phase: "generating",
        startedAt: 0,
      }),
    );

    const second = new VideoTaskStorage(() => memory);
    const restored = second.getTasks("user-1");
    expect(restored).toHaveLength(1);
    expect(restored[0].videoId).toBe("vid-refresh");

    const fetchStatus = statusFetcher(
      scriptedFetch([
        jsonResponse(200, { success: true, data: { status: "GENERATING" } }),
        jsonResponse(200, {
          success: true,
          data: { status: "COMPLETED", videoUrl: "https://cdn.test/r.mp4" },
        }),
      ]),
    );

    const progress = await pollQueueOnce(restored, fetchStatus, 1_000);
    expect(progress[0].event).toBe("progress");
    second.upsertTask(progress[0].task);

    const afterProgress = new VideoTaskStorage(() => memory).getTasks("user-1");
    const done = await pollQueueOnce(afterProgress, fetchStatus, 2_000);
    expect(done[0].event).toBe("completed");
    second.upsertTask(done[0].task);

    const third = new VideoTaskStorage(() => memory);
    expect(third.getTask("vid-refresh", "user-1")?.phase).toBe("completed");
    expect(third.getTask("vid-refresh", "user-1")?.videoUrl).toBe(
      "https://cdn.test/r.mp4",
    );
  });
});
