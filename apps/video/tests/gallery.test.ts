import { describe, expect, it } from "vitest";

import type { Video } from "../src/db/schema";
import {
  GALLERY_DESCRIPTION_MAX,
  GALLERY_PUBLIC_PROMPT_MAX,
  GALLERY_TITLE_MAX,
  buildTemplate,
  canPublish,
  isMissingGallerySchemaError,
  modelLabelFor,
  publishInputSchema,
  qualityFromResolution,
  resolvePublishFields,
  toGalleryItem,
} from "../src/lib/gallery";

const OWNER = "user-1";

function makeVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 1,
    uuid: "video-1",
    userId: OWNER,
    prompt: "A cat surfing a wave at sunset",
    model: "kling-v1",
    mediaType: "video",
    parameters: null,
    idempotencyKey: null,
    status: "COMPLETED",
    provider: null,
    externalTaskId: null,
    errorMessage: null,
    startImageUrl: null,
    originalVideoUrl: null,
    videoUrl: "videos/video-1.mp4",
    thumbnailUrl: "videos/video-1.jpg",
    duration: 5,
    resolution: "1080p",
    aspectRatio: "16:9",
    fileSize: null,
    creditsUsed: 10,
    createdAt: new Date("2024-01-01T00:00:00.000Z"),
    updatedAt: new Date("2024-01-01T00:00:00.000Z"),
    completedAt: new Date("2024-01-01T00:00:00.000Z"),
    generationTime: 30,
    isDeleted: false,
    deletionToken: null,
    visibility: "private",
    publishedAt: null,
    galleryTitle: null,
    galleryDescription: null,
    publicPrompt: null,
    promptProtected: false,
    assetsReusable: false,
    ...overrides,
  };
}

function makeItem(
  overrides: Partial<Video> = {},
  authorName: string | null = "Alice"
) {
  return toGalleryItem({ ...makeVideo(overrides), authorName });
}

const AVAILABLE_MODELS = ["kling-v1", "veo-3"];

