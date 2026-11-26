import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { D1PreparedQuery } from "drizzle-orm/d1";

import { getMarketModel, imageResolution, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { POST } from "@/app/api/v1/media/generate/route";
import { CREDIT_PACKAGES, NEW_USER_GIFT, SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";
import { CreditTransType, db, users, videos } from "@/db";
import { IMAGE_FEATURED_IDS } from "@/lib/kie-model-catalog";
import { NAV_IMAGE_MODELS } from "@/lib/nav-models";
import { Storage } from "@/lib/storage";
import { creditService } from "@/services/credit";
import { VideoService, videoService } from "@/services/video";
import { countTransactions, getBalance, getHoldRow, getVideoRow, giveCredits, uniqueOrderNo, uniqueUserId } from "./helpers";

const upload = vi.hoisted(() => vi.fn(async ({ key }: { key: string; sourceUrl: string }) => ({ key, fileSize: 12 })));
const deleteFile = vi.hoisted(() => vi.fn(async (_key: string) => {}));
vi.mock("@/lib/storage", async (original) => ({
  ...await original<typeof import("@/lib/storage")>(),
  getStorage: () => ({ downloadAndUpload: upload, deleteFile, getSignedUrl: (key: string) => "https://signed.test/" + key }),
  signMediaRef: (key: string | null) => key ? "https://signed.test/" + key : null,
}));
vi.mock("@/lib/video-events", () => ({ emitVideoEvent: vi.fn() }));
const actor = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/api/auth", () => ({ requireAuth: async () => actor }));
vi.mock("@/lib/proxy-config", () => ({}));
vi.mock("@/lib/content-safety", async original => ({
  ...await original<typeof import("@/lib/content-safety")>(),
  moderateContent: async () => ({ decision: "allow" }),
}));

// Independent fixtures for the existing KIE cost schedule. Empty size means
// that KIE takes no resolution parameter. A reference surcharge is per input
// per request, including when several outputs are ordered.
interface ImageCase {
  id: string;
  defaultSize: string;
  defaultCredits: number;
  sizes: Record<string, number>;
  maxCount: number;
  maxRefs: number;
  refUsd: number;
  textModel: string;
  editModel: string;
  refField: string;
}

const cases: ImageCase[] = [
  { id: "seedream-5-5", defaultSize: "2K", defaultCredits: 9, sizes: { "1K": .018, "2K": .0315 }, maxCount: 1, maxRefs: 10, refUsd: .0072, textModel: "seedream/5-5-text-to-image", editModel: "seedream/5-5-image-to-image", refField: "image_urls" },
  ...["sunburst", "flare"].map(variant => ({
    id: "gpt-image-2-6-" + variant, defaultSize: "1K", defaultCredits: 12, sizes: { "1K": .04, "2K": .0795, "4K": .1325 },
    maxCount: 1, maxRefs: 16, refUsd: .011, textModel: `gpt-image-2-6/${variant}-text-to-image`, editModel: `gpt-image-2-6/${variant}-image-to-image`, refField: "input_urls",
  })),
  { id: "gpt-image-2", defaultSize: "1K", defaultCredits: 9, sizes: { "1K": .03, "2K": .05, "4K": .08 }, maxCount: 1, maxRefs: 16, refUsd: 0, textModel: "gpt-image-2-text-to-image", editModel: "gpt-image-2-image-to-image", refField: "input_urls" },
  { id: "nano-banana-2-1", defaultSize: "1K", defaultCredits: 6, sizes: { "1K": .02, "2K": .03, "4K": .045 }, maxCount: 1, maxRefs: 10, refUsd: 0, textModel: "nano-banana-2-1", editModel: "nano-banana-2-1", refField: "image_input" },
  { id: "nano-banana-pro", defaultSize: "1K", defaultCredits: 25, sizes: { "1K": .09, "2K": .09, "4K": .12 }, maxCount: 1, maxRefs: 8, refUsd: 0, textModel: "nano-banana-pro", editModel: "nano-banana-pro", refField: "image_input" },
  { id: "kling-image-4", defaultSize: "2K", defaultCredits: 16, sizes: { "2K": .0565, "4K": .085, "8K": .1415 }, maxCount: 9, maxRefs: 10, refUsd: .0025, textModel: "kling-4-0/image", editModel: "kling-4-0/image", refField: "image_urls" },
  { id: "minimax-h3-image", defaultSize: "2K", defaultCredits: 3, sizes: { "1K": .009, "2K": .009, "4K": .0275 }, maxCount: 1, maxRefs: 16, refUsd: .0025, textModel: "minimax-h3/text-to-image", editModel: "minimax-h3/image-edit", refField: "image_urls" },
  { id: "flux3/klein-text-to-image", defaultSize: "1K", defaultCredits: 3, sizes: { "1K": .008, "2K": .0125, "4K": .0325 }, maxCount: 4, maxRefs: 10, refUsd: 0, textModel: "flux-3/klein-text-to-image", editModel: "flux-3/klein-edit-image", refField: "image_urls" },
  { id: "grok-imagine-image-2-0/text-to-image", defaultSize: "", defaultCredits: 6, sizes: { "": .02 }, maxCount: 1, maxRefs: 5, refUsd: 0, textModel: "grok-imagine-image-2-0/text-to-image", editModel: "grok-imagine-image-2-0/image-edit", refField: "image_urls" },
];

function expectedCredits(usd: number) {
  return Math.max(2, Math.ceil((1.15 * usd + .002) / .004255892255892256 - 1e-9));
}

const urls = (count: number) => Array.from({ length: count }, (_, index) => `https://image.test/${index}.png`);

// Catalogue models connected later. Their KIE inputs differ in shape (quality
// tiers, ratio names), so each case names its own wire check.
interface ExtraCase {
  id: string;
  sizes: Record<string, number>;
  maxRefs: number;
  /** USD per reference image after the free ones. */
  refUsd: number;
  freeRefs?: number;
  textModel: string;
  editModel: string;
  wire: (input: Record<string, unknown>, size: string, aspect: string, refs: string[]) => void;
}

const sameAspect = (input: Record<string, unknown>, aspect: string) => expect(input.aspect_ratio).toBe(aspect);
const extraCases: ExtraCase[] = [
  ...(["pro", "flex"] as const).map((tier): ExtraCase => ({
    id: `flux2/${tier}-text-to-image`, sizes: tier === "pro" ? { "1K": .025, "2K": .035 } : { "1K": .07, "2K": .12 }, maxRefs: 8, refUsd: 0,
    textModel: `flux-2/${tier}-text-to-image`, editModel: `flux-2/${tier}-image-to-image`,
    wire: (input, size, aspect, refs) => { sameAspect(input, aspect); expect(input.resolution).toBe(size); expect(input.input_urls).toEqual(refs.length ? refs : undefined); },
  })),
  {
    id: "seedream/5-pro-text-to-image", sizes: { "1K": .035, "2K": .07 }, maxRefs: 10, refUsd: .0025, freeRefs: 1,
    textModel: "seedream/5-pro-text-to-image", editModel: "seedream/5-pro-image-to-image",
    wire: (input, size, aspect, refs) => { sameAspect(input, aspect); expect(input.quality).toBe(size === "2K" ? "high" : "basic"); expect(input.image_urls).toEqual(refs.length ? refs : undefined); },
  },
  {
    id: "seedream/5-flash-text-to-image", sizes: { "1K": .0162, "2K": .0162 }, maxRefs: 10, refUsd: 0,
    textModel: "seedream/5-flash-text-to-image", editModel: "seedream/5-flash-image-to-image",
    wire: (input, size, aspect, refs) => { sameAspect(input, aspect); expect(input.size).toBe(size); expect(input.image_urls).toEqual(refs.length ? refs : undefined); },
  },
  ...([["google/imagen4", .04], ["google/imagen4-fast", .02]] as const).map(([id, usd]): ExtraCase => ({
    id, sizes: { "": usd }, maxRefs: 0, refUsd: 0, textModel: id, editModel: id,
    wire: (input, _size, aspect) => sameAspect(input, aspect),
  })),
  {
    id: "ideogram/v3-text-to-image", sizes: { "": .035 }, maxRefs: 1, refUsd: 0,
    textModel: "ideogram/v3-text-to-image", editModel: "ideogram/v3-remix",
    wire: (input, _size, aspect, refs) => {
      expect(input.rendering_speed).toBe("BALANCED");
      expect(input.image_size).toBe({ "1:1": "square_hd", "4:3": "landscape_4_3", "3:4": "portrait_4_3", "16:9": "landscape_16_9", "9:16": "portrait_16_9" }[aspect]);
      expect(input.image_url).toBe(refs[0]);
    },
  },
  {
    id: "qwen3/text-to-image", sizes: { "1K": .024, "2K": .024 }, maxRefs: 3, refUsd: .0025,
    textModel: "qwen3/text-to-image", editModel: "qwen3/image-to-image",
    wire: (input, size, aspect, refs) => { expect(input.image_size).toBe(aspect); expect(input.resolution).toBe(size); expect(input.image_urls).toEqual(refs.length ? refs : undefined); },
  },
  {
    id: "z-image/z-image", sizes: { "": .004 }, maxRefs: 0, refUsd: 0, textModel: "z-image", editModel: "z-image",
    wire: (input, _size, aspect) => sameAspect(input, aspect),
  },
];

it("covers every selectable image model, featured model and public nav entry", () => {
  const ids = [...cases.map(c => c.id), ...extraCases.map(c => c.id)].sort();
  expect(marketModelsOf("image").map(m => m.id).sort()).toEqual(ids);
  for (const id of [...IMAGE_FEATURED_IDS, ...NAV_IMAGE_MODELS.map(m => m.id)]) expect(ids, id).toContain(id);
});

describe.each(extraCases)("$id", (c) => {
  it("quotes every size, reference count and aspect for the actual KIE payload", () => {
    const model = getMarketModel(c.id)!;
    expect(model.options.resolutions).toEqual(Object.keys(c.sizes).filter(Boolean));
    expect(model.options).toMatchObject({ maxCount: 1, maxImages: c.maxRefs });
    for (const [size, unitUsd] of Object.entries(c.sizes)) {
      for (let refs = 0; refs <= c.maxRefs; refs++) {
        const imageUrls = urls(refs);
        const usd = unitUsd + Math.max(0, refs - (c.freeRefs ?? 0)) * c.refUsd;
        for (const aspectRatio of model.options.aspects!) {
          const request = { prompt: "a cat", aspectRatio, resolution: size || undefined, count: 1, imageUrls };
          const { model: providerId, input } = model.buildTask(request);
          expect(providerId).toBe(refs ? c.editModel : c.textModel);
          c.wire(input, size, aspectRatio, imageUrls);
          expect(model.costUsd(request)).toBeCloseTo(usd, 10);
          expect(marketCredits(model, request)).toBe(expectedCredits(usd));
        }
      }
    }
  });
});

describe.each(cases)("$id", (c) => {
  it("quotes every size, count, reference count and aspect for the actual KIE payload", () => {
    const model = getMarketModel(c.id)!;
    const base = { prompt: "a cat" };
    expect(model.options.resolutions).toEqual(Object.keys(c.sizes).filter(Boolean));
    expect(model.options).toMatchObject({ maxCount: c.maxCount, maxImages: c.maxRefs });
    expect(imageResolution(model) ?? "").toBe(c.defaultSize);
    expect(marketCredits(model, base)).toBe(c.defaultCredits);
    expect(marketCredits(model, { ...base, resolution: "retired" })).toBe(c.defaultCredits);
    const defaults = model.buildTask(base).input;
    expect(String(defaults.resolution ?? defaults.size ?? "").toUpperCase()).toBe(c.defaultSize);

    for (const [size, unitUsd] of Object.entries(c.sizes)) {
      for (let count = 1; count <= c.maxCount; count++) {
        for (let refs = 0; refs <= c.maxRefs; refs++) {
          const imageUrls = urls(refs);
          const usd = count * unitUsd + refs * c.refUsd;
          for (const aspectRatio of model.options.aspects!) {
            const request = { ...base, aspectRatio, resolution: size || undefined, count, imageUrls };
            const { model: providerId, input } = model.buildTask(request);
            expect(providerId).toBe(refs ? c.editModel : c.textModel);
            expect(input[c.refField]).toEqual(refs ? imageUrls : undefined);
            expect(input.aspect_ratio).toBe(aspectRatio);
            expect(input.count ?? input.num_images ?? 1).toBe(count);
            const wireSize = input.resolution ?? input.size;
            expect(wireSize).toBe(c.id === "kling-image-4" ? size.toLowerCase() : size || undefined);
            if (c.id.startsWith("gpt-image-2-6")) expect(input.quality).toBe("medium");
            expect(model.costUsd(request)).toBeCloseTo(usd, 10);
            expect(marketCredits(model, request)).toBe(expectedCredits(usd));
          }
        }
      }
    }
  });
});

const upstream = vi.fn<typeof fetch>();
function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubEnv("KIE_API_KEY", "test-key");
  vi.stubEnv("NEXT_PUBLIC_IS_PREVIEW", "false");
  vi.stubEnv("VIDEO_MOCK_PROVIDER", "false");
  vi.stubEnv("VIDEO_GENERATION_ENABLED", "true");
  vi.stubGlobal("fetch", upstream);
  upstream.mockReset().mockImplementation(async () => reply({ code: 200, data: { taskId: "test-task" } }));
  upload.mockClear();
  deleteFile.mockClear();
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function finish(uuid: string, state: "fail" | "success", images: string[] = []) {
  return videoService.handleCallback("kie", {
    code: 200, data: { taskId: "test-task", state, resultJson: JSON.stringify({ resultUrls: images }) },
  }, uuid);
}

describe.each(cases)("$id public generation API", c => {
  it.each(Object.entries(c.sizes))("freezes the quoted %s batch across text and edit requests", async (size, unitUsd) => {
    actor.id = uniqueUserId();
    await giveCredits(actor.id, 1000);
    for (let count = 1; count <= c.maxCount; count++) {
      for (const refs of [0, 1, c.maxRefs]) {
        const imageUrls = Array.from({ length: refs }, (_, index) => `uploads/${actor.id}/${index}.png`);
        const body = { model: c.id, prompt: "a cat", resolution: size || undefined, aspectRatio: "1:1", count, imageUrls };
        const response = await POST(new NextRequest("https://studio.test/api/v1/media/generate", {
          method: "POST", headers: { "Content-Type": "application/json", "X-Media-Account": actor.id }, body: JSON.stringify(body),
        }));
        expect(response.status).toBe(200);
        const { data } = await response.json();
        const expected = expectedCredits(unitUsd * count + c.refUsd * refs);
        expect(marketCredits(getMarketModel(c.id)!, body)).toBe(expected);
        expect(data.creditsUsed).toBe(expected);
        expect(await getHoldRow(data.videoUuid)).toMatchObject({ credits: expected, status: "HOLDING" });
        const wire = JSON.parse(String(upstream.mock.lastCall?.[1]?.body));
        expect(wire.model).toBe(refs ? c.editModel : c.textModel);
        expect(wire.input[c.refField]).toEqual(refs ? imageUrls.map(key => "https://signed.test/" + key) : undefined);
        expect(wire.input.count ?? wire.input.num_images ?? 1).toBe(count);
        expect(String(wire.input.resolution ?? wire.input.size ?? "").toUpperCase()).toBe(size);
        await finish(data.videoUuid, "fail");
      }
    }
    expect(await getBalance(actor.id)).toMatchObject({ availableCredits: 1000, frozenCredits: 0 });
  });
});

const grants = [
  { name: "Free", credits: NEW_USER_GIFT.credits, type: CreditTransType.NEW_USER },
  ...SUBSCRIPTION_PRODUCTS.filter(p => p.enabled).map(p => ({ ...p, type: CreditTransType.SUBSCRIPTION })),
  ...CREDIT_PACKAGES.filter(p => p.enabled).map(p => ({ ...p, type: CreditTransType.ORDER_PAY })),
];
it.each(grants)("$name reserves the default quote and releases it on failure for every model", async grant => {
  const userId = uniqueUserId();
  await creditService.recharge({ userId, credits: grant.credits, transType: grant.type, orderNo: uniqueOrderNo(), remark: "Stripe payment: " + grant.name });
  for (const c of cases) {
    const job = await videoService.generateMedia({ userId, model: c.id, prompt: "a cat" });
    expect(job.creditsUsed).toBe(c.defaultCredits);
    expect(await getHoldRow(job.videoUuid)).toMatchObject({ credits: c.defaultCredits, status: "HOLDING" });
    const task = JSON.parse(String(upstream.mock.lastCall?.[1]?.body));
    expect(task.model).toBe(c.textModel);
    expect(String(task.input.resolution ?? task.input.size ?? "").toUpperCase()).toBe(c.defaultSize);
    await finish(job.videoUuid, "fail");
    await finish(job.videoUuid, "fail");
    expect(await getVideoRow(job.videoUuid)).toMatchObject({ status: "FAILED", creditsUsed: 0 });
    expect(await getHoldRow(job.videoUuid)).toMatchObject({ status: "RELEASED" });
    expect(await getBalance(userId)).toMatchObject({ availableCredits: grant.credits, frozenCredits: 0 });
  }
});

it.each(cases)("$id settles the submitted batch once and delivers all outputs in order", async c => {
  const userId = uniqueUserId();
  await giveCredits(userId, 1000);
  const resolution = Object.keys(c.sizes).at(-1)!;
  const request = { userId, model: c.id, prompt: "an edit", resolution: resolution || undefined, count: c.maxCount, imageUrls: urls(c.maxRefs), idempotencyKey: "image-retry" };
  const expected = expectedCredits(c.sizes[resolution] * c.maxCount + c.refUsd * c.maxRefs);
  const job = await videoService.generateMedia(request);
  expect(job.creditsUsed).toBe(expected);
  expect((await videoService.generateMedia(request)).videoUuid).toBe(job.videoUuid);
  expect(upstream).toHaveBeenCalledTimes(1);
  const body = JSON.parse(String(upstream.mock.lastCall?.[1]?.body));
  expect(body.model).toBe(c.editModel);
  expect(body.input[c.refField]).toEqual(request.imageUrls);
  expect(body.input.count ?? body.input.num_images ?? 1).toBe(c.maxCount);
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 1000 - expected, frozenCredits: expected });

  await finish(job.videoUuid, "success", urls(c.maxCount));
  await finish(job.videoUuid, "success", urls(c.maxCount));
  await finish(job.videoUuid, "fail");
  const status = await videoService.refreshStatus(job.videoUuid, userId);
  expect(status.status).toBe("COMPLETED");
  expect(upload.mock.calls.map(([value]) => value.sourceUrl)).toEqual(urls(c.maxCount));
  expect(status.mediaUrls).toEqual(upload.mock.calls.map(([value]) => "https://signed.test/" + value.key));
  expect(await getHoldRow(job.videoUuid)).toMatchObject({ status: "SETTLED", credits: expected });
  expect(await countTransactions(job.videoUuid, CreditTransType.VIDEO_CONSUME)).toBe(1);
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 1000 - expected, frozenCredits: 0, usedCredits: expected });
});

