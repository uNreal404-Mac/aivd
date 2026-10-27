import { describe, expect, it } from "vitest";

import { buildLocalCreativePlan } from "@/lib/creative-space/local-plan";

const assets = [
  { id: "image-a", label: "A", name: "opening.jpg", type: "image" as const },
  { id: "video-b", label: "B", name: "ending.mp4", type: "video" as const },
];

describe("buildLocalCreativePlan", () => {
  it("uses explicit mentions and recognizes a Chinese opening instruction", () => {
    const plan = buildLocalCreativePlan("把 @A 放在片头", assets, "zh");

    expect(plan.mentionedAssetIds).toEqual(["image-a"]);
    expect(plan.steps[0]?.title).toBe("片头 · @A");
  });

  it("keeps the full local sequence when no mention is supplied", () => {
    const plan = buildLocalCreativePlan("Create a smooth transition", assets, "en");

    expect(plan.steps).toHaveLength(2);
    expect(plan.summary).toContain("2 assets");
  });
});
