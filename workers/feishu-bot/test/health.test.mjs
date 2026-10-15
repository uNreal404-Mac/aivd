import assert from "node:assert/strict";
import test from "node:test";
import { fetchHealthSummary } from "../src/health.mjs";

function healthResponse(overrides = {}, status = 200) {
  return new Response(JSON.stringify({
    ok: true,
    authReady: true,
    generationEnabled: false,
    generateReady: false,
    uploadReady: true,
    checkoutConfigured: false,
    mailConfigured: true,
    ...overrides,
  }), { status, headers: { "content-type": "application/json" } });
}

test("summarizes HTTP status and selected readiness booleans", async () => {
  let request;
  const summary = await fetchHealthSummary({
    timeoutMs: 100,
    fetchImpl: async (url, init) => {
      request = { url, init };
      return healthResponse();
    },
  });

  assert.equal(request.url, "https://dreamutopia-clone.pages.dev/api/health");
  assert.equal(request.init.method, "GET");
  assert.equal(request.init.redirect, "error");
  assert.match(summary, /HTTP 200/);
  assert.match(summary, /ok=true/);
  assert.match(summary, /authReady=true/);
  assert.match(summary, /generationEnabled=false/);
  assert.match(summary, /generateReady=false/);
  assert.match(summary, /uploadReady=true/);
  assert.match(summary, /checkoutConfigured=false/);
  assert.match(summary, /mailConfigured=true/);
});

test("returns a safe summary for a non-OK response without exposing its body", async () => {
  const summary = await fetchHealthSummary({
    fetchImpl: async () => new Response("private-origin-detail", { status: 503 }),
  });

  assert.match(summary, /HTTP 503/);
  assert.doesNotMatch(summary, /private-origin-detail/);
});

test("returns a safe summary for malformed JSON without exposing response text", async () => {
  const summary = await fetchHealthSummary({
    fetchImpl: async () => new Response("private-json-detail", { status: 200 }),
  });

  assert.match(summary, /格式|无效|失败/);
  assert.doesNotMatch(summary, /private-json-detail/);
});

test("aborts a health request when its timeout expires", async () => {
  const summary = await fetchHealthSummary({
    timeoutMs: 5,
    fetchImpl: (_url, init) => new Promise((resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }),
  });

  assert.match(summary, /超时/);
});

test("keeps the timeout active while reading the health response body", async () => {
  let guard;
  const work = fetchHealthSummary({
    timeoutMs: 5,
    fetchImpl: async (_url, init) => ({
      ok: true,
      status: 200,
      json: () => new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
    }),
  });
  const guardResult = new Promise((resolve) => {
    guard = setTimeout(() => resolve("test observer timed out"), 50);
  });
  const summary = await Promise.race([work, guardResult]);
  clearTimeout(guard);

  assert.match(summary, /超时/);
});

test("does not follow redirects when calling the fixed health endpoint", async () => {
  let redirectMode;
  const summary = await fetchHealthSummary({
    fetchImpl: async (_url, init) => {
      redirectMode = init.redirect;
      return new Response(null, { status: 302, headers: { location: "https://example.com" } });
    },
  });

  assert.equal(redirectMode, "error");
  assert.match(summary, /HTTP 302/);
});
