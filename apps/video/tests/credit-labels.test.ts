import { describe, expect, it } from "vitest";
import { creditKind, creditKindLabel, describeRemark } from "@/lib/credit-labels";

describe("credit labels", () => {
  it("reads both spellings of the ledger types", () => {
    expect(creditKind("video_generate")).toBe("spend");
    expect(creditKind("VIDEO_CONSUME")).toBe("spend");
    expect(creditKind("video_refund")).toBe("refund");
    expect(creditKind("SUBSCRIPTION")).toBe("subscription");
    expect(creditKind("something_new")).toBe("adjust");
    expect(creditKindLabel("spend", true)).toBe("生成消耗");
  });

  it("turns engineer remarks into plain words without ids", () => {
    expect(describeRemark("Video generation settled: vid_7PBa2BTtSnyVBZBxXLwjB", true)).toBe("生成完成");
    expect(describeRemark("Video generation failed, credits released", true)).toBe("生成失败，积分已退回");
    expect(describeRemark("Stripe payment: Basic Plan", true)).toBe("购买 Basic 套餐");
    expect(describeRemark("Stripe payment: Basic Plan", false)).toBe("Bought the Basic plan");
    expect(describeRemark("Stripe refund: stripe_cs_test_a109eCWlkWxyz", true)).toBe("订单退款");
    expect(describeRemark("Credits expired: 280 left in package 5", true)).toBe("到期未用完的积分已失效");
    expect(describeRemark("", true)).toBeNull();
    expect(describeRemark("Manual top-up for vid_abcdefgh123", false)).toBe("Manual top-up for");
  });
});