const batch = { model: "flux3/klein-text-to-image", prompt: "a cat", resolution: "2K", count: 4 };

describe("image batch storage integrity", () => {
  it.each(["complete", "null body", "zero bytes", "download rejected", "zero-byte receipt"] as const)(
    "only settles a batch with four non-empty stored images (%s)",
    async scenario => {
      const userId = uniqueUserId();
      await giveCredits(userId, 100);
      const job = await videoService.generateMedia({ ...batch, userId });
      expect(await getHoldRow(job.videoUuid)).toMatchObject({ status: "HOLDING", credits: job.creditsUsed });

      const sources = urls(batch.count);
      const storage = new Storage({
        endpoint: "https://storage.test", region: "auto", bucket: "fixtures",
        accessKeyId: "test-key", secretAccessKey: "test-secret",
      });
      const put = vi.spyOn(storage, "uploadFile").mockImplementation(async ({ key }) => ({ key }));
      upstream.mockImplementation(async source => {
        if (String(source) === sources[1]) {
          if (scenario === "null body") return new Response(null);
          if (scenario === "zero bytes") return new Response(new Uint8Array(0), { headers: { "content-length": "15" } });
          if (scenario === "download rejected") return new Response(null, { status: 503 });
        }
        return new Response(Uint8Array.of(1, 2, 3), { headers: { "content-type": "image/png" } });
      });
      for (let index = 0; index < sources.length; index++) {
        upload.mockImplementationOnce(async params => {
          const stored = await storage.downloadAndUpload(params);
          return scenario === "zero-byte receipt" && index === 1 ? { ...stored, fileSize: 0 } : stored;
        });
      }

      await finish(job.videoUuid, "success", sources);
      await finish(job.videoUuid, "success", sources);
      const keys = upload.mock.calls.map(([params]) => params.key);
      expect(keys).toHaveLength(batch.count);
      if (scenario === "complete") {
        expect(put).toHaveBeenCalledTimes(batch.count);
        expect(deleteFile).not.toHaveBeenCalled();
        expect(await getVideoRow(job.videoUuid)).toMatchObject({
          status: "COMPLETED", videoUrl: keys[0], parameters: { extraKeys: keys.slice(1) },
        });
        expect(await countTransactions(job.videoUuid, CreditTransType.VIDEO_CONSUME)).toBe(1);
        expect(await getBalance(userId)).toMatchObject({ availableCredits: 100 - job.creditsUsed, frozenCredits: 0 });
        return;
      }

      const storedKeys = scenario === "zero-byte receipt" ? keys : keys.filter((_, index) => index !== 1);
      expect(put.mock.calls.map(([params]) => params.key).sort()).toEqual([...storedKeys].sort());
      expect(deleteFile.mock.calls.map(([key]) => key).sort()).toEqual([...storedKeys].sort());
      const row = await getVideoRow(job.videoUuid);
      expect(row).toMatchObject({ status: "FAILED", videoUrl: null, creditsUsed: 0 });
      expect(row?.parameters?.extraKeys).toBeUndefined();
      expect(await getHoldRow(job.videoUuid)).toMatchObject({ status: "RELEASED", credits: job.creditsUsed });
      expect(await countTransactions(job.videoUuid, CreditTransType.REFUND)).toBe(1);
      expect(await countTransactions(job.videoUuid, CreditTransType.VIDEO_CONSUME)).toBe(0);
      expect(await getBalance(userId)).toMatchObject({ availableCredits: 100, frozenCredits: 0, usedCredits: 0 });
    },
  );
});

