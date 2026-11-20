import { beforeEach, describe, expect, it, vi } from "vitest";
import { nanoid } from "nanoid";

// ---------------------------------------------------------------------------
// Mocks (same approach as video-generate.test.ts: real local D1, fake provider)
// ---------------------------------------------------------------------------

const fakeProvider = {
  name: "evolink",
  supportImageToVideo: true,
  createTask: vi.fn(),
  getTaskStatus: vi.fn(),
  parseCallback: vi.fn(),
};

vi.mock("@/ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai")>();
  return { ...actual, getProvider: vi.fn(() => fakeProvider) };
});

const createMarketTask = vi.hoisted(() => vi.fn());
vi.mock("@/ai/kie-market", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/ai/kie-market")>();
  return { ...actual, createMarketTask };
});

vi.mock("@/lib/video-events", () => ({ emitVideoEvent: vi.fn() }));

import { marketModelsOf } from "@/ai/kie-market";
import { getModelConfig } from "@/config/credits";
import { PLAN_PERKS, SUBSCRIPTION_PRODUCTS, type PlanTier } from "@/config/pricing-user";
import { CreditTransType, VideoStatus, db, videos } from "@/db";
import { ApiError } from "@/lib/api/error";
import {
  ACTIVE_GENERATION_WINDOW_MS,
  concurrencyLimitFor,
  countActiveGenerations,
  getUserPlanTier,
  planTierOfGrant,
} from "@/lib/plan-limits";
import { errorMessage } from "@/lib/media-studio";
import { creditService } from "@/services/credit";
import { videoService, type GenerateVideoParams } from "@/services/video";
import { getBalance, giveCredits, uniqueOrderNo, uniqueUserId } from "./helpers";

const MODEL = ["wan2.6", "veo-3.1"].find((id) => getModelConfig(id)?.enabled !== false)!;
const MARKET_VIDEO = marketModelsOf("video").find((model) => !model.options.requiresImage)!;
const MARKET_IMAGE = marketModelsOf("image").find((model) => !model.options.requiresImage)!;

function baseParams(userId: string): GenerateVideoParams {
  return {
    userId,
    prompt: "a cat riding a skateboard",
    model: MODEL,
    duration: getModelConfig(MODEL)?.durations[0] ?? 5,
    aspectRatio: "16:9",
  };
}

/** Grant subscription credits the way the Stripe webhook does. */
async function subscribe(userId: string, productName: string, expiryDays = 30) {
  const product = SUBSCRIPTION_PRODUCTS.find((item) => item.name === productName)!;
  const orderNo = uniqueOrderNo("stripe");
  await creditService.recharge({
    userId,
    credits: product.credits,
    orderNo,
    transType: CreditTransType.SUBSCRIPTION,
    expiryDays,
    remark: `Stripe payment: ${product.name}`,
  });
  return orderNo;
}

async function insertRow(
  userId: string,
  overrides: Partial<typeof videos.$inferInsert> = {},
) {
  await db.insert(videos).values({
    uuid: `vid_${nanoid(21)}`,
    userId,
    prompt: "seed",
    model: MODEL,
    status: VideoStatus.GENERATING,
    ...overrides,
  });
}

