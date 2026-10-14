import assert from "node:assert/strict";
import test from "node:test";
import { moderateZcvVideo, ZCV_MODERATION_MODEL } from "../libs/zcvModeration";

test("video moderation sends the whole clip to the configured multimodal model", async () => {
  const originalFetch = globalThis.fetch;
  let requestUrl = "";
  let requestBody: Record<string, unknown> = {};
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input);
    requestBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"safe":true,"reason":"clean cartoon"}' } }], credits_consumed: 0.01 }), { status: 200 });
  };
  try {
    const result = await moderateZcvVideo("test-only-key", "https://preview.example.pages.dev/api/zcv/provider-media?token=test");
    assert.equal(requestUrl, "https://api.kie.ai/gemini-4-argon-openai/v1/chat/completions");
    assert.equal(ZCV_MODERATION_MODEL, "gemini-4-argon-openai");
    const content = (requestBody.messages as Array<{ content: Array<{ image_url?: { url: string } }> }>)[0].content;
    assert.equal(content[1].image_url?.url, "https://preview.example.pages.dev/api/zcv/provider-media?token=test");
    assert.deepEqual(result, { decision: "safe", reason: "clean cartoon", providerCreditsConsumed: 0.01 });
  } finally { globalThis.fetch = originalFetch; }
});

test("gore is rejected and malformed or timed out moderation is never accepted", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"safe":false,"reason":"blood visible"}' } }] }), { status: 200 });
  try {
    assert.equal((await moderateZcvVideo("test-only-key", "https://example.invalid/video.mp4")).decision, "gore");
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "unclear" } }] }), { status: 200 });
    assert.equal((await moderateZcvVideo("test-only-key", "https://example.invalid/video.mp4")).decision, "unknown");
    globalThis.fetch = async () => { throw new Error("simulated moderation timeout"); };
    assert.equal((await moderateZcvVideo("test-only-key", "https://example.invalid/video.mp4")).decision, "unknown");
  } finally { globalThis.fetch = originalFetch; }
});
