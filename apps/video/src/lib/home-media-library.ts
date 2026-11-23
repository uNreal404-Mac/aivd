/** Files chosen before sign-in live in IndexedDB, never in sessionStorage. */
export type PickerAsset = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  file?: File;
  key?: string;
};

type StoredFile = { id: string; name: string; mimeType: string; file: File };
const DB_NAME = "aivd-home-library";
const STORE = "files";
const previewUrls = new Map<string, string>();
function previewFor(row: StoredFile): string {
  let url = previewUrls.get(row.id);
  if (!url) { url = URL.createObjectURL(row.file); previewUrls.set(row.id, url); }
  return url;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listGuestAssets(): Promise<PickerAsset[]> {
  const db = await openDb();
  try {
    const rows = await new Promise<StoredFile[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as StoredFile[]);
      request.onerror = () => reject(request.error);
    });
    return rows.map((row) => ({ ...row, url: previewFor(row) }));
  } finally { db.close(); }
}

export async function saveGuestAsset(file: File): Promise<PickerAsset> {
  const row: StoredFile = { id: crypto.randomUUID(), name: file.name, mimeType: file.type, file };
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(row);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    return { ...row, url: previewFor(row) };
  } finally { db.close(); }
}

export async function removeGuestAsset(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, "readwrite").objectStore(STORE).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); const url = previewUrls.get(id); if (url) URL.revokeObjectURL(url); previewUrls.delete(id); }
}

/** Refresh signed upload previews after a visitor returns from checkout. */
export async function currentUploadUrls(): Promise<Map<string, string>> {
  try {
    const response = await fetch("/api/v1/library", { cache: "no-store" });
    if (!response.ok) return new Map();
    const body = await response.json();
    const assets = body?.data?.assets;
    if (!Array.isArray(assets)) return new Map();
    return new Map(assets.filter((asset) => typeof asset?.key === "string" && typeof asset?.url === "string").map((asset) => [asset.key, asset.url]));
  } catch { return new Map(); }
}