it("preserves an upload claimed after the failure callback read GENERATING", async () => {
  const userId = uniqueUserId();
  await giveCredits(userId, 100);
  const { videoUuid, creditsUsed } = await videoService.generateMedia({ ...batch, userId });
  const uploading = Promise.withResolvers<void>();
  const resumeUpload = Promise.withResolvers<void>();
  upload.mockImplementationOnce(async ({ key }) => {
    uploading.resolve();
    await resumeUpload.promise;
    return { key, fileSize: 12 };
  });

  // Run the real success callback immediately before D1 executes the competing
  // FAILED update. Keep the uploader in progress until the failure callback returns.
  let success: Promise<void> | undefined;
  const all = D1PreparedQuery.prototype.all;
  const write = vi.spyOn(D1PreparedQuery.prototype, "all").mockImplementation(async function (this: D1PreparedQuery, bindings) {
    const { params } = this.getQuery();
    if (params[0] === "FAILED" && params.includes(videoUuid)) {
      success = finish(videoUuid, "success", urls(batch.count));
      await Promise.race([uploading.promise, success]);
    }
    return all.call(this, bindings);
  });
  try {
    await finish(videoUuid, "fail");
    expect(await getVideoRow(videoUuid)).toMatchObject({ status: "UPLOADING", creditsUsed });
    expect(await getHoldRow(videoUuid)).toMatchObject({ status: "HOLDING", credits: creditsUsed });
  } finally {
    write.mockRestore();
    resumeUpload.resolve();
    await success;
  }
  expect(await getVideoRow(videoUuid)).toMatchObject({ status: "COMPLETED", creditsUsed });
  expect(await getHoldRow(videoUuid)).toMatchObject({ status: "SETTLED" });
  expect(await countTransactions(videoUuid, CreditTransType.VIDEO_CONSUME)).toBe(1);
  expect(await countTransactions(videoUuid, CreditTransType.REFUND)).toBe(0);
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 100 - creditsUsed, frozenCredits: 0, usedCredits: creditsUsed });
});

