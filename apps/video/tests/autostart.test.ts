import { describe, expect, it } from "vitest";

import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { estimateCredits } from "@/lib/ai-video-studio";
import { AUTOSTART_STORAGE_KEY, AUTOSTART_TTL_MS, claimAutostart } from "@/lib/autostart";

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    removeItem: (key: string) => void data.delete(key),
    has: (key: string) => data.has(key),
  };
}

describe("homepage autostart", () => {
  const now = 1_700_000_000_000;
  const saved = (token: string, at = now) => ({ [AUTOSTART_STORAGE_KEY]: JSON.stringify({ token, at }) });

  it("starts once for the matching token, then never again", () => {
    const storage = memoryStorage(saved("abc"));
    expect(claimAutostart("abc", storage, now + 1000)).toBe(true);
    expect(storage.has(AUTOSTART_STORAGE_KEY)).toBe(false);
    // Reload, Back or a second tab with the same address.
    expect(claimAutostart("abc", storage, now + 2000)).toBe(false);
  });

  it("does not start for a copied link, an old token or no token", () => {
    expect(claimAutostart("abc", memoryStorage(), now)).toBe(false);
    expect(claimAutostart("abc", memoryStorage(saved("other")), now)).toBe(false);
    expect(claimAutostart("abc", memoryStorage(saved("abc", now - AUTOSTART_TTL_MS - 1)), now)).toBe(false);
    expect(claimAutostart(null, memoryStorage(saved("abc")), now)).toBe(false);
  });
});

describe("credit quote before Generate", () => {
  it("includes the reference image charge the server freezes (MiniMax H3)", () => {
    const model = getMarketModel("minimax-h3/text-to-video");
    expect(model).toBeTruthy();
    const settings = { modelId: "minimax-h3/text-to-video", duration: 4, resolution: "768p" };
    const server = marketCredits(model!, { prompt: "x", duration: 4, resolution: "768p", imageUrls: ["https://example.com/a.png"] });
    expect(estimateCredits(settings, { images: 1 })).toBe(server);
    expect(estimateCredits(settings, { images: 1 })).toBeGreaterThan(estimateCredits(settings, { images: 0 }));
  });

  it("keeps the old quote for callers that pass no extras", () => {
    const settings = { modelId: "minimax-h3/text-to-video", duration: 4, resolution: "768p" };
    expect(estimateCredits(settings)).toBe(estimateCredits(settings, { images: 0, audio: undefined }));
  });
});
