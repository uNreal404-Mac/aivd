import { describe, expect, it } from "vitest";
import {
  ONBOARDING_COPY,
  RECOMMENDED_PROMPTS,
  giftInfo,
  hasSeen,
  isNewUser,
  markSeen,
  onboardingCopy,
  promptHref,
  seenKey,
  type OnboardingStorage,
} from "@/lib/onboarding";

function createStorage(initial: Record<string, string> = {}): OnboardingStorage {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? (map.get(key) as string) : null),
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("onboardingCopy", () => {
  it("returns Chinese copy for zh", () => {
    expect(onboardingCopy("zh")).toBe(ONBOARDING_COPY.zh);
  });

  it("falls back to English for other locales", () => {
    expect(onboardingCopy("en")).toBe(ONBOARDING_COPY.en);
    expect(onboardingCopy("fr")).toBe(ONBOARDING_COPY.en);
    expect(onboardingCopy("")).toBe(ONBOARDING_COPY.en);
  });

  it("interpolates the site name into the title", () => {
    expect(onboardingCopy("en").title("Acme")).toBe("Welcome to Acme");
    expect(onboardingCopy("zh").title("Acme")).toBe("欢迎来到 Acme");
  });

  it("interpolates the gift amount and expiry", () => {
    expect(onboardingCopy("en").gift(120)).toContain("120");
    expect(onboardingCopy("zh").gift(120)).toContain("120");
    expect(onboardingCopy("en").giftExpiry(30)).toContain("30");
    expect(onboardingCopy("zh").giftExpiry(30)).toContain("30");
  });
});

describe("RECOMMENDED_PROMPTS", () => {
  it("provides exactly three prompts per locale", () => {
    expect(RECOMMENDED_PROMPTS.en).toHaveLength(3);
    expect(RECOMMENDED_PROMPTS.zh).toHaveLength(3);
  });

  it("provides unique, non-empty prompts", () => {
    for (const list of [RECOMMENDED_PROMPTS.en, RECOMMENDED_PROMPTS.zh]) {
      expect(new Set(list).size).toBe(list.length);
      for (const prompt of list) {
        expect(prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("promptHref", () => {
  it("builds an encoded link to the video page", () => {
    expect(promptHref("en", "a b & c")).toBe(
      `/en/ai/video?prompt=${encodeURIComponent("a b & c")}`
    );
    expect(promptHref("zh", "沙漠 日落")).toBe(
      `/zh/ai/video?prompt=${encodeURIComponent("沙漠 日落")}`
    );
  });

  it("keeps unreserved characters intact", () => {
    expect(promptHref("en", "abc")).toBe("/en/ai/video?prompt=abc");
  });
});

describe("isNewUser", () => {
  const now = 1_700_000_000_000;

  it("is false when createdAt is missing", () => {
    expect(isNewUser(undefined, now)).toBe(false);
    expect(isNewUser(undefined)).toBe(false);
  });

  it("is false for unparseable values", () => {
    expect(isNewUser("not-a-date", now)).toBe(false);
    expect(isNewUser(Number.NaN, now)).toBe(false);
  });

  it("accepts Date, ISO string and epoch millis", () => {
    expect(isNewUser(new Date(now - 1000), now)).toBe(true);
    expect(isNewUser(new Date(now - 1000).toISOString(), now)).toBe(true);
    expect(isNewUser(now - 1000, now)).toBe(true);
  });

  it("treats the window edges as inclusive", () => {
    expect(isNewUser(now, now)).toBe(true);
    expect(isNewUser(now - 86_400_000, now)).toBe(true);
    expect(isNewUser(now - 86_400_000 - 1, now)).toBe(false);
  });

  it("honours a custom window", () => {
    expect(isNewUser(now - 5000, now, 4000)).toBe(false);
    expect(isNewUser(now - 1000, now, 4000)).toBe(true);
  });
});

describe("seenKey", () => {
  it("namespaces the key by user id", () => {
    expect(seenKey("user-1")).toBe("du.onboarding.seen.user-1");
  });
});

describe("hasSeen", () => {
  it("is true only when the flag is stored as 1", () => {
    const storage = createStorage({ [seenKey("u1")]: "1" });
    expect(hasSeen(storage, "u1")).toBe(true);
    expect(hasSeen(storage, "u2")).toBe(false);
  });

  it("treats other stored values as not seen", () => {
    const storage = createStorage({ [seenKey("u1")]: "true" });
    expect(hasSeen(storage, "u1")).toBe(false);
  });

  it("treats storage failures as seen", () => {
    const storage: OnboardingStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(hasSeen(storage, "u1")).toBe(true);
  });
});

describe("markSeen", () => {
  it("stores a 1 flag for the user", () => {
    const storage = createStorage();
    markSeen(storage, "u1");
    expect(storage.getItem(seenKey("u1"))).toBe("1");
  });

  it("swallows storage errors", () => {
    const storage: OnboardingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => markSeen(storage, "u1")).not.toThrow();
  });
});

describe("giftInfo", () => {
  it("returns null when the gift is disabled", () => {
    expect(giftInfo({ enabled: false, amount: 100, expireDays: 7 })).toBeNull();
  });

  it("returns null when there is no config", () => {
    expect(giftInfo(null)).toBeNull();
    expect(giftInfo(undefined)).toBeNull();
  });

  it("returns null for non-positive or invalid amounts", () => {
    expect(giftInfo({ enabled: true, amount: 0 })).toBeNull();
    expect(giftInfo({ enabled: true, amount: -5 })).toBeNull();
    expect(giftInfo({ enabled: true })).toBeNull();
    expect(giftInfo({ enabled: true, amount: Number.NaN })).toBeNull();
  });

  it("returns the amount and expiry when enabled", () => {
    expect(giftInfo({ enabled: true, amount: 120, expireDays: 30 })).toEqual({
      amount: 120,
      expireDays: 30,
    });
  });

  it("defaults the expiry to 0 when missing", () => {
    expect(giftInfo({ enabled: true, amount: 50 })).toEqual({ amount: 50, expireDays: 0 });
  });
});