it.each(["failure callback", "incomplete success callback", "status poll"])(
  "recovers an interrupted refund on %s retries", async retry => {
    const userId = uniqueUserId();
    await giveCredits(userId, 100);
    const request = { ...batch, userId, idempotencyKey: "refund-retry" };
    const { videoUuid, creditsUsed } = await videoService.generateMedia(request);
    const callback = () => retry === "incomplete success callback"
      ? finish(videoUuid, "success", urls(batch.count - 1))
      : finish(videoUuid, "fail");
    const release = vi.spyOn(creditService, "release").mockRejectedValueOnce(new Error("refund interrupted"));
    try {
      await expect(callback()).rejects.toThrow("refund interrupted");
    } finally {
      release.mockRestore();
    }
    expect(await getVideoRow(videoUuid)).toMatchObject({ status: "FAILED", creditsUsed: 0 });
    expect(await getHoldRow(videoUuid)).toMatchObject({ status: "HOLDING", credits: creditsUsed });

    const replay = () => retry === "status poll" ? videoService.refreshStatus(videoUuid, userId) : callback();
    await Promise.all([replay(), replay()]);
    await finish(videoUuid, "success", urls(batch.count));
    expect(upload).not.toHaveBeenCalled();
    expect(await getVideoRow(videoUuid)).toMatchObject({ status: "FAILED", creditsUsed: 0, videoUrl: null });
    expect(await getHoldRow(videoUuid)).toMatchObject({ status: "RELEASED" });
    expect(await countTransactions(videoUuid, CreditTransType.REFUND)).toBe(1);
    expect(await countTransactions(videoUuid, CreditTransType.VIDEO_CONSUME)).toBe(0);
    expect(await getBalance(userId)).toMatchObject({ availableCredits: 100, frozenCredits: 0, usedCredits: 0 });
  }
);

