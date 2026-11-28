/**
 * "Generate" on the homepage hands the task to the image or video studio, which starts
 * it on arrival. The homepage stores a one-time token under this key in the
 * tab's sessionStorage (where the handed-over reference images also are) and
 * puts it in the address (?autostart=<token>); the studio starts only when the
 * two match and the token is fresh, deletes it first, and sends it as the
 * idempotency key for video; image requests reserve their own retry key.
 * A reload or Back finds no token, a link pasted into another
 * tab has none (and none of the images), and a repeated request is answered
 * with the first task, so nothing is charged twice.
 */
export const AUTOSTART_STORAGE_KEY = "aivd:autostart";
export const AUTOSTART_TTL_MS = 10 * 60 * 1000;

/** Takes the token if it matches; true at most once per token. */
export function claimAutostart(token: string | null, storage: Pick<Storage, "getItem" | "removeItem">, now = Date.now()): boolean {
  if (!token) return false;
  let saved: { token?: unknown; at?: unknown } | null = null;
  try {
    saved = JSON.parse(storage.getItem(AUTOSTART_STORAGE_KEY) || "null");
  } catch {
    saved = null;
  }
  if (!saved || saved.token !== token) return false;
  storage.removeItem(AUTOSTART_STORAGE_KEY);
  return typeof saved.at === "number" && now - saved.at >= 0 && now - saved.at < AUTOSTART_TTL_MS;
}
