import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Mocks (must be declared before importing the modules under test)
// ---------------------------------------------------------------------------

const failState = vi.hoisted(() => ({
  failExternalTaskIdWrite: false,
}));

vi.mock("@/db", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/db")>();
  const wrapped = new Proxy(mod.db, {
    get(target, prop, receiver) {
      if (prop === "update" && failState.failExternalTaskIdWrite) {
        const originalUpdate = Reflect.get(target, prop, receiver) as (
          table: unknown
        ) => unknown;
        return (table: unknown) => {
          const builder = originalUpdate.call(target, table) as {
            set: (values: Record<string, unknown>) => unknown;
          };
          const originalSet = builder.set.bind(builder);
          const patched = {
            set(values: Record<string, unknown>) {
              if (values && "externalTaskId" in values) {
                return {
                  where: () => Promise.reject(new Error("db write failed")),
                };
              }
              return originalSet(values);
            },
          };
          return new Proxy(builder as object, {
            get(bTarget, bProp, bReceiver) {
              if (bProp === "set") {
                return patched.set;
              }
              return Reflect.get(bTarget, bProp, bReceiver);
            },
          });
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return {
    ...mod,
    db: wrapped,
  };
});

const fakeProvider = {
  name: "evolink",
  supportImageToVideo: true,
  createTask: vi.fn(),
  getTaskStatus: vi.fn(),
  parseCallback: vi.fn(),
};

vi.mock("@/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai")>();
  return {
    ...actual,
    getProvider: vi.fn(() => fakeProvider),
  };
});

const downloadAndUpload = vi.fn(async ({ key }: { key: string }) => ({
  url: `http://storage.test/${key}`,
  key,
}));

vi.mock("@/lib/storage", () => ({
  getStorage: vi.fn(() => ({
    downloadAndUpload,
    getSignedUrl: vi.fn((k: string) => `https://signed.test/${k}`),
  })),
  isStorageConfigured: vi.fn(() => true),
  isStorageKey: (v: string) => Boolean(v) && !/^https?:\/\//.test(v),
  signMediaRef: vi.fn((v: string | null | undefined) =>
    v ? `https://signed.test/${v}` : null
  ),
}));

vi.mock("@/lib/video-events", () => ({
  emitVideoEvent: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports under test (after mocks)
// ---------------------------------------------------------------------------

import { db, videos } from "@/db";
import { videoService, type GenerateVideoParams } from "@/services/video";
import { buildDedupeKey } from "@/services/video-dedupe";
import { ProviderRejectedError } from "@/ai/types";
import { getModelConfig, calculateModelCredits } from "@/config/credits";
import {
  countHoldsForUser,
  getBalance,
  giveCredits,
  uniqueUserId,
} from "./helpers";

// ---------------------------------------------------------------------------
// Test model selection
// ---------------------------------------------------------------------------

function pickTextToVideoModel(): string {
  const candidates = ["seedance-1.5-pro"];
  for (const id of candidates) {
    const cfg = getModelConfig(id);
    if (cfg && cfg.enabled !== false) {
      return id;
    }
  }
  throw new Error("No enabled text-to-video model found in config");
}

const MODEL = pickTextToVideoModel();
const DURATION = getModelConfig(MODEL)?.durations[0] ?? 5;
const EXPECTED_COST = calculateModelCredits(MODEL, { duration: DURATION });

function baseParams(userId: string): GenerateVideoParams {
  return {
    userId,
    prompt: "a cat riding a skateboard",
    model: MODEL,
    duration: DURATION,
    aspectRatio: "16:9",
  };
}

function paramsWithKey(
  userId: string,
  idempotencyKey: string
): GenerateVideoParams {
  return {
    ...baseParams(userId),
    idempotencyKey,
  };
}

async function countUserVideos(userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(videos)
    .where(and(eq(videos.userId, userId), eq(videos.isDeleted, false)));
  return rows.length;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("videoService.generate / duplicate suppression", () => {
  beforeEach(() => {
    Reflect.deleteProperty(process.env, "DEFAULT_AI_PROVIDER");
    failState.failExternalTaskIdWrite = false;
    fakeProvider.createTask.mockReset();
    fakeProvider.getTaskStatus.mockReset();
    fakeProvider.parseCallback.mockReset();
    downloadAndUpload.mockClear();

    fakeProvider.createTask.mockResolvedValue({
      taskId: "t_1",
      provider: "evolink",
      status: "pending",
    });
  });

  afterEach(() => {
    failState.failExternalTaskIdWrite = false;
    vi.restoreAllMocks();
  });

  it("case 1: collapses sequential identical submits into one job", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const before = await getBalance(userId);

    const [r1, r2] = await Promise.all([
      videoService.generate(paramsWithKey(userId, "key-1")),
      videoService.generate(paramsWithKey(userId, "key-2")),
    ]);

    expect(r1.videoUuid).toBe(r2.videoUuid);
    expect(fakeProvider.createTask).toHaveBeenCalledTimes(1);

    const holds = await countHoldsForUser(userId);
    expect(holds).toBe(1);

    const after = await getBalance(userId);
    expect(after.availableCredits).toBe(
      before.availableCredits - EXPECTED_COST
    );
  });

  it("case 2: a different prompt creates a second job", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const first = await videoService.generate(
      paramsWithKey(userId, "key-a")
    );
    const second = await videoService.generate({
      ...paramsWithKey(userId, "key-b"),
      prompt: "a dog surfing a wave",
    });

    expect(second.videoUuid).not.toBe(first.videoUuid);
    expect(fakeProvider.createTask).toHaveBeenCalledTimes(2);

    const rows = await countUserVideos(userId);
    expect(rows).toBe(2);
  });

  it("case 3: concurrent identical submits collapse to one row", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    const [r1, r2] = await Promise.all([
      videoService.generate(paramsWithKey(userId, "race-1")),
      videoService.generate(paramsWithKey(userId, "race-2")),
    ]);

    expect(r1.videoUuid).toBe(r2.videoUuid);
    expect(fakeProvider.createTask).toHaveBeenCalledTimes(1);

    const rows = await countUserVideos(userId);
    expect(rows).toBe(1);
  });

  it("case 4: failed jobs do not block retries", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 1000);

    fakeProvider.createTask.mockRejectedValueOnce(
      new ProviderRejectedError("invalid prompt", 400)
    );

    await expect(
      videoService.generate(paramsWithKey(userId, "fail-1"))
    ).rejects.toThrow();

    const retry = await videoService.generate(
      paramsWithKey(userId, "retry-1")
    );

    expect(fakeProvider.createTask).toHaveBeenCalledTimes(2);

    const rows = await db
      .select()
      .from(videos)
      .where(eq(videos.userId, userId));
    expect(rows.length).toBe(2);

    const failed = rows.find((row) => row.status === "FAILED");
    expect(failed).toBeDefined();

    const created = rows.find((row) => row.uuid === retry.videoUuid);
    expect(created).toBeDefined();
    expect(created?.status).not.toBe("FAILED");
  });

  it("case 5: buildDedupeKey is stable and sensitive to inputs", () => {
    const base = {
      userId: "user_1",
      model: "seedance-1.5-pro",
      mode: "image-to-video",
      prompt: "slow push in",
      duration: 5,
      aspectRatio: "16:9",
      quality: "standard",
      imageUrls: ["uploads/a.png"],
      outputNumber: 1,
      generateAudio: false,
    };

    expect(buildDedupeKey(base)).toBe(buildDedupeKey({ ...base }));

    expect(buildDedupeKey({ ...base, prompt: "slow dolly in" })).not.toBe(
      buildDedupeKey(base)
    );
    expect(buildDedupeKey({ ...base, duration: 10 })).not.toBe(
      buildDedupeKey(base)
    );
    expect(
      buildDedupeKey({ ...base, imageUrls: ["uploads/b.png"] })
    ).not.toBe(buildDedupeKey(base));
  });
});
