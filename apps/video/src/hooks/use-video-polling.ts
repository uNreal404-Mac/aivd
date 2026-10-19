import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import type { Video } from "@/db";
import { fetchJobStatus, type JobStatusResult } from "@/lib/image-to-video";
import {
  isActivePhase,
  taskPhase,
  videoTaskStorage,
  type VideoTask,
  type VideoTaskStorage,
} from "@/lib/video-task-storage";

interface UseVideoPollingOptions {
  pollInterval?: number;
  maxConsecutiveErrors?: number;
  maxBackoffMs?: number;
  onCompleted?: (video: Video) => void;
  onFailed?: (args: { videoId: string; error?: string }) => void;
}

export function useVideoPolling(options: UseVideoPollingOptions = {}) {
  const {
    pollInterval = 15000,
    maxConsecutiveErrors = 5,
    maxBackoffMs = 120000,
    onCompleted,
    onFailed,
  } = options;

  const pollingTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const pollingState = useRef<Map<string, { consecutiveErrors: number; nextDelay: number }>>(
    new Map()
  );

  const fetchVideoDetail = useCallback(async (videoId: string) => {
    const detailResponse = await fetch(`/api/v1/video/${videoId}`);
    if (!detailResponse.ok) {
      throw new Error("Failed to fetch video detail");
    }
    const detailResult = await detailResponse.json();
    return detailResult.data as Video;
  }, []);

  const stopPolling = useCallback((videoId: string) => {
    const timerId = pollingTimers.current.get(videoId);
    if (timerId) {
      clearTimeout(timerId);
      pollingTimers.current.delete(videoId);
    }
    pollingState.current.delete(videoId);
  }, []);

  const startPolling = useCallback(
    (videoId: string) => {
      if (!videoId) return;

      if (pollingState.current.has(videoId)) {
        stopPolling(videoId);
      }

      pollingState.current.set(videoId, {
        consecutiveErrors: 0,
        nextDelay: pollInterval,
      });

      const pollStatus = async () => {
        if (!pollingState.current.has(videoId)) return;
        try {
          const response = await fetch(`/api/v1/video/${videoId}/status`);
          if (!response.ok) {
            throw new Error("Failed to fetch video status");
          }

          const result = await response.json();
          const status = result?.data?.status;
          const error = result?.data?.error;

          if (status === "COMPLETED") {
            try {
              const video = await fetchVideoDetail(videoId);
              stopPolling(videoId);
              onCompleted?.(video);
            } catch (detailError) {
              console.error("Failed to fetch completed video:", detailError);
              stopPolling(videoId);
              onFailed?.({ videoId, error: "Failed to fetch video detail" });
            }
          } else if (status === "FAILED") {
            stopPolling(videoId);
            onFailed?.({ videoId, error });
          } else {
            const state = pollingState.current.get(videoId);
            if (state) {
              state.consecutiveErrors = 0;
              state.nextDelay = pollInterval;
            }
          }
        } catch (pollError) {
          console.error("Polling error:", pollError);
          const state = pollingState.current.get(videoId);
          if (state) {
            state.consecutiveErrors += 1;
            const backoff = Math.min(
              maxBackoffMs,
              pollInterval * 2 ** state.consecutiveErrors
            );
            state.nextDelay = backoff;
            if (state.consecutiveErrors >= maxConsecutiveErrors) {
              console.warn(`Polling stopped for ${videoId} after repeated errors`);
              stopPolling(videoId);
              return;
            }
          }
        }

        const state = pollingState.current.get(videoId);
        if (!state) return;
        const timerId = setTimeout(pollStatus, state.nextDelay);
        pollingTimers.current.set(videoId, timerId);
      };

      pollStatus();
    },
    [
      pollInterval,
      maxConsecutiveErrors,
      maxBackoffMs,
      onCompleted,
      onFailed,
      fetchVideoDetail,
      stopPolling,
    ]
  );

  const stopAllPolling = useCallback(() => {
    pollingTimers.current.forEach((timerId) => clearTimeout(timerId));
    pollingTimers.current.clear();
    pollingState.current.clear();
  }, []);

  const isPolling = useCallback((videoId: string) => {
    return pollingState.current.has(videoId);
  }, []);

  useEffect(() => {
    return () => stopAllPolling();
  }, [stopAllPolling]);

  return {
    startPolling,
    stopPolling,
    stopAllPolling,
    isPolling,
  };
}

/* -------------------------------------------------------------------------- */
/* Generation queue state machine                                             */
/* -------------------------------------------------------------------------- */

export const JOB_CAP_MS = 15 * 60 * 1000;
export const QUEUE_POLL_INTERVAL_MS = 5000;

