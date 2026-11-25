import { describe, expect, it } from "vitest";
import { findHomeDraft, homeDraftKey } from "@/lib/home-draft";

const base = "aivd:home-draft";
const store = (entries: Record<string, unknown>) => ({
  getItem(key: string) { return Object.hasOwn(entries, key) ? JSON.stringify(entries[key]) : null; },
});

describe("homepage draft ownership", () => {
  it("restores signed results only from the same account's own draft", () => {
    const result = { key: "https://assets.test/signed/result", url: "https://assets.test/signed/result" };
    const data = store({ [homeDraftKey(base, "mary")]: { owner: "mary", referenceImages: [result] }, [base]: { referenceImages: [result] } });
    expect(findHomeDraft(data, base, "mary", false)?.key).toBe(homeDraftKey(base, "mary"));
    expect(findHomeDraft(data, base, "luis", false)).toBeNull();
    expect(findHomeDraft(data, base, undefined, false)).toBeNull();
  });

  it("migrates legacy uploads only when every key belongs to the returning user", () => {
    const refs = [{ key: "uploads/mary/one.mov", url: "https://assets.test/signed" }];
    const data = store({ [base]: { videoReferences: refs } });
    expect(findHomeDraft(data, base, "mary", false)?.saved.videoReferences).toEqual(refs);
    expect(findHomeDraft(data, base, "luis", false)).toBeNull();
    expect(findHomeDraft(data, base, undefined, false)).toBeNull();
  });

  it("prioritizes a guest draft only for a pending generation after sign-in", () => {
    const account = homeDraftKey(base, "mary");
    const guest = homeDraftKey(base);
    const data = store({ [account]: { owner: "mary", prompt: "Account draft" }, [guest]: { prompt: "Guest draft", videoReferences: [{ id: "local-file", url: "" }] } });
    expect(findHomeDraft(data, base, "mary", false)?.key).toBe(account);
    expect(findHomeDraft(data, base, "mary", true)?.key).toBe(guest);
    expect(findHomeDraft(data, base, undefined, false)?.key).toBe(guest);
  });
});
