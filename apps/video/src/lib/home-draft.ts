import { isOwnUploadKey } from "@/lib/image-url-allowlist";

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
