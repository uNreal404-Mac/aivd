/**
 * Persistence for in-flight and recent image-to-video tasks.
 *
 * Rows are stored per user under `videofly_video_tasks:<userId | anon>` and
 * expire after 24 h. Everything here is defensive: corrupted JSON, non-array
 * payloads and storage quota failures must never throw to the caller.
 */

export type QueuePhase =
  | "queued"
  | "generating"
  | "completed"
  | "failed"
  | "stalled";

export interface VideoTask {
  userId?: string;
  videoId: string;
  taskId?: string;
  prompt?: string;
  model?: string;
  mode?: string;
  status: "pending" | "generating" | "completed" | "failed";
  createdAt: number;
  notified?: boolean;
  duration?: number;
  aspectRatio?: string;
  imageKey?: string;
  fingerprint?: string;
  phase?: QueuePhase;
  serverStatus?: string;
  startedAt?: number;
  finishedAt?: number;
  videoUrl?: string | null;
  errorMessage?: string | null;
  creditsRefunded?: boolean;
}

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY_PREFIX = "videofly_video_tasks";
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function defaultGetStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isTaskLike(value: unknown): value is VideoTask {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { videoId?: unknown }).videoId === "string"
  );
}

function normalizeRow(task: VideoTask): VideoTask {
  return {
    ...task,
    createdAt: typeof task.createdAt === "number" ? task.createdAt : 0,
  };
}

export class VideoTaskStorage {
  private readonly getStorage: () => StorageLike | null;

  constructor(getStorage?: () => StorageLike | null) {
    this.getStorage = getStorage ?? defaultGetStorage;
  }

  private getStorageKey(userId?: string): string {
    return `${STORAGE_KEY_PREFIX}:${userId ?? "anon"}`;
  }

  private safeStorage(): StorageLike | null {
    try {
      return this.getStorage();
    } catch {
      return null;
    }
  }

  private getAllTasks(userId?: string): VideoTask[] {
    const storage = this.safeStorage();
    if (!storage) {
      return [];
    }

    let raw: string | null = null;
    try {
      raw = storage.getItem(this.getStorageKey(userId));
    } catch {
      return [];
    }

    if (!raw) {
      return [];
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter(isTaskLike).map(normalizeRow);
    } catch {
      return [];
    }
  }

  private saveTasks(tasks: VideoTask[], userId?: string): void {
    const storage = this.safeStorage();
    if (!storage) {
      return;
    }
    try {
      storage.setItem(this.getStorageKey(userId), JSON.stringify(tasks));
    } catch {
      // Quota exceeded / storage disabled — keep the UI working regardless.
    }
  }

  addTask(task: VideoTask): void {
    const tasks = this.getAllTasks(task.userId);
    const exists = tasks.find((t) => t.videoId === task.videoId);
    if (!exists) {
      tasks.push(task);
    }
    this.saveTasks(tasks, task.userId);
  }

  upsertTask(task: VideoTask): void {
    const tasks = this.getAllTasks(task.userId);
    const index = tasks.findIndex((t) => t.videoId === task.videoId);
    if (index === -1) {
      tasks.push(task);
    } else {
      tasks[index] = { ...tasks[index], ...task };
    }
    this.saveTasks(tasks, task.userId);
  }

  updateTask(
    videoId: string,
    updates: Partial<VideoTask>,
    userId?: string,
  ): void {
    const tasks = this.getAllTasks(userId);
    const index = tasks.findIndex((t) => t.videoId === videoId);
    if (index !== -1) {
      const merged: VideoTask = { ...tasks[index], ...updates };
      // Legacy callers (tool-page-layout) only send `status`; keep `phase`
      // in sync so the queue never shows a finished task as running.
      if (updates.status && !updates.phase && tasks[index].phase) {
        merged.phase = taskPhase({ status: updates.status });
      }
      tasks[index] = merged;
      this.saveTasks(tasks, userId);
    }
  }

  removeTask(videoId: string, userId?: string): void {
    const tasks = this.getAllTasks(userId).filter((t) => t.videoId !== videoId);
    this.saveTasks(tasks, userId);
  }

  /** All tasks for a user, newest first by `createdAt`. */
  getTasks(userId?: string): VideoTask[] {
    return [...this.getAllTasks(userId)].sort(
      (a, b) => b.createdAt - a.createdAt,
    );
  }

