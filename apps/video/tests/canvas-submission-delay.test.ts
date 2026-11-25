import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submissionDelay } from "@/lib/creative-space/submission-delay";

describe("image and video submission grace period", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits for the complete three seconds, then dispatches exactly once", () => {
    const update = vi.fn();
    const dispatch = vi.fn();
    submissionDelay(update, dispatch);
    vi.advanceTimersByTime(2_999);
    expect(update.mock.calls).toEqual([[2], [1]]);
    expect(dispatch).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10_000);
    expect(dispatch).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1_500, 2_999])("cancels without sending after %i ms", (ms) => {
    const update = vi.fn();
    const dispatch = vi.fn();
    const cancel = submissionDelay(update, dispatch);
    vi.advanceTimersByTime(ms);
    cancel();
    const ticks = update.mock.calls.length;
    vi.advanceTimersByTime(10_000);
    expect(update).toHaveBeenCalledTimes(ticks);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
