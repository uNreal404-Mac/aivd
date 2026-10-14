import assert from "node:assert/strict";
import test from "node:test";
import { createImageTask, getTaskInfo } from "../libs/kie";

test("explicit KIE mock response creates a Nano Banana preview task", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ code: 200, data: { taskId: "mock-kie-image-task" } }), { status: 200 });
  };
  try {
    const result = await createImageTask("test-only-key", { prompt: "test", imageUrls: ["https://mock.invalid/image.jpg"], resolution: "1K" });
    assert.deepEqual(result, { ok: true, taskId: "mock-kie-image-task" });
    assert.equal(requestBody.model, "nano-banana-2");
    assert.deepEqual((requestBody.input as Record<string, unknown>).image_input, ["https://mock.invalid/image.jpg"]);
  } finally { globalThis.fetch = originalFetch; }
});

test("known KIE rejection is retryable while timeout remains needs_check", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: 429, msg: "quota exceeded" }), { status: 200 });
  try {
    const rejected = await createImageTask("test-only-key", { prompt: "test", resolution: "1K" });
    assert.equal(rejected.ok, false);
    if (!rejected.ok) assert.equal(rejected.certainty, "rejected");
    globalThis.fetch = async () => { throw new Error("simulated network timeout"); };
    const uncertain = await createImageTask("test-only-key", { prompt: "test", resolution: "1K" });
    assert.equal(uncertain.ok, false);
    if (!uncertain.ok) assert.equal(uncertain.certainty, "unknown");
  } finally { globalThis.fetch = originalFetch; }
});

test("KIE task detail preserves provider-reported credits consumed", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: 200,
    data: { taskId: "mock-cost-task", state: "success", creditsConsumed: 55, resultJson: '{"resultUrls":["https://mock.invalid/video.mp4"]}' },
  }), { status: 200 });
  try {
    const result = await getTaskInfo("test-only-key", "mock-cost-task");
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.creditsConsumed, 55);
      assert.equal(result.resultUrl, "https://mock.invalid/video.mp4");
    }
  } finally { globalThis.fetch = originalFetch; }
});