it("reconciles a legacy failed image with its quote and hold still present", async () => {
  const userId = uniqueUserId();
  await giveCredits(userId, 100);
  const request = { ...batch, userId, idempotencyKey: "legacy-failure" };
  const { videoUuid } = await videoService.generateMedia(request);
  await db.update(videos).set({ status: "FAILED" }).where(eq(videos.uuid, videoUuid));

  await finish(videoUuid, "fail");
  expect(await videoService.generateMedia(request)).toMatchObject({ videoUuid, status: "FAILED", creditsUsed: 0 });
  expect(await getVideoRow(videoUuid)).toMatchObject({ status: "FAILED", creditsUsed: 0 });
  expect(await getHoldRow(videoUuid)).toMatchObject({ status: "RELEASED" });
  expect(await countTransactions(videoUuid, CreditTransType.REFUND)).toBe(1);
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 100, frozenCredits: 0 });
});

it("does not hold image credits when the callback cannot be signed before dispatch", async () => {
  vi.stubEnv("AI_CALLBACK_URL", "https://studio.test/callback");
  vi.stubEnv("CALLBACK_HMAC_SECRET", "");
  const userId = uniqueUserId();
  await giveCredits(userId, 100);
  const service = new VideoService();
  await expect(service.generateMedia({ ...batch, userId })).rejects.toThrow("CALLBACK_HMAC_SECRET");
  expect(upstream).not.toHaveBeenCalled();
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 100, frozenCredits: 0 });
});

