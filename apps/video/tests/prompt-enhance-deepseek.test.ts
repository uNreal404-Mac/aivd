import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { detectLanguage } from "@/lib/prompt-enhance/config";
import {
  PromptEnhanceUpstreamError,
  enhanceWithDeepSeek,
  estimateCostUsd,
} from "@/lib/prompt-enhance/deepseek";

const API_URL = "https://api.deepseek.com/chat/completions";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the promise to reject");
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enhanceWithDeepSeek", () => {
  it("posts to the DeepSeek chat completions endpoint with the expected payload", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content:
                "  A slow dolly-in on a neon-lit city street at night, shallow depth of field.  ",
            },
          },
        ],
        usage: { prompt_tokens: 120, completion_tokens: 45 },
      })
    );

    const result = await enhanceWithDeepSeek({
      input: "city at night",
      language: "en",
      apiKey: "test-key-not-real",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(API_URL);

    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("deepseek-flash");
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.max_tokens).toBe(600);
    expect(body.stream).toBe(false);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[1].content).toContain("city at night");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key-not-real");

    expect(result.text).toBe(
      "A slow dolly-in on a neon-lit city street at night, shallow depth of field."
    );
    expect(result.usage).toEqual({ promptTokens: 120, completionTokens: 45 });
  });

  it("strips wrapping quotes from the model output", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          { message: { content: '"A cinematic shot of a cat on a rooftop."' } },
        ],
      })
    );

    const result = await enhanceWithDeepSeek({
      input: "a cat on a rooftop",
      language: "en",
      apiKey: "test-key-not-real",
    });

    expect(result.text).toBe("A cinematic shot of a cat on a rooftop.");
    expect(result.usage).toBeUndefined();
  });

  it("throws PromptEnhanceUpstreamError for non-ok responses", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "boom" }, 500));

    const error = await captureError(
      enhanceWithDeepSeek({
        input: "a cat",
        language: "en",
        apiKey: "test-key-not-real",
      })
    );

    expect(error).toBeInstanceOf(PromptEnhanceUpstreamError);
    expect((error as PromptEnhanceUpstreamError).status).toBe(500);
  });

  it("throws PromptEnhanceUpstreamError when the content is empty", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ choices: [{ message: { content: "   " } }] })
    );

    const error = await captureError(
      enhanceWithDeepSeek({
        input: "a cat",
        language: "en",
        apiKey: "test-key-not-real",
      })
    );

    expect(error).toBeInstanceOf(PromptEnhanceUpstreamError);
    expect((error as PromptEnhanceUpstreamError).status).toBe(502);
  });
});

describe("detectLanguage", () => {
  it("detects Chinese", () => {
    expect(detectLanguage("城市夜景")).toBe("zh");
  });

  it("detects English", () => {
    expect(detectLanguage("a city at night")).toBe("en");
  });
});

describe("estimateCostUsd", () => {
  it("prices peak usage", () => {
    expect(
      estimateCostUsd({ promptTokens: 700, completionTokens: 350 })
    ).toBeCloseTo(0.00063, 6);
  });

  it("halves the price off-peak", () => {
    expect(
      estimateCostUsd({ promptTokens: 700, completionTokens: 350 }, false)
    ).toBeCloseTo(0.000315, 6);
  });
});
