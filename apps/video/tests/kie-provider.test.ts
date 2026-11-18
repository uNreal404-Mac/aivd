import { afterEach, describe, expect, it, vi } from "vitest";

import { KieProvider, isDefiniteRejection } from "@/ai/providers/kie";
import { ProviderRejectedError } from "@/ai/types";

function respond(status: number, body: unknown) {
  return vi.fn(async () => ({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (body === undefined) throw new SyntaxError("not json");
      return body;
    },
  }));
}

async function createTask(fetchMock: ReturnType<typeof respond>) {
  vi.stubGlobal("fetch", fetchMock);
  const provider = new KieProvider("test-key-not-real");
  return provider.createTask({
    model: "sora-2",
    prompt: "a cat",
    duration: 10,
    aspectRatio: "16:9",
  });
}

async function caught(fetchMock: ReturnType<typeof respond>): Promise<unknown> {
  try {
    await createTask(fetchMock);
  } catch (error) {
    return error;
  }
  throw new Error("createTask did not throw");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isDefiniteRejection", () => {
  it("treats 4xx except 408 as definite", () => {
    for (const code of [400, 401, 402, 404, 422, 429, 455]) {
      expect(isDefiniteRejection(code), String(code)).toBe(true);
    }
    for (const code of [200, 408, 500, 501, 505]) {
      expect(isDefiniteRejection(code), String(code)).toBe(false);
    }
  });
});

describe("KieProvider.createTask", () => {
  it("returns the task id on success", async () => {
    const result = await createTask(
      respond(200, { code: 200, msg: "success", data: { taskId: "task_1" } }),
    );

    expect(result.taskId).toBe("task_1");
    expect(result.provider).toBe("kie");
  });

  it.each([
    [400, "Invalid request parameters"],
    [401, "Authentication failed"],
    [402, "Insufficient account balance"],
    [422, "Parameter validation failed"],
    [429, "Request rate limit exceeded"],
  ])(
    "throws ProviderRejectedError for body code %i sent with HTTP 200",
    async (code, msg) => {
      const error = await caught(respond(200, { code, msg }));

      expect(error).toBeInstanceOf(ProviderRejectedError);
      expect((error as ProviderRejectedError).status).toBe(code);
      expect((error as Error).message).toBe(msg);
    },
  );

  it("falls back to the HTTP status when the body is not JSON", async () => {
    const error = await caught(respond(401, undefined));

    expect(error).toBeInstanceOf(ProviderRejectedError);
    expect((error as ProviderRejectedError).status).toBe(401);
  });

  it.each([500, 501, 408])(
    "keeps code %i as an unknown outcome",
    async (code) => {
      const error = await caught(respond(200, { code, msg: "server error" }));

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(ProviderRejectedError);
    },
  );

  it("keeps a non-JSON 502 as an unknown outcome", async () => {
    const error = await caught(respond(502, undefined));

    expect(error).not.toBeInstanceOf(ProviderRejectedError);
  });

  it("keeps a 200 without a task id as an unknown outcome", async () => {
    const error = await caught(respond(200, { code: 200, msg: "success", data: null }));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(ProviderRejectedError);
  });

  it("rejects an unsupported model without calling KIE", async () => {
    const fetchMock = respond(200, {});
    vi.stubGlobal("fetch", fetchMock);
    const provider = new KieProvider("test-key-not-real");

    await expect(
      provider.createTask({ model: "no-such-model", prompt: "a cat" }),
    ).rejects.toBeInstanceOf(ProviderRejectedError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
