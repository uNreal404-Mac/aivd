import { describe, expect, it } from "vitest";

import { failureReason } from "@/lib/failure-reason";

describe("failureReason", () => {
  it("drops the provider name and explains a known reason", () => {
    expect(failureReason("kie rejected: aspect_ratio is not within the range of allowed options", true)).toBe(
      "这个模型不支持所选的画面比例，换一个比例再试。",
    );
    expect(failureReason("kie rejected: aspect_ratio is not within the range of allowed options", false)).toContain("aspect ratio");
  });

  it("keeps an unknown reason but without the provider", () => {
    expect(failureReason("evolink error: upstream returned an empty file", false)).toBe("upstream returned an empty file");
  });

  it("puts an unknown English reason in plain Chinese on a Chinese page, original kept", () => {
    expect(failureReason("evolink error: upstream returned an empty file", true)).toBe(
      "生成没有成功，可以再试一次，或换一个模型。（upstream returned an empty file）",
    );
    expect(failureReason("模型返回了空文件", true)).toBe("模型返回了空文件");
  });

  it("returns null for nothing to say", () => {
    expect(failureReason(null, true)).toBeNull();
    expect(failureReason("kie rejected:   ", true)).toBeNull();
  });
});
