import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { KieMediaClient } from "@/ai/providers/kie-media";
import { ProviderRejectedError } from "@/ai/types";

const fetchMock = vi.fn();

function mockResponse(
  body: unknown,
  status = 200,
  statusText = "",
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  } as unknown as Response;
}

function lastRequestBody(): Record<string, unknown> {
  const call = fetchMock.mock.calls[0];
  const init = call?.[1] as { body?: string } | undefined;
  return JSON.parse(init?.body ?? "{}") as Record<string, unknown>;
}

function lastRequestUrl(): string {
  return String(fetchMock.mock.calls[0]?.[0]);
}

describe("KieMediaClient", () => {
  let client: KieMediaClient;

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    client = new KieMediaClient("test-kie-key");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("createImageTask", () => {
    it("posts the market model body and returns the task id", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ code: 200, msg: "ok", data: { taskId: "img_task_1" } }),
      );

      const result = await client.createImageTask({
        kieModel: "google/nano-banana",
        prompt: "a red fox in the snow",
        callbackUrl: "https://example.test/cb/kie?videoUuid=img_1",
      });

      expect(result).toEqual({ taskId: "img_task_1" });
      expect(lastRequestUrl()).toBe(
        "https://api.kie.ai/api/v1/jobs/createTask",
      );

      const init = fetchMock.mock.calls[0]?.[1] as {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
      };
      expect(init.method).toBe("POST");
      expect(init.headers?.Authorization).toBe("Bearer test-kie-key");
      expect(init.headers?.["Content-Type"]).toBe("application/json");

      const body = lastRequestBody() as {
        model: string;
        callBackUrl: string;
        input: Record<string, unknown>;
      };
      expect(body.model).toBe("google/nano-banana");
      expect(body.callBackUrl).toBe(
        "https://example.test/cb/kie?videoUuid=img_1",
      );
      expect(body.input.prompt).toBe("a red fox in the snow");
      expect(body.input.aspect_ratio).toBe("1:1");
      expect(body.input.output_format).toBe("png");
      expect(body.input.image_urls).toBeUndefined();
    });

    it("passes image urls when provided", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ code: 200, data: { taskId: "img_task_2" } }),
      );

      await client.createImageTask({
        kieModel: "google/nano-banana-edit",
        prompt: "make it blue",
        imageUrls: ["https://signed.test/a.png"],
        aspectRatio: "16:9",
      });

      const body = lastRequestBody() as { input: Record<string, unknown> };
      expect(body.input.image_urls).toEqual(["https://signed.test/a.png"]);
      expect(body.input.aspect_ratio).toBe("16:9");
    });

    it("throws ProviderRejectedError on HTTP 401", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ msg: "invalid api key" }, 401, "Unauthorized"),
      );

      const error = await client
        .createImageTask({ kieModel: "google/nano-banana", prompt: "x" })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(ProviderRejectedError);
      expect((error as ProviderRejectedError).status).toBe(401);
      expect((error as ProviderRejectedError).message).toBe("invalid api key");
    });

    it("throws ProviderRejectedError when json code is 402", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ code: 402, msg: "insufficient balance" }),
      );

      const error = await client
        .createImageTask({ kieModel: "google/nano-banana", prompt: "x" })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(ProviderRejectedError);
      expect((error as ProviderRejectedError).message).toBe(
        "insufficient balance",
      );
    });

    it("throws a plain Error on HTTP 500", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ msg: "boom" }, 500, "Internal Server Error"),
      );

      const error = await client
        .createImageTask({ kieModel: "google/nano-banana", prompt: "x" })
        .catch((err: unknown) => err);

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(ProviderRejectedError);
    });

    it("throws when the response has no task id", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse({ code: 200, data: {} }));

      await expect(
        client.createImageTask({ kieModel: "google/nano-banana", prompt: "x" }),
      ).rejects.toThrow(/taskId/);
    });
  });

  describe("createMusicTask", () => {
    it("uses non-custom mode without style + title", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ code: 200, data: { taskId: "music_1" } }),
      );

      await client.createMusicTask({ prompt: "a cheerful lo-fi beat" });

      const body = lastRequestBody() as {
        model: string;
        input: Record<string, unknown>;
      };
      expect(body.model).toBe("ai-music-api/generate");
      expect(body.input.model).toBe("V6");
      expect(body.input.custom_mode).toBe(false);
      expect(body.input.instrumental).toBe(false);
      expect(body.input.prompt).toBe("a cheerful lo-fi beat");
    });

    it("uses custom mode when style and title are given", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ code: 200, data: { taskId: "music_2" } }),
      );

      await client.createMusicTask({
        prompt: "walking through the city at dusk",
        style: "synthwave",
        title: "Neon Streets",
      });

      const body = lastRequestBody() as { input: Record<string, unknown> };
      expect(body.input.custom_mode).toBe(true);
      expect(body.input.title).toBe("Neon Streets");
      expect(body.input.style).toBe("synthwave");
      expect(body.input.lyrics).toBe("walking through the city at dusk");
      expect(body.input.instrumental).toBe(false);
      expect(body.input.prompt).toBeUndefined();
    });

    it("omits lyrics for instrumental custom tracks", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ code: 200, data: { taskId: "music_3" } }),
      );

      await client.createMusicTask({
        prompt: "ignored",
        style: "ambient",
        title: "Drift",
        instrumental: true,
      });

      const body = lastRequestBody() as { input: Record<string, unknown> };
      expect(body.input.custom_mode).toBe(true);
      expect(body.input.instrumental).toBe(true);
      expect(body.input.lyrics).toBeUndefined();
    });
  });

  describe("parseMusicCallback", () => {
    it("treats text/first callbacks as processing", () => {
      const text = client.parseMusicCallback({
        code: 200,
        msg: "ok",
        data: { callbackType: "text", task_id: "t1", data: [] },
      });
      expect(text.status).toBe("processing");
      expect(text.stage).toBe("text");
      expect(text.urls).toEqual([]);

      const first = client.parseMusicCallback({
        code: 200,
        msg: "ok",
        data: { callbackType: "first", task_id: "t1", data: [] },
      });
      expect(first.status).toBe("processing");
      expect(first.stage).toBe("first");
    });

    it("completes with audio urls and a thumbnail", () => {
      const result = client.parseMusicCallback({
        code: 200,
        msg: "ok",
        data: {
          callbackType: "complete",
          task_id: "t1",
          data: [
            {
              id: "a",
              audio_url: "https://cdn.test/a.mp3",
              image_url: "https://cdn.test/a.png",
              duration: 30,
            },
            {
              id: "b",
              audio_url: "https://cdn.test/b.mp3",
              image_url: "https://cdn.test/b.png",
              duration: 31,
            },
          ],
        },
      });

      expect(result.status).toBe("completed");
      expect(result.taskId).toBe("t1");
      expect(result.urls).toEqual([
        "https://cdn.test/a.mp3",
        "https://cdn.test/b.mp3",
      ]);
      expect(result.thumbnailUrl).toBe("https://cdn.test/a.png");
    });

    it("fails on code 501", () => {
      const result = client.parseMusicCallback({
        code: 501,
        msg: "generation failed",
        data: { callbackType: "error", task_id: "t1" },
      });
      expect(result.status).toBe("failed");
      expect(result.error?.code).toBe("501");
      expect(result.error?.message).toBe("generation failed");
    });

    it("fails when complete arrives without audio", () => {
      const result = client.parseMusicCallback({
        code: 200,
        msg: "ok",
        data: { callbackType: "complete", task_id: "t1", data: [] },
      });
      expect(result.status).toBe("failed");
    });
  });

  describe("parseImageCallback", () => {
    it("completes on success", () => {
      const result = client.parseImageCallback({
        code: 200,
        msg: "ok",
        data: {
          taskId: "img_1",
          state: "success",
          resultJson: JSON.stringify({
            resultUrls: ["https://cdn.test/1.png"],
          }),
        },
      });

      expect(result.status).toBe("completed");
      expect(result.taskId).toBe("img_1");
      expect(result.urls).toEqual(["https://cdn.test/1.png"]);
    });

    it("fails on state fail", () => {
      const result = client.parseImageCallback({
        code: 200,
        msg: "ok",
        data: {
          taskId: "img_1",
          state: "fail",
          failCode: "CONTENT_POLICY",
          failMsg: "blocked prompt",
        },
      });

      expect(result.status).toBe("failed");
      expect(result.error?.code).toBe("CONTENT_POLICY");
      expect(result.error?.message).toBe("blocked prompt");
    });

    it("stays processing while waiting", () => {
      const result = client.parseImageCallback({
        code: 200,
        msg: "ok",
        data: { taskId: "img_1", state: "waiting" },
      });
      expect(result.status).toBe("processing");
    });
  });

  describe("getTaskStatus", () => {
    it("reads audio urls from data.response.data", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          code: 200,
          data: {
            taskId: "music_1",
            state: "success",
            response: {
              data: [{ audio_url: "https://cdn.test/x.mp3" }],
            },
          },
        }),
      );

      const result = await client.getTaskStatus("music_1", "audio");

      expect(lastRequestUrl()).toBe(
        "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=music_1",
      );
      expect(result.status).toBe("completed");
      expect(result.urls).toEqual(["https://cdn.test/x.mp3"]);
    });

    it("accepts sunoData as a fallback shape", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          code: 200,
          data: {
            taskId: "music_2",
            state: "success",
            response: { sunoData: [{ audioUrl: "https://cdn.test/y.mp3" }] },
          },
        }),
      );

      const result = await client.getTaskStatus("music_2", "audio");
      expect(result.status).toBe("completed");
      expect(result.urls).toEqual(["https://cdn.test/y.mp3"]);
    });

    it("reads image urls from resultJson", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          code: 200,
          data: {
            taskId: "img_1",
            state: "success",
            resultJson: JSON.stringify({ resultUrls: ["https://cdn.test/z.png"] }),
          },
        }),
      );

      const result = await client.getTaskStatus("img_1", "image");
      expect(result.status).toBe("completed");
      expect(result.urls).toEqual(["https://cdn.test/z.png"]);
    });

    it("throws when code is not 200", async () => {
      fetchMock.mockResolvedValueOnce(
        mockResponse({ code: 404, msg: "task not found" }),
      );

      await expect(client.getTaskStatus("missing", "image")).rejects.toThrow(
        "task not found",
      );
    });
  });
});