async function limitError(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

beforeEach(() => {
  Reflect.deleteProperty(process.env, "DEFAULT_AI_PROVIDER");
  process.env.KIE_API_KEY = "test-key";
  fakeProvider.createTask.mockReset();
  fakeProvider.createTask.mockImplementation(async () => ({ taskId: `task_${nanoid(8)}`, status: "pending" }));
  createMarketTask.mockReset();
  createMarketTask.mockImplementation(async () => `task_${nanoid(8)}`);
});

describe("concurrencyLimitFor", () => {
  it("reads each tier's limit from the pricing config", () => {
    for (const tier of ["free", "basic", "pro", "ultimate"] as PlanTier[]) {
      expect(concurrencyLimitFor(tier)).toBe(PLAN_PERKS[tier].concurrency);
    }
    expect(concurrencyLimitFor("pro")).toBeGreaterThan(concurrencyLimitFor("basic"));
    expect(concurrencyLimitFor("ultimate")).toBeGreaterThan(concurrencyLimitFor("pro"));
  });
});

describe("planTierOfGrant", () => {
  it("maps every subscription product, by remark or by credit amount", () => {
    for (const product of SUBSCRIPTION_PRODUCTS) {
      const expected = product.name.toLowerCase().split(" ")[0];
      expect(planTierOfGrant({ remark: `Stripe payment: ${product.name}` })).toBe(expected);
      expect(planTierOfGrant({ remark: `Creem payment: ${product.id}` })).toBe(expected);
      expect(planTierOfGrant({ remark: null, initialCredits: product.credits })).toBe(expected);
    }
  });

  it("falls back to basic for a subscription it cannot identify", () => {
    expect(planTierOfGrant({ remark: "Recharge: order_1", initialCredits: 7 })).toBe("basic");
  });
});

describe("getUserPlanTier", () => {
  it("is free without a subscription grant, including after a one-time pack", async () => {
    const userId = uniqueUserId();
    expect(await getUserPlanTier(userId)).toBe("free");
    await giveCredits(userId, 3300);
    expect(await getUserPlanTier(userId)).toBe("free");
  });

  it("follows the subscription product and takes the highest live one", async () => {
    const userId = uniqueUserId();
    await subscribe(userId, "Basic Plan");
    expect(await getUserPlanTier(userId)).toBe("basic");
    await subscribe(userId, "Ultimate Plan (Yearly)", 365);
    expect(await getUserPlanTier(userId)).toBe("ultimate");
    await subscribe(userId, "Pro Plan");
    expect(await getUserPlanTier(userId)).toBe("ultimate");
  });

  it("drops back to free once the grant has expired or was refunded", async () => {
    const expired = uniqueUserId();
    await subscribe(expired, "Pro Plan");
    expect(await getUserPlanTier(expired, new Date(Date.now() + 31 * 24 * 60 * 60 * 1000))).toBe("free");

    const refunded = uniqueUserId();
    const orderNo = await subscribe(refunded, "Pro Plan");
    await creditService.revokeForOrder({ orderNo, revokeOrderNo: uniqueOrderNo("refund"), ratio: 1 });
    expect(await getUserPlanTier(refunded)).toBe("free");
  });
});

describe("countActiveGenerations", () => {
  it("counts in-progress videos only", async () => {
    const userId = uniqueUserId();
    await insertRow(userId, { status: VideoStatus.PENDING });
    await insertRow(userId, { status: VideoStatus.GENERATING });
    await insertRow(userId, { status: VideoStatus.UPLOADING });
    await insertRow(userId, { status: VideoStatus.COMPLETED });
    await insertRow(userId, { status: VideoStatus.FAILED });
    await insertRow(userId, { mediaType: "image" });
    await insertRow(userId, { mediaType: "audio" });
    await insertRow(uniqueUserId());
    expect(await countActiveGenerations(userId)).toBe(3);
  });

  it("stops counting a row that has been in progress past the window", async () => {
    const userId = uniqueUserId();
    await insertRow(userId, { createdAt: new Date(Date.now() - ACTIVE_GENERATION_WINDOW_MS - 60_000) });
    expect(await countActiveGenerations(userId)).toBe(0);
  });
});

describe("generate(): concurrency limit", () => {
  it("rejects a free account's second video with 429 and freezes nothing", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 5000);
    await videoService.generate(baseParams(userId));
    const before = await getBalance(userId);
    fakeProvider.createTask.mockClear();

    const error = await limitError(videoService.generate(baseParams(userId)));
    expect(error.status).toBe(429);
    expect(error.details).toEqual({ code: "CONCURRENCY_LIMIT", limit: 1, tier: "free" });
    expect(fakeProvider.createTask).not.toHaveBeenCalled();
    expect(await getBalance(userId)).toEqual(before);
    expect(await countActiveGenerations(userId)).toBe(1);
  });

  it("lets the next one through once the running video has finished", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 5000);
    await insertRow(userId, { status: VideoStatus.COMPLETED });
    await insertRow(userId, { status: VideoStatus.FAILED });
    const result = await videoService.generate(baseParams(userId));
    expect(result.status).toBe("GENERATING");
  });

  it("returns the existing job for a retried idempotency key instead of 429", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 5000);
    const params = { ...baseParams(userId), idempotencyKey: `key_${nanoid(8)}` };
    const first = await videoService.generate(params);
    const again = await videoService.generate(params);
    expect(again.videoUuid).toBe(first.videoUuid);
  });

  it("allows three at once on Pro and six on Ultimate", async () => {
    for (const [productName, tier, limit] of [
      ["Pro Plan", "pro", 3],
      ["Ultimate Plan", "ultimate", 6],
    ] as const) {
      const userId = uniqueUserId();
      await subscribe(userId, productName);
      await giveCredits(userId, 50_000);
      for (let index = 0; index < limit; index++) {
        await videoService.generate(baseParams(userId));
      }
      const error = await limitError(videoService.generate(baseParams(userId)));
      expect(error.status).toBe(429);
      expect(error.details).toEqual({ code: "CONCURRENCY_LIMIT", limit, tier });
    }
  });
});

describe("generateMedia(): concurrency limit", () => {
  it("applies the limit to market video models", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 50_000);
    await insertRow(userId);

    const error = await limitError(
      videoService.generate({ userId, prompt: "a cat surfing", model: MARKET_VIDEO.id }),
    );
    expect(error.status).toBe(429);
    expect(error.details).toEqual({ code: "CONCURRENCY_LIMIT", limit: 1, tier: "free" });
    expect(createMarketTask).not.toHaveBeenCalled();
  });

  it("does not limit images, and images do not use up a video slot", async () => {
    const userId = uniqueUserId();
    await giveCredits(userId, 50_000);
    await insertRow(userId);

    await videoService.generateMedia({ userId, model: MARKET_IMAGE.id, prompt: "a cat" });
    await videoService.generateMedia({ userId, model: MARKET_IMAGE.id, prompt: "a dog" });
    expect(createMarketTask).toHaveBeenCalledTimes(2);
    expect(await countActiveGenerations(userId)).toBe(1);
  });
});

describe("errorMessage: CONCURRENCY_LIMIT", () => {
  const server = "You already have 3 videos generating. Wait for one to finish, or upgrade for more at once.";

  it("shows the server's sentence in English and the limit in Chinese", () => {
    expect(errorMessage("CONCURRENCY_LIMIT", server, false)).toBe(server);
    expect(errorMessage("CONCURRENCY_LIMIT", server, true)).toContain("你已有 3 个视频正在生成");
  });

  it("still reads sensibly without a server message", () => {
    expect(errorMessage("CONCURRENCY_LIMIT", "", false)).toMatch(/upgrade/);
    expect(errorMessage("CONCURRENCY_LIMIT", "", true)).toContain("升级套餐");
  });
});
