import { describe, expect, it } from "vitest";
import { clearSubmittedHomePrompt, findHomeDraft, homeDraftKey, rememberHomeGenerationDraft } from "@/lib/home-draft";

const base = "aivd:home-draft";
const store = (entries: Record<string, unknown>) => ({
  getItem(key: string) { return Object.hasOwn(entries, key) ? JSON.stringify(entries[key]) : null; },
});
const mutableStore = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
};

describe("homepage draft ownership", () => {
  it("clears only the submitted homepage prompt after a matching generation succeeds", () => {
    const local = mutableStore();
    const tab = mutableStore();
    const draftKey = homeDraftKey(base, "mary");
    local.setItem(draftKey, JSON.stringify({ owner: "mary", prompt: "A dragon", replaced: { prompt: "Old idea" }, imageModelId: "model", referenceImages: [{ id: "ref" }] }));
    rememberHomeGenerationDraft(tab, { token: "job-1", kind: "image", owner: "mary", base, draftKey, prompt: "A dragon" }, [local, tab]);

    expect(clearSubmittedHomePrompt(tab, [local, tab], { token: "job-1", kind: "image", owner: "luis", prompt: "A dragon" })).toBe(false);
    expect(JSON.parse(local.getItem(draftKey)!).prompt).toBe("A dragon");
    expect(clearSubmittedHomePrompt(tab, [local, tab], { token: "job-1", kind: "image", owner: "mary", prompt: "A dragon" })).toBe(true);
    expect(JSON.parse(local.getItem(draftKey)!)).toMatchObject({ prompt: "", replaced: null, imageModelId: "model", referenceImages: [{ id: "ref" }] });
  });

  it("preserves a homepage draft that changed after the handoff", () => {
    const local = mutableStore();
    const tab = mutableStore();
    const draftKey = homeDraftKey(base, "mary");
    local.setItem(draftKey, JSON.stringify({ owner: "mary", prompt: "A dragon" }));
    rememberHomeGenerationDraft(tab, { token: "job-2", kind: "video", owner: "mary", base, draftKey, prompt: "A dragon" }, [local, tab]);
    local.setItem(draftKey, JSON.stringify({ owner: "mary", prompt: "A new idea" }));
    expect(clearSubmittedHomePrompt(tab, [local, tab], { token: "job-2", kind: "video", owner: "mary", prompt: "A dragon" })).toBe(false);
    expect(JSON.parse(local.getItem(draftKey)!).prompt).toBe("A new idea");
  });

  it("also clears a stale draft snapshot when the last keystroke was not saved before navigation", () => {
    const local = mutableStore();
    const tab = mutableStore();
    const draftKey = homeDraftKey(base, "mary");
    local.setItem(draftKey, JSON.stringify({ owner: "mary", prompt: "Almost a dragon" }));
    rememberHomeGenerationDraft(tab, { token: "job-3", kind: "video", owner: "mary", base, draftKey, prompt: "A dragon" }, [local, tab]);
    expect(clearSubmittedHomePrompt(tab, [local, tab], { token: "job-3", kind: "video", owner: "mary", prompt: "A dragon" })).toBe(true);
    expect(JSON.parse(local.getItem(draftKey)!).prompt).toBe("");
  });
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

  it("leaves old unowned private text, undo text and local files untouched when another account arrives first", () => {
    for (const legacy of [
      { prompt: "Mary's unpublished script" },
      { replaced: { prompt: "Private discarded idea" }, videoReferences: [] },
      { prompt: "Private file", keyframes: { first: { id: "legacy-local-file", name: "private portrait" } } },
    ]) {
      const data = store({ [base]: legacy });
      for (const who of ["luis", "mary", undefined]) {
        expect(findHomeDraft(data, base, who, false)).toBeNull();
        expect(findHomeDraft(data, base, who, true)).toBeNull();
      }
      expect(data.getItem(base)).toBe(JSON.stringify(legacy));
    }
  });

  it("recovers a known owner's text and signed result, including a scoped draft predating the owner field", () => {
    const refs = [{ id: "mine", key: "https://signed.test/private", url: "https://signed.test/private" }];
    const saved = { prompt: "Private", referenceImages: refs };
    const data = store({ [base]: { ...saved, owner: "mary" }, [homeDraftKey(base, "luis")]: saved });
    expect(findHomeDraft(data, base, "mary", false)?.saved).toMatchObject(saved);
    expect(findHomeDraft(data, base, "luis", false)?.key).toBe(homeDraftKey(base, "luis"));
    expect(findHomeDraft(data, base, "sam", true)).toBeNull();
  });

  it("rejects mixed owners and invalid upload paths even when an owned key is present", () => {
    const own = { id: "a", key: "uploads/mary/one.png" };
    for (const second of [{ key: "uploads/luis/other.png" }, { key: "uploads/mary/../luis/file.png" }, { id: "unattributed-file" }]) {
      const data = store({ [base]: { keyframes: { first: own, middle: [second] } } });
      expect(findHomeDraft(data, base, "mary", false)).toBeNull();
    }
  });

  it("does not import a scoped guest's prompt to an account on an ordinary visit", () => {
    const guest = homeDraftKey(base);
    const data = store({ [guest]: { prompt: "Guest prompt" } });
    expect(findHomeDraft(data, base, "luis", false)).toBeNull();
    expect(findHomeDraft(data, base, "luis", true)?.key).toBe(guest);
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