export type QueueEvent =
  | "none"
  | "progress"
  | "completed"
  | "failed"
  | "stalled";

export type FetchStatusFn = (
  videoUuid: string,
) => Promise<JobStatusResult | null>;

/**
 * Pure transition for a single task. Terminal tasks are idempotent, so replay
 * (after a refresh, or from two tabs) can never duplicate a toast.
 */
export function applyPollResult(
  task: VideoTask,
  result: JobStatusResult | null,
  now: number,
  capMs: number = JOB_CAP_MS,
): { task: VideoTask; event: QueueEvent } {
  const phase = taskPhase(task);

  if (phase === "completed" || phase === "failed" || phase === "stalled") {
    return { task, event: "none" };
  }

  const startedAt = task.startedAt ?? task.createdAt;
  const capReached = now - startedAt >= capMs;

  const stall = (base: VideoTask): { task: VideoTask; event: QueueEvent } => ({
    task: { ...base, phase: "stalled", status: "generating" },
    event: "stalled",
  });

  if (!result || typeof result.status !== "string") {
    return capReached ? stall(task) : { task, event: "none" };
  }

  const status = result.status;

  if (status === "COMPLETED") {
    return {
      task: {
        ...task,
        phase: "completed",
        status: "completed",
        serverStatus: status,
        videoUrl: result.videoUrl ?? null,
        finishedAt: now,
      },
      event: "completed",
    };
  }

  if (status === "FAILED") {
    // Every server path that writes FAILED releases the credit hold first
    // (services/video.ts tryFailGeneration / ProviderRejectedError) or never
    // created one, so "credits returned" is reported from server state.
    return {
      task: {
        ...task,
        phase: "failed",
        status: "failed",
        serverStatus: status,
        errorMessage: result.errorMessage ?? null,
        creditsRefunded: true,
        finishedAt: now,
      },
      event: "failed",
    };
  }

  const progressed: VideoTask = {
    ...task,
    phase: "generating",
    status: "generating",
    serverStatus: status,
  };

  if (capReached) {
    return stall(progressed);
  }

  return { task: progressed, event: "progress" };
}

/**
 * Polls every active, server-backed task once, in parallel. A thrown fetch is
 * treated exactly like a network failure (null result).
 */
