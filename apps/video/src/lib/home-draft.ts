/** Guest work can be resumed after sign-in. Each account keeps its own private draft. */
export function homeDraftKey(base: string, owner?: string) {
  return owner ? `${base}:account:${owner}` : `${base}:guest`;
}

export function findHomeDraft(storage: Pick<Storage, "getItem">, base: string, owner: string | undefined, resumeGuest: boolean) {
  const account = homeDraftKey(base, owner);
  const guest = homeDraftKey(base);
  const keys = owner && resumeGuest ? [guest, account, base] : [account, guest, base];
  for (const key of new Set(keys)) {
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== "object" || Array.isArray(saved) || (saved.owner && saved.owner !== owner)) continue;
      if (key !== account || !owner || !saved.owner) {
        // An older unscoped URL could be a different account's signed result.
        const refs = [saved.videoReferences, saved.referenceImages, saved.keyframes?.middle, [saved.keyframes?.first, saved.keyframes?.last]].flatMap((items) => Array.isArray(items) ? items : []);
        if (refs.some((item) => (item?.key || item?.url) && !(owner && typeof item.key === "string" && item.key.startsWith(`uploads/${owner}/`)))) continue;
      }
      return { key, raw, saved };
    } catch { /* Try the next available draft if this one is malformed. */ }
  }
  return null;
}