it.each(["empty", "short", "duplicate", "upload failure"])("releases the entire undelivered batch on %s", async reason => {
  const userId = uniqueUserId();
  await giveCredits(userId, 100);
  const job = await videoService.generateMedia({ ...batch, userId });
  const sources = reason === "empty" ? [] : reason === "short" ? urls(3) : reason === "duplicate" ? [...urls(3), urls(1)[0]] : urls(4);
  if (reason === "upload failure") upload.mockRejectedValueOnce(new Error("failed transfer"));
  upstream.mockResolvedValueOnce(reply({ code: 200, data: { taskId: job.taskId, state: "success", resultJson: JSON.stringify({ resultUrls: sources }) } }));
  expect((await videoService.refreshStatus(job.videoUuid, userId)).status).toBe("FAILED");
  if (reason === "upload failure") {
    expect(deleteFile.mock.calls.map(([key]) => key)).toEqual(upload.mock.calls.slice(1).map(([item]) => item.key));
  } else {
    expect(upload).not.toHaveBeenCalled();
  }
  await finish(job.videoUuid, "success", urls(4));
  expect(await getHoldRow(job.videoUuid)).toMatchObject({ status: "RELEASED" });
  expect(await getVideoRow(job.videoUuid)).toMatchObject({ status: "FAILED", creditsUsed: 0, videoUrl: null });
  expect(await countTransactions(job.videoUuid, CreditTransType.REFUND)).toBe(1);
  expect(await countTransactions(job.videoUuid, CreditTransType.VIDEO_CONSUME)).toBe(0);
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 100, frozenCredits: 0 });
});

