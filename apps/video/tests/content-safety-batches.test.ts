import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: { images: string[] }[] = [];
let answers: string[] = [];

vi.mock("@/lib/deepseek-client", () => ({
  callDeepSeekJson: vi.fn(async ({ content }: { content: { type: string; image_url?: { url: string } }[] }) => {
    calls.push({ images: content.filter((part) => part.type === "image_url").map((part) => part.image_url!.url) });
    const decision = answers.shift() ?? "allow";
    return { decision, categories: [], reason: decision };
  }),
}));

const { moderateContent, SAFETY_IMAGES_PER_CALL } = await import("@/lib/content-safety");

const images = (n: number) => Array.from({ length: n }, (_, index) => ({ url: `https://example.com/${index + 1}.png`, label: `reference-${index + 1}` }));

describe("content safety covers every reference image", () => {
  beforeEach(() => {
    calls.length = 0;
    answers = [];
  });

  it("reviews all 16 images (two batches), not just the first 8", async () => {
    const result = await moderateContent({ text: "a portrait", images: images(16) });
    expect(result.decision).toBe("allow");
    expect(calls.length).toBe(2);
    expect(calls.flatMap((call) => call.images)).toEqual(images(16).map((image) => image.url));
    expect(Math.max(...calls.map((call) => call.images.length))).toBeLessThanOrEqual(SAFETY_IMAGES_PER_CALL);
  });

  it("blocks when an image in a later batch is blocked", async () => {
    answers = ["allow", "block"];
    const result = await moderateContent({ text: "a portrait", images: images(12) });
    expect(result.decision).toBe("block");
  });

  it("keeps the stricter of allow and review", async () => {
    answers = ["review", "allow"];
    expect((await moderateContent({ text: "a portrait", images: images(9) })).decision).toBe("review");
  });

  it("still makes one call for text only", async () => {
    await moderateContent({ text: "a portrait" });
    expect(calls.length).toBe(1);
  });
});
