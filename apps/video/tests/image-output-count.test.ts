import { expect, it } from "vitest";
import { imageOutputCount } from "@/lib/image-output-count";

it("reads image counts from drafts and studio URLs within the active model's limits", () => {
  expect(imageOutputCount("9", 9)).toBe(9);
  expect(imageOutputCount(9, 4)).toBe(4);
  expect(imageOutputCount(4)).toBe(1);
  for (const value of [undefined, null, "", "1.5", "-2", "abc", Number.NaN, 0]) {
    expect(imageOutputCount(value, 9)).toBe(1);
  }
});