it("rejects insufficient balance before KIE and releases a definite provider rejection", async () => {
  const userId = uniqueUserId();
  const request = { ...batch, userId, idempotencyKey: "insufficient" };
  await expect(videoService.generateMedia(request)).rejects.toMatchObject({ status: 402, details: { requiredCredits: 14 } });
  expect(upstream).not.toHaveBeenCalled();
  expect(await videoService.generateMedia(request)).toMatchObject({ status: "FAILED", creditsUsed: 0 });
  await giveCredits(userId, 100);
  upstream.mockResolvedValueOnce(reply({ code: 422, msg: "rejected" }, 422));
  const retry = { ...request, idempotencyKey: "rejected" };
  await expect(videoService.generateMedia(retry)).rejects.toThrow("rejected");
  const replay = await videoService.generateMedia(retry);
  expect(replay).toMatchObject({ status: "FAILED", creditsUsed: 0 });
  expect(await getHoldRow(replay.videoUuid)).toMatchObject({ status: "RELEASED", credits: 14 });
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 100, frozenCredits: 0 });
});

it("retains exactly one hold on an ambiguous submission and releases it on a definitive callback", async () => {
  const userId = uniqueUserId();
  await giveCredits(userId, 100);
  upstream.mockRejectedValueOnce(new Error("timeout"));
  const request = { ...batch, userId, idempotencyKey: "timeout" };
  await expect(videoService.generateMedia(request)).rejects.toMatchObject({ status: 202, details: { code: "SUBMIT_RESULT_UNKNOWN" } });
  const replay = await videoService.generateMedia(request);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(await getHoldRow(replay.videoUuid)).toMatchObject({ status: "HOLDING", credits: 14 });
  await finish(replay.videoUuid, "fail");
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 100, frozenCredits: 0 });
});