  getTask(videoId: string, userId?: string): VideoTask | null {
    return (
      this.getAllTasks(userId).find((t) => t.videoId === videoId) ?? null
    );
  }

  getGeneratingTasks(userId?: string): VideoTask[] {
    return this.getAllTasks(userId).filter((t) =>
      isActivePhase(taskPhase(t)),
    );
  }

  clearExpiredTasks(userId?: string): void {
    const now = Date.now();
    const tasks = this.getAllTasks(userId).filter(
      (t) => now - t.createdAt < EXPIRY_MS,
    );
    this.saveTasks(tasks, userId);
  }

  /**
   * Keeps at most `max` rows, dropping the OLDEST terminal tasks first.
   * Active (queued / generating) tasks are never dropped.
   */
  prune(userId?: string, max = 20): void {
    const tasks = this.getAllTasks(userId);
    const overflow = tasks.length - max;
    if (overflow <= 0) {
      return;
    }

    const active = tasks.filter((t) => isActivePhase(taskPhase(t)));
    const terminal = tasks
      .filter((t) => !isActivePhase(taskPhase(t)))
      .sort((a, b) => a.createdAt - b.createdAt);

    const keptTerminal = terminal.slice(
      Math.min(overflow, terminal.length),
    );
    const keepIds = new Set(
      [...active, ...keptTerminal].map((t) => t.videoId),
    );

    this.saveTasks(
      tasks.filter((t) => keepIds.has(t.videoId)),
      userId,
    );
  }
}

export const videoTaskStorage = new VideoTaskStorage();

/* -------------------------------------------------------------------------- */
/* Pure helpers                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Measured wall-clock timings. The only measurement we have today is
 * Seedance 1.5 Pro, 4 s clip ≈ 35 s wall-clock, measured on the preview
 * environment on 2026-10-20. Do not invent numbers for other models.
 */
export const MEASURED_GENERATION_SECONDS: Readonly<
  Record<string, { clipSeconds: number; wallSeconds: number }>
> = {
  "seedance-1.5-pro": { clipSeconds: 4, wallSeconds: 35 },
};

/** Estimated wall-clock seconds for a clip, or null when unmeasured. */
export function estimateGenerationSeconds(
  model?: string,
  clipSeconds?: number,
): number | null {
  if (!model) {
    return null;
  }

  const base = MEASURED_GENERATION_SECONDS[model];
  if (!base) {
    return null;
  }

  const clip =
    clipSeconds && clipSeconds > 0 ? clipSeconds : base.clipSeconds;

  return Math.round((base.wallSeconds * clip) / base.clipSeconds);
}

/** Maps legacy rows (no `phase`) onto the queue vocabulary. */
export function taskPhase(
  task: Pick<VideoTask, "status" | "phase">,
): QueuePhase {
  if (task.phase) {
    return task.phase;
  }
  return task.status === "pending" ? "queued" : task.status;
}

export function isActivePhase(phase: QueuePhase): boolean {
  return phase === "queued" || phase === "generating";
}

/**
 * Rough, always-labelled-as-estimated progress for the generating phase.
 * Percentages are capped at 95 % so a job past its estimate never looks done
 * before the server says so.
 */
export function estimateProgress(
  task: Pick<
    VideoTask,
    "phase" | "model" | "duration" | "createdAt" | "startedAt"
  >,
  now: number,
): { percent: number | null; remainingSeconds: number | null; overdue: boolean } {
  const phase = task.phase ?? "queued";

  if (phase === "completed") {
    return { percent: 100, remainingSeconds: 0, overdue: false };
  }

  if (phase === "failed" || phase === "stalled") {
    return { percent: null, remainingSeconds: null, overdue: false };
  }

  const estimate = estimateGenerationSeconds(task.model, task.duration);

  if (phase === "queued") {
    return { percent: 0, remainingSeconds: estimate, overdue: false };
  }

  if (estimate === null) {
    return { percent: null, remainingSeconds: null, overdue: false };
  }

  const startedAt = task.startedAt ?? task.createdAt;
  const elapsed = Math.max(0, (now - startedAt) / 1000);
  const percent = Math.min(
    95,
    Math.max(1, Math.floor((elapsed / estimate) * 100)),
  );
  const remainingSeconds = Math.max(0, Math.ceil(estimate - elapsed));

  return { percent, remainingSeconds, overdue: elapsed >= estimate };
}