export async function pollQueueOnce(
  tasks: VideoTask[],
  fetchStatus: FetchStatusFn,
  now: number,
  capMs: number = JOB_CAP_MS,
): Promise<Array<{ task: VideoTask; event: QueueEvent }>> {
  const pollable = tasks.filter(
    (task) =>
      isActivePhase(taskPhase(task)) &&
      typeof task.videoId === "string" &&
      !task.videoId.startsWith("local:"),
  );

  return Promise.all(
    pollable.map(async (task) => {
      let result: JobStatusResult | null = null;
      try {
        result = await fetchStatus(task.videoId);
      } catch {
        result = null;
      }
      return applyPollResult(task, result, now, capMs);
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Hook                                                                       */
/* -------------------------------------------------------------------------- */

export interface GenerationQueueOptions {
  userId: string | null;
  fetchStatus?: FetchStatusFn;
  storage?: VideoTaskStorage;
  pollIntervalMs?: number;
  capMs?: number;
  onCompleted?: (task: VideoTask) => void;
  onFailed?: (task: VideoTask) => void;
  onStalled?: (task: VideoTask) => void;
}

export interface GenerationQueueState {
  tasks: VideoTask[];
  now: number;
  enqueue: (
    draft: Omit<VideoTask, "videoId" | "status" | "createdAt" | "phase">,
  ) => string;
  attach: (localId: string, videoUuid: string) => void;
  drop: (localId: string) => void;
  dismiss: (videoId: string) => void;
  activeCount: number;
  hasActiveFingerprint: (fp: string) => boolean;
}

const DEFAULT_FETCH_STATUS: FetchStatusFn = (videoUuid) =>
  fetchJobStatus(videoUuid);

const MAX_VISIBLE_TASKS = 6;

function sortByCreatedAt(tasks: VideoTask[]): VideoTask[] {
  return [...tasks].sort((a, b) => b.createdAt - a.createdAt);
}

export function useGenerationQueue(
  options: GenerationQueueOptions,
): GenerationQueueState {
  const {
    userId,
    fetchStatus,
    storage = videoTaskStorage,
    pollIntervalMs = QUEUE_POLL_INTERVAL_MS,
    capMs = JOB_CAP_MS,
    onCompleted,
    onFailed,
    onStalled,
  } = options;

  const [localTasks, setLocalTasks] = useState<VideoTask[]>([]);
  const [storedTasks, setStoredTasks] = useState<VideoTask[]>([]);
  const [now, setNow] = useState<number>(() => Date.now());

  const mountedRef = useRef(true);
  const localTasksRef = useRef<VideoTask[]>([]);
  const storedTasksRef = useRef<VideoTask[]>([]);
  const inflightRef = useRef<Set<string>>(new Set());

  const fetchStatusRef = useRef<FetchStatusFn>(
    fetchStatus ?? DEFAULT_FETCH_STATUS,
  );
  fetchStatusRef.current = fetchStatus ?? DEFAULT_FETCH_STATUS;

  const callbacksRef = useRef({ onCompleted, onFailed, onStalled });
  callbacksRef.current = { onCompleted, onFailed, onStalled };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const commitLocal = useCallback((next: VideoTask[]) => {
    localTasksRef.current = next;
    setLocalTasks(next);
  }, []);

  const commitStored = useCallback((next: VideoTask[]) => {
    storedTasksRef.current = next;
    setStoredTasks(next);
  }, []);

  /* Restore persisted tasks (and drop stale ones) once we know the user. */
  useEffect(() => {
    if (!userId) {
      commitStored([]);
      return;
    }

    storage.clearExpiredTasks(userId);
    storage.prune(userId);
    commitStored(sortByCreatedAt(storage.getTasks(userId)));
  }, [userId, storage, commitStored]);

  const persist = useCallback(
    (task: VideoTask) => {
      storage.upsertTask({ ...task, userId: task.userId ?? userId ?? undefined });
    },
    [storage, userId],
  );

  const runPoll = useCallback(async () => {
    const due = storedTasksRef.current.filter(
      (task) =>
        isActivePhase(taskPhase(task)) &&
        !inflightRef.current.has(task.videoId),
    );

    if (due.length === 0) {
      return;
    }

    for (const task of due) {
      inflightRef.current.add(task.videoId);
    }

    let results: Array<{ task: VideoTask; event: QueueEvent }> = [];
    try {
      results = await pollQueueOnce(
        due,
        fetchStatusRef.current,
        Date.now(),
        capMs,
      );
    } finally {
      for (const task of due) {
        inflightRef.current.delete(task.videoId);
      }
    }

    if (!mountedRef.current || results.length === 0) {
      return;
    }

    const byId = new Map(
      storedTasksRef.current.map((task) => [task.videoId, task]),
    );
    const notifications: Array<{ task: VideoTask; event: QueueEvent }> = [];
    const changed: VideoTask[] = [];

    for (const { task, event } of results) {
      const existing = byId.get(task.videoId);
      if (!existing) {
        continue;
      }
      if (!isActivePhase(taskPhase(existing))) {
        // Already terminal (finished or dismissed) — never resurrect it.
        continue;
      }
      if (event === "none" && task === existing) {
        continue;
      }

      let updated: VideoTask = { ...existing, ...task };

      if (event === "completed" || event === "failed" || event === "stalled") {
        updated = { ...updated, notified: true };
        // Re-read storage so a second tab that already announced this task
        // does not toast it again.
        const persisted = storage.getTask(
          task.videoId,
          existing.userId ?? userId ?? undefined,
        );
        if (existing.notified !== true && persisted?.notified !== true) {
          notifications.push({ task: updated, event });
        }
      }

      byId.set(task.videoId, updated);
      changed.push(updated);
    }

    if (changed.length === 0) {
      return;
    }

    for (const task of changed) {
      persist(task);
    }

    commitStored(sortByCreatedAt([...byId.values()]));

    const { onCompleted: completed, onFailed: failed, onStalled: stalled } =
      callbacksRef.current;

    for (const { task, event } of notifications) {
      if (event === "completed") {
        completed?.(task);
      } else if (event === "failed") {
        failed?.(task);
      } else if (event === "stalled") {
        stalled?.(task);
      }
    }
  }, [capMs, persist, commitStored, storage, userId]);

  const enqueue = useCallback<GenerationQueueState["enqueue"]>(
    (draft) => {
      const localId = `local:${crypto.randomUUID()}`;
      const task: VideoTask = {
        ...draft,
        videoId: localId,
        status: "pending",
        phase: "queued",
        createdAt: Date.now(),
      };
      commitLocal([task, ...localTasksRef.current]);
      return localId;
    },
    [commitLocal],
  );

  const attach = useCallback(
    (localId: string, videoUuid: string) => {
      const found = localTasksRef.current.find(
        (task) => task.videoId === localId,
      );
      commitLocal(
        localTasksRef.current.filter((task) => task.videoId !== localId),
      );

      if (!found) {
        return;
      }

      const stored: VideoTask = {
        ...found,
        userId: found.userId ?? userId ?? undefined,
        videoId: videoUuid,
        status: "generating",
        phase: "generating",
        startedAt: Date.now(),
      };

      storage.upsertTask(stored);
      commitStored(
        sortByCreatedAt([
          stored,
          ...storedTasksRef.current.filter(
            (task) => task.videoId !== videoUuid,
          ),
        ]),
      );

      void runPoll();
    },
    [commitLocal, commitStored, runPoll, storage, userId],
  );

  const drop = useCallback(
    (localId: string) => {
      commitLocal(
        localTasksRef.current.filter((task) => task.videoId !== localId),
      );
      const stillStored = storedTasksRef.current.filter(
        (task) => task.videoId === localId,
      );
      if (stillStored.length > 0) {
        commitStored(
          storedTasksRef.current.filter((task) => task.videoId !== localId),
        );
        storage.removeTask(localId, userId ?? undefined);
      }
    },
    [commitLocal, commitStored, storage, userId],
  );

  const dismiss = useCallback(
    (videoId: string) => {
      commitLocal(
        localTasksRef.current.filter((task) => task.videoId !== videoId),
      );
      const target = storedTasksRef.current.find(
        (task) => task.videoId === videoId,
      );
      if (target) {
        commitStored(
          storedTasksRef.current.filter((task) => task.videoId !== videoId),
        );
        storage.removeTask(videoId, target.userId ?? userId ?? undefined);
      }
    },
    [commitLocal, commitStored, storage, userId],
  );

  const tasks = useMemo(
    () =>
      sortByCreatedAt([...localTasks, ...storedTasks]).slice(
        0,
        MAX_VISIBLE_TASKS,
      ),
    [localTasks, storedTasks],
  );

  const activeCount = useMemo(
    () =>
      [...localTasks, ...storedTasks].filter((task) =>
        isActivePhase(taskPhase(task)),
      ).length,
    [localTasks, storedTasks],
  );

  const activeStoredCount = storedTasks.filter((task) =>
    isActivePhase(taskPhase(task)),
  ).length;

  const anyActive = activeCount > 0;

  const hasActiveFingerprint = useCallback((fingerprint: string) => {
    const matches = (task: VideoTask) =>
      isActivePhase(taskPhase(task)) && task.fingerprint === fingerprint;
    return (
      localTasksRef.current.some(matches) ||
      storedTasksRef.current.some(matches)
    );
  }, []);

  /* Poll while there is something to poll; starts immediately on restore. */
  useEffect(() => {
    if (activeStoredCount === 0) {
      return;
    }
    void runPoll();
    const timer = setInterval(() => {
      void runPoll();
    }, pollIntervalMs);
    return () => clearInterval(timer);
  }, [activeStoredCount, pollIntervalMs, runPoll]);

  /* 1 s ticker for live progress / ETA, only while something is running. */
  useEffect(() => {
    if (!anyActive) {
      return;
    }
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [anyActive]);

  return {
    tasks,
    now,
    enqueue,
    attach,
    drop,
    dismiss,
    activeCount,
    hasActiveFingerprint,
  };
}

/* -------------------------------------------------------------------------- */
/* Tab title helper                                                           */
/* -------------------------------------------------------------------------- */

const DONE_PREFIX = "✓ ";

/**
 * Marks the tab title as "done" (once, no duplicate prefixes) and clears it
 * the next time the tab is actually looked at — or when the returned cleanup
 * is invoked.
 */
export function markTabDone(doc: Document = document): () => void {
  if (!doc.title.startsWith(DONE_PREFIX)) {
    doc.title = `${DONE_PREFIX}${doc.title}`;
  }

  const win = doc.defaultView;
  let finished = false;

  const cleanup = () => {
    if (finished) {
      return;
    }
    finished = true;
    if (doc.title.startsWith(DONE_PREFIX)) {
      doc.title = doc.title.slice(DONE_PREFIX.length);
    }
    doc.removeEventListener("visibilitychange", handleVisibility);
    doc.removeEventListener("pointerdown", cleanup);
    win?.removeEventListener("focus", cleanup);
    win?.removeEventListener("pointerdown", cleanup);
  };

  function handleVisibility() {
    if (doc.visibilityState === "visible") {
      cleanup();
    }
  }

  if (doc.visibilityState === "hidden") {
    doc.addEventListener("visibilitychange", handleVisibility);
    win?.addEventListener("focus", cleanup);
  } else {
    doc.addEventListener("pointerdown", cleanup, { once: true });
    win?.addEventListener("focus", cleanup, { once: true });
  }

  return cleanup;
}