describe("publishInputSchema", () => {
  it("trims the title and keeps the optional fields optional", () => {
    const parsed = publishInputSchema.parse({ title: "  Sunset waves  " });

    expect(parsed.title).toBe("Sunset waves");
    expect(parsed.description).toBeUndefined();
    expect(parsed.publicPrompt).toBeUndefined();
    expect(parsed.protectPrompt).toBeUndefined();
    expect(parsed.allowAssetReuse).toBeUndefined();
  });

  it("rejects a blank title", () => {
    expect(publishInputSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(publishInputSchema.safeParse({}).success).toBe(false);
  });

  it("enforces the title, description and prompt length limits", () => {
    expect(
      publishInputSchema.safeParse({ title: "a".repeat(GALLERY_TITLE_MAX) })
        .success
    ).toBe(true);
    expect(
      publishInputSchema.safeParse({ title: "a".repeat(GALLERY_TITLE_MAX + 1) })
        .success
    ).toBe(false);
    expect(
      publishInputSchema.safeParse({
        title: "ok",
        description: "a".repeat(GALLERY_DESCRIPTION_MAX),
      }).success
    ).toBe(true);
    expect(
      publishInputSchema.safeParse({
        title: "ok",
        description: "a".repeat(GALLERY_DESCRIPTION_MAX + 1),
      }).success
    ).toBe(false);
    expect(
      publishInputSchema.safeParse({
        title: "ok",
        publicPrompt: "a".repeat(GALLERY_PUBLIC_PROMPT_MAX),
      }).success
    ).toBe(true);
    expect(
      publishInputSchema.safeParse({
        title: "ok",
        publicPrompt: "a".repeat(GALLERY_PUBLIC_PROMPT_MAX + 1),
      }).success
    ).toBe(false);
  });
});

describe("resolvePublishFields", () => {
  const superInput = {
    title: "Sunset waves",
    description: "  golden hour  ",
    publicPrompt: "  MY OWN PROMPT  ",
    protectPrompt: true,
    allowAssetReuse: true,
  };

  it("ignores prompt protection for a normal account", () => {
    const fields = resolvePublishFields({
      isSuperAccount: false,
      originalPrompt: "original prompt",
      input: superInput,
    });

    expect(fields).toEqual({
      galleryTitle: "Sunset waves",
      galleryDescription: "golden hour",
      publicPrompt: "original prompt",
      promptProtected: false,
      assetsReusable: true,
    });
  });

  it("treats a super account without protection like a normal account", () => {
    const fields = resolvePublishFields({
      isSuperAccount: true,
      originalPrompt: "original prompt",
      input: { ...superInput, protectPrompt: false },
    });

    expect(fields.promptProtected).toBe(false);
    expect(fields.publicPrompt).toBe("original prompt");
  });

  it("protects the prompt for a super account using the edited prompt", () => {
    const fields = resolvePublishFields({
      isSuperAccount: true,
      originalPrompt: "original prompt",
      input: superInput,
    });

    expect(fields.promptProtected).toBe(true);
    expect(fields.publicPrompt).toBe("MY OWN PROMPT");
  });

  it("allows a super account to hide the prompt entirely", () => {
    const fields = resolvePublishFields({
      isSuperAccount: true,
      originalPrompt: "original prompt",
      input: { title: "Hidden work", protectPrompt: true },
    });

    expect(fields.promptProtected).toBe(true);
    expect(fields.publicPrompt).toBe("");
  });

  it("defaults the description to null and reuse to false", () => {
    const fields = resolvePublishFields({
      isSuperAccount: false,
      originalPrompt: "original prompt",
      input: { title: "Sunset waves" },
    });

    expect(fields.galleryDescription).toBeNull();
    expect(fields.assetsReusable).toBe(false);
  });
});

describe("canPublish", () => {
  it("allows the owner of a completed private video", () => {
    expect(canPublish(makeVideo(), OWNER)).toEqual({ ok: true });
  });

  it("treats a missing or deleted video as not found", () => {
    expect(canPublish(null, OWNER)).toEqual({ ok: false, code: "NOT_FOUND" });
    expect(canPublish(undefined, OWNER)).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(canPublish(makeVideo({ isDeleted: true }), OWNER)).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("forbids publishing someone else's video", () => {
    expect(canPublish(makeVideo({ userId: "other-user" }), OWNER)).toEqual({
      ok: false,
      code: "FORBIDDEN",
    });
  });

  it("requires a completed video with a rendered file", () => {
    expect(canPublish(makeVideo({ status: "GENERATING" }), OWNER)).toEqual({
      ok: false,
      code: "NOT_COMPLETED",
    });
    expect(canPublish(makeVideo({ videoUrl: null }), OWNER)).toEqual({
      ok: false,
      code: "NOT_COMPLETED",
    });
  });

  it("reports an already published video", () => {
    expect(canPublish(makeVideo({ visibility: "public" }), OWNER)).toEqual({
      ok: false,
      code: "ALREADY_PUBLISHED",
    });
  });
});

describe("toGalleryItem", () => {
  it("projects the public fields of a published work", () => {
    const publishedAt = new Date("2024-05-01T10:00:00.000Z");
    const item = makeItem({
      visibility: "public",
      publishedAt,
      galleryTitle: "  Sunset waves  ",
      galleryDescription: "Golden hour",
      publicPrompt: "A cat surfing a wave at sunset",
    });

    expect(item.uuid).toBe("video-1");
    expect(item.title).toBe("Sunset waves");
    expect(item.description).toBe("Golden hour");
    expect(item.authorName).toBe("Alice");
    expect(item.model).toBe("kling-v1");
    expect(item.modelLabel).toBe("Kling V1");
    expect(item.videoUrl).toBe("videos/video-1.mp4");
    expect(item.thumbnailUrl).toBe("videos/video-1.jpg");
    expect(item.publicPrompt).toBe("A cat surfing a wave at sunset");
    expect(item.promptProtected).toBe(false);
    expect(item.aspectRatio).toBe("16:9");
    expect(item.duration).toBe(5);
    expect(item.resolution).toBe("1080p");
    expect(item.assetsReusable).toBe(false);
    expect(item.hasStartImage).toBe(false);
    expect(item.startImageUrl).toBeNull();
    expect(item.publishedAt).toBe(publishedAt);
  });

  it("falls back to an anonymous author and never leaks an email", () => {
    expect(makeItem({}, null).authorName).toBe("Anonymous");
    expect(makeItem({}, "   ").authorName).toBe("Anonymous");
    expect(makeItem({}, "author@example.com").authorName).toBe("Anonymous");
    expect(JSON.stringify(makeItem({}, "author@example.com"))).not.toContain(
      "author@example.com"
    );
  });

  it("never exposes the email or the user id", () => {
    const item = makeItem({ userId: "user-secret" });

    expect(item).not.toHaveProperty("userId");
    expect(item).not.toHaveProperty("email");
    expect(Object.keys(item)).not.toContain("userId");
    expect(Object.keys(item)).not.toContain("email");
    expect(JSON.stringify(item)).not.toContain("user-secret");
  });

  it("never leaks a protected prompt", () => {
    const item = makeItem({
      galleryTitle: "Hidden work",
      prompt: "TOP SECRET PROMPT",
      publicPrompt: "",
      promptProtected: true,
      visibility: "public",
    });

    expect(item.promptProtected).toBe(true);
    expect(item.publicPrompt).toBeNull();
    expect(JSON.stringify(item)).not.toContain("TOP SECRET PROMPT");
  });

  it("falls back to the stored prompt when none was published", () => {
    const item = makeItem({ prompt: "Original prompt text", publicPrompt: null });

    expect(item.publicPrompt).toBe("Original prompt text");
  });

  it("hides the start image unless the author allowed reuse", () => {
    expect(
      makeItem({ startImageUrl: "uploads/cat.png", assetsReusable: false })
    ).toMatchObject({ startImageUrl: null, hasStartImage: true });

    expect(
      makeItem({ startImageUrl: "uploads/cat.png", assetsReusable: true })
    ).toMatchObject({
      startImageUrl: "uploads/cat.png",
      hasStartImage: true,
    });
  });
});

describe("buildTemplate", () => {
  it("prefills an available model with no image requirements", () => {
    const item = makeItem({
      publicPrompt: "A cat surfing",
      resolution: "1920x1080",
      visibility: "public",
    });

    const template = buildTemplate(item, AVAILABLE_MODELS);

    expect(template).toEqual({
      prompt: "A cat surfing",
      model: "kling-v1",
      modelUnavailable: false,
      originalModel: "kling-v1",
      duration: 5,
      aspectRatio: "16:9",
      quality: "1080p",
      needsOwnImage: false,
    });
    expect("imageUrl" in template).toBe(false);
  });

  it("flags an unavailable model and drops it from the prefill", () => {
    const template = buildTemplate(
      makeItem({ model: "retired-model", publicPrompt: "Hello" }),
      AVAILABLE_MODELS
    );

    expect(template.modelUnavailable).toBe(true);
    expect(template.model).toBeNull();
    expect(template.originalModel).toBe("retired-model");
  });

  it("never exposes a protected prompt", () => {
    const template = buildTemplate(
      makeItem({
        promptProtected: true,
        publicPrompt: "",
        prompt: "TOP SECRET PROMPT",
      }),
      AVAILABLE_MODELS
    );

    expect(template.prompt).toBe("");
    expect(JSON.stringify(template)).not.toContain("TOP SECRET PROMPT");
  });

  it("omits a private start image and asks for an upload", () => {
    const template = buildTemplate(
      makeItem({ startImageUrl: "uploads/cat.png", assetsReusable: false }),
      AVAILABLE_MODELS
    );

    expect(template.imageUrl).toBeUndefined();
    expect("imageUrl" in template).toBe(false);
    expect(template.needsOwnImage).toBe(true);
  });

  it("passes a reusable start image through", () => {
    const template = buildTemplate(
      makeItem({ startImageUrl: "uploads/cat.png", assetsReusable: true }),
      AVAILABLE_MODELS
    );

    expect(template.imageUrl).toBe("uploads/cat.png");
    expect(template.needsOwnImage).toBe(false);
  });
});

describe("qualityFromResolution", () => {
  it("maps known resolutions onto quality names", () => {
    expect(qualityFromResolution("1080p")).toBe("1080p");
    expect(qualityFromResolution("1920x1080")).toBe("1080p");
    expect(qualityFromResolution("1280 x 720")).toBe("720p");
    expect(qualityFromResolution("2160p")).toBe("4k");
  });

  it("returns null when the resolution is not mappable", () => {
    expect(qualityFromResolution("vertical")).toBeNull();
    expect(qualityFromResolution("")).toBeNull();
    expect(qualityFromResolution(null)).toBeNull();
    expect(qualityFromResolution(undefined)).toBeNull();
  });
});

describe("modelLabelFor", () => {
  it("builds a readable label from the model id", () => {
    expect(modelLabelFor("kling-v1")).toBe("Kling V1");
    expect(modelLabelFor("veo-3")).toBe("Veo 3");
    expect(modelLabelFor("")).toBe("");
  });
});

describe("isMissingGallerySchemaError", () => {
  it("detects the missing-column and missing-relation Postgres codes", () => {
    expect(isMissingGallerySchemaError({ code: "42703" })).toBe(true);
    expect(isMissingGallerySchemaError({ code: "42P01" })).toBe(true);
  });

  it("walks nested causes up to three levels", () => {
    const nested = {
      message: "query failed",
      cause: { cause: { code: "42P01" } },
    };

    expect(isMissingGallerySchemaError(nested)).toBe(true);
  });

  it("detects the message form", () => {
    expect(
      isMissingGallerySchemaError(
        new Error('column "visibility" does not exist')
      )
    ).toBe(true);
    expect(
      isMissingGallerySchemaError(new Error('relation "videos" does not exist'))
    ).toBe(true);
  });

  it("returns false for unrelated or non-object errors", () => {
    expect(isMissingGallerySchemaError({ code: "23505" })).toBe(false);
    expect(isMissingGallerySchemaError(new Error("connection refused"))).toBe(
      false
    );
    expect(isMissingGallerySchemaError(null)).toBe(false);
    expect(isMissingGallerySchemaError(undefined)).toBe(false);
    expect(isMissingGallerySchemaError("boom")).toBe(false);
  });
});
