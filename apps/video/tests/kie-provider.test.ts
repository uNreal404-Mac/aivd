import { afterEach, describe, expect, it, vi } from "vitest";

import { KieProvider } from "../src/ai/providers/kie";
import { ProviderRejectedError } from "../src/ai/types";

const params = {
  model: "seedance-1.5-pro",
  prompt: "p",
  duration: 4,
  aspectRatio: "16:9",
  imageUrl: "https://r2.example/x.png",
  mode: "image-to-video",
} as any;

interface StubOptions {
  ok?: boolean;
  status?: number;
  statusText?: string;
  jsonBody?: unknown;
  jsonThrows?: boolean;
  fetchThrows?: boolean;
}

function stubFetch(options: StubOptions) {
  const fn = vi.fn(async (_input: string, _init?: RequestInit) => {
    if (options.fetchThrows) {
      throw new Error("network down");
    }
    return {
      ok: options.ok ?? true,
      status: options.status ?? 200,
      statusText: options.statusText ?? "OK",
      json: async () => {
        if (options.jsonThrows) {
          throw new Error("not json");
        }
        return options.jsonBody;
      },
    };
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("KieProvider.createTask", () => {
  const provider = new KieProvider("test-key");

  it("throws ProviderRejectedError for HTTP 200 with code 422", async () => {
    stubFetch({
      ok: true,
      status: 200,
      jsonBody: {
        code: 422,
        msg: "aspect_ratio is not within the range of allowed options",
      },
    });

    await expect(provider.createTask(params)).rejects.toBeInstanceOf(
      ProviderRejectedError,
    );
  });

  it("throws a plain (non-ProviderRejectedError) Error for HTTP 200 code 500", async () => {
    stubFetch({
      ok: true,
      status: 200,
      jsonBody: { code: 500, msg: "server" },
    });

    let caught: unknown;
    try {
      await provider.createTask(params);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(ProviderRejectedError);
  });

  it("throws ProviderRejectedError for HTTP 401", async () => {
    stubFetch({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      jsonBody: { msg: "unauthorized" },
    });

    await expect(provider.createTask(params)).rejects.toBeInstanceOf(
      ProviderRejectedError,
    );
  });

  it("throws a plain (non-ProviderRejectedError) Error on network failure", async () => {
    stubFetch({ fetchThrows: true });

    let caught: unknown;
    try {
      await provider.createTask(params);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught).not.toBeInstanceOf(ProviderRejectedError);
  });

  it("resolves the taskId and sends the mapped body on success", async () => {
    const fn = stubFetch({
      ok: true,
      status: 200,
      jsonBody: { code: 200, data: { taskId: "t1" } },
    });

    const result = await provider.createTask(params);

    expect(result.taskId).toBe("t1");

    const [, init] = fn.mock.calls[0] as unknown as [
      string,
      RequestInit | undefined,
    ];
    const body = JSON.parse(String(init?.body)) as Record<string, any>;

    expect(body.model).toBe("bytedance/seedance-1.5-pro");
    expect(body.input.aspect_ratio).toBe("16:9");
    expect(body.input.duration).toBe(4);
  });
});
