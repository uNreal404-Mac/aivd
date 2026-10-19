import { describe, expect, it } from "vitest";

import { checkPromptSafety } from "@/lib/prompt-enhance/content-filter";

describe("checkPromptSafety", () => {
  it("blocks explicit adult content", () => {
    expect(checkPromptSafety("a nude woman on the beach")).toEqual({
      ok: false,
      reason: "adult",
    });
  });

  it("blocks Chinese adult content", () => {
    expect(checkPromptSafety("裸体 女孩")).toEqual({
      ok: false,
      reason: "adult",
    });
  });

  it("blocks minors in a sexualized context", () => {
    expect(checkPromptSafety("sexy schoolgirl in lingerie")).toEqual({
      ok: false,
      reason: "minor",
    });
    expect(checkPromptSafety("性感 萝莉")).toEqual({
      ok: false,
      reason: "minor",
    });
  });

  it("blocks real people and deepfakes", () => {
    expect(checkPromptSafety("Taylor Swift dancing")).toEqual({
      ok: false,
      reason: "real_person",
    });
    expect(checkPromptSafety("AI换脸 视频")).toEqual({
      ok: false,
      reason: "real_person",
    });
  });

  it("allows benign prompts", () => {
    const allowed = [
      "a kid flying a kite at sunset",
      "城市夜景延时摄影",
      "Sussex countryside drone shot",
      "a cat wearing sunglasses",
      "一条鲤鱼跃过龙门变成龙",
      "淅淅沥沥的春雨",
    ];

    for (const prompt of allowed) {
      expect(checkPromptSafety(prompt)).toEqual({ ok: true });
    }
  });
});
