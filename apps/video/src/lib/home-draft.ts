import { isOwnUploadKey } from "@/lib/image-url-allowlist";

const SUBMITTED_DRAFT_KEY = "aivd:home-submitted-draft";

type HomeGenerationHandoff = {
  token: string;
  kind: "video" | "image";
  owner: string;
  base: string;
  draftKey: string;
  prompt: string;
  draftSnapshots?: string[];
};

/** Remember which homepage draft was sent to a studio without clearing it yet. */
export function rememberHomeGenerationDraft(
  storage: Pick<Storage, "setItem">,
  handoff: Omit<HomeGenerationHandoff, "draftSnapshots">,
  draftStores: Pick<Storage, "getItem">[],
) {
  const draftSnapshots = draftStores.flatMap((store) => {
    try { return store.getItem(handoff.draftKey) ?? []; }
    catch { return []; }
  });
  storage.setItem(SUBMITTED_DRAFT_KEY, JSON.stringify({ ...handoff, draftSnapshots }));
}

/** Clear only the submitted text after the studio has accepted the generation. */
export function clearSubmittedHomePrompt(
  handoffStorage: Pick<Storage, "getItem" | "removeItem">,
  draftStores: Pick<Storage, "getItem" | "setItem">[],
  submitted: Pick<HomeGenerationHandoff, "token" | "kind" | "owner" | "prompt">,
) {
  let handoff: HomeGenerationHandoff;
  try { handoff = JSON.parse(handoffStorage.getItem(SUBMITTED_DRAFT_KEY) || "null"); }
  catch { return false; }
  if (!handoff || handoff.token !== submitted.token || handoff.kind !== submitted.kind ||
      handoff.owner !== submitted.owner || handoff.prompt.trim() !== submitted.prompt.trim() ||
      handoff.draftKey !== homeDraftKey(handoff.base, handoff.owner)) return false;
  try { handoffStorage.removeItem(SUBMITTED_DRAFT_KEY); } catch { /* Optional draft storage. */ }
  let cleared = false;
  for (const storage of draftStores) {
    try {
      const raw = storage.getItem(handoff.draftKey);
      if (!raw) continue;
      const saved = JSON.parse(raw);
      if (!saved || saved.owner !== handoff.owner ||
          (saved.prompt?.trim() !== handoff.prompt.trim() && !handoff.draftSnapshots?.includes(raw))) continue;
      storage.setItem(handoff.draftKey, JSON.stringify({ ...saved, prompt: "", replaced: null }));
      cleared = true;
    } catch { /* A blocked or malformed draft should not affect generation. */ }
  }
  return cleared;
}

/** Guest work can be resumed after sign-in. Each account keeps its own private draft. */
export function homeDraftKey(base: string, owner?: string) {
  return owner ? `${base}:account:${owner}` : `${base}:guest`;
}

type StoredReferences = { videoReferences?: unknown; referenceImages?: unknown; keyframes?: { first?: unknown; middle?: unknown; last?: unknown } };
export function homeDraftReferences(saved: StoredReferences) {
  return [saved.videoReferences, saved.referenceImages, saved.keyframes?.middle, [saved.keyframes?.first, saved.keyframes?.last]]
    .flatMap(items => Array.isArray(items) ? items : []).filter(item => item != null);
}

export function findHomeDraft(storage: Pick<Storage, "getItem">, base: string, owner: string | undefined, resumeGuest: boolean) {
  const account = homeDraftKey(base, owner);
  const guest = homeDraftKey(base);
  const keys = owner ? (resumeGuest ? [guest, account, base] : [account, base]) : [guest];
  for (const key of keys) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object" || Array.isArray(saved) || (saved.owner && saved.owner !== owner)) continue;
      const refs = homeDraftReferences(saved);
      const ownUpload = (item: { key?: unknown }) => Boolean(owner && typeof item?.key === "string" && isOwnUploadKey(item.key, owner));
      if (refs.some(item => typeof item?.key === "string" && item.key.startsWith("uploads/") && !ownUpload(item))) continue;
      if (key === guest && (saved.owner || refs.some(item => item?.key || item?.url))) continue;
      // A bare legacy key predates account separation. Private text and local
      // file IDs carry no owner, even when the legacy draft has no attachments.
      if (key === base && !saved.owner && (!refs.length || !refs.every(ownUpload))) continue;
      return { key, raw, saved };
    } catch { /* Try the next available draft if this one is malformed. */ }
  }
  return null;
}