it("preserves a failed image callback arriving before the submit response", async () => {
  const userId = uniqueUserId();
  await giveCredits(userId, 100);
  upstream.mockImplementationOnce(async () => {
    const { videos } = await videoService.listVideos(userId, { mediaType: "image" });
    await finish(videos[0].uuid, "fail");
    return reply({ code: 200, data: { taskId: "test-task" } });
  });
  expect(await videoService.generateMedia({ ...batch, userId })).toMatchObject({ status: "FAILED", creditsUsed: 0 });
  expect(await getBalance(userId)).toMatchObject({ availableCredits: 100, frozenCredits: 0 });
});

it("waives an image batch for a verified preview super-admin", async () => {
  vi.stubEnv("NEXT_PUBLIC_IS_PREVIEW", "true");
  const id = uniqueUserId();
  await db.insert(users).values({ id, name: id, email: id + "@example.test", isAdmin: true, isSuperAccount: true });
  const job = await videoService.generateMedia({ userId: id, ...batch });
  expect(job.creditsUsed).toBe(0);
  await finish(job.videoUuid, "success", urls(batch.count));
  await finish(job.videoUuid, "fail");
  expect(await getVideoRow(job.videoUuid)).toMatchObject({ status: "COMPLETED", creditsUsed: 0 });
  expect(await getHoldRow(job.videoUuid)).toBeNull();
  const failed = await videoService.generateMedia({ userId: id, ...batch });
  await finish(failed.videoUuid, "fail");
  await finish(failed.videoUuid, "fail");
  expect(await getVideoRow(failed.videoUuid)).toMatchObject({ status: "FAILED", creditsUsed: 0 });
  expect(await getHoldRow(failed.videoUuid)).toBeNull();
  expect(await countTransactions(failed.videoUuid, CreditTransType.REFUND)).toBe(0);
});
