import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { POST } from "@/app/api/v1/media/generate/route";
import { submitMedia, type SubmitBody } from "@/lib/media-studio";
import { videoService } from "@/services/video";
import { getHoldRow, giveCredits, uniqueUserId } from "./helpers";

const account = vi.hoisted(() => ({ id: "" }));
vi.mock("@/lib/api/auth", () => ({ requireAuth: async () => account }));
vi.mock("@/lib/auth/client", () => ({ getSession: async () => ({ data: { user: account } }) }));
vi.mock("@/lib/internal-test-account", async (original) => ({
  ...(await original<typeof import("@/lib/internal-test-account")>()),
  canGenerateInPreview: () => true,
}));
vi.mock("@/lib/content-safety", async (original) => ({
  ...(await original<typeof import("@/lib/content-safety")>()),
  moderateContent: async () => ({ decision: "allow" }),
}));
vi.mock("@/lib/proxy-config", () => ({}));
const voice = "nPczCjzI2devNBz1zQrb";
const calls: { model: string; input: Record<string, unknown> }[] = [];
const requests: RequestInit[] = [];
let loseNextAnswer = false;
beforeEach(async () => {
  calls.length = requests.length = 0;
  loseNextAnswer = false;
  account.id = uniqueUserId();
  await giveCredits(account.id, 100);
  vi.stubEnv("KIE_API_KEY", "fixture");
  vi.stubEnv("VIDEO_GENERATION_ENABLED", "true");
  const tab = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => tab.get(k) ?? null,
    setItem: (k: string, v: string) => tab.set(k, v),
    removeItem: (k: string) => tab.delete(k),
  });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === "/api/v1/media/generate") {
      requests.push(init);
      const response = await POST(
        new NextRequest("http://test.local" + url, {
          method: init.method,
          headers: init.headers,
          body: init.body,
        }),
      );
      if (loseNextAnswer) {
        loseNextAnswer = false;
        throw new Error("dropped answer");
      }
      return response;
    }
    if (!url.startsWith("https://api.kie.ai/")) throw new Error("Unexpected upstream");
    calls.push(JSON.parse(String(init.body)));
    return Response.json({ code: 200, data: { taskId: "mock-audio-" + calls.length } });
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it.each(["elevenlabs-v3", "elevenlabs-multilingual-v2", "elevenlabs-turbo-2-5"])(
  "forwards %s control values and settles the established quote only once on replay",
  async (model) => {
    const body: SubmitBody = {
      model,
      prompt: "Welcome to the studio",
      voice,
      speed: 1.15,
      voiceSettings: { stability: 1, similarity: 0.82, expression: 0.31, language: "en" },
    };
    loseNextAnswer = true;
    expect((await submitMedia(body, true, undefined, account.id)).ok).toBe(false);
    const result = await submitMedia(
      { ...body, voiceSettings: { language: "en", expression: 0.31, similarity: 0.82, stability: 1 } },
      true,
      undefined,
      account.id,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(calls).toHaveLength(1);
    const expected = marketCredits(getMarketModel(model)!, { prompt: body.prompt });
    expect(await getHoldRow(result.uuid)).toMatchObject({ credits: expected, status: "HOLDING" });
    expect((requests[0].headers as Record<string, string>)["Idempotency-Key"]).toEqual(
      (requests[1].headers as Record<string, string>)["Idempotency-Key"],
    );
    if (model === "elevenlabs-v3")
      expect(calls[0].input).toEqual({
        dialogue: [{ text: body.prompt, voice }],
        stability: 1,
        language_code: "en",
      });
    else
      expect(calls[0].input).toEqual({
        text: body.prompt,
        voice,
        speed: 1.15,
        stability: 1,
        similarity_boost: 0.82,
        style: 0.31,
        language_code: "en",
      });
    await videoService.handleCallback(
      "kie",
      { code: 200, data: { taskId: "mock-audio-1", state: "fail" } },
      result.uuid,
    );
  },
);
it("rejects invalid audio controls before provider dispatch", async () => {
  for (const voiceSettings of [{ stability: 1.1 }, { language: "unsupported" }, { expression: -1 }]) {
    const response = await POST(
      new NextRequest("http://test.local/api/v1/media/generate", {
        method: "POST",
        body: JSON.stringify({ model: "elevenlabs-v3", prompt: "Hi", voiceSettings }),
      }),
    );
    expect(response.status).toBe(400);
  }
  expect(calls).toHaveLength(0);
});
