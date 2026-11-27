/** Files chosen before sign-in live in IndexedDB, never in sessionStorage. */
import { uploadWorkflowVideo } from "@/lib/creative-space/upload-video";
import { WAN_REFERENCE_MAX_BYTES, isWanVideoMime } from "@/lib/wan-video-references";
import { UploadError, uploadImage } from "@/lib/image-to-video";

export type PickerAsset = {
  id: string;
  name: string;
  mimeType: string;
  url: string;
  file?: File;
  size?: number;
  key?: string;
};

type StoredFile = { owner?: string; scope?: "canvas"; id: string; name: string; mimeType: string; file: File };
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

export async function listGuestAssets(owner?: string | null, scope: "global" | "canvas" | "all" = "global"): Promise<PickerAsset[]> {
  const db = await openDb();
  try {
    const rows = await new Promise<StoredFile[]>((resolve, reject) => {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as StoredFile[]);
      request.onerror = () => reject(request.error);
    });
    return rows.filter((row) => (!row.owner || row.owner === owner) && (scope === "all" || (row.scope ?? "global") === scope)).map((row) => ({ ...row, url: previewFor(row) }));
  } finally { db.close(); }
}

export async function saveGuestAsset(file: File, owner?: string | null, scope: "global" | "canvas" = "global"): Promise<PickerAsset> {
  const row: StoredFile = { ...(owner ? { owner } : {}), ...(scope === "canvas" ? { scope } : {}), id: crypto.randomUUID(), name: file.name, mimeType: file.type, file };
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

/**
 * Guest files need a server upload before a studio can submit their key.
 * Throws an UploadError (code "missing_item" or the upload's own code);
 * show it with uploadErrorText(error, lang).
 */
export async function readyPickerImage(asset: PickerAsset, expectedAccount?: string): Promise<{ key: string; name: string; url: string; sourceId: string }> {
  if (expectedAccount && asset.key?.startsWith("uploads/") && !asset.key.startsWith(`uploads/${expectedAccount}/`)) throw new UploadError("missing_item");
  if (asset.key) return { key: asset.key, name: asset.name, url: asset.url, sourceId: asset.id };
  if (!asset.file) throw new UploadError("missing_item");
  const result = await uploadImage(asset.file, fetch, expectedAccount);
  if (!result.ok) throw new UploadError(result.code);
  return { key: result.key, name: asset.name, url: result.url, sourceId: asset.id };
}

/** A reference video must resolve to the current user's stored upload. */
export async function readyPickerVideo(asset: PickerAsset, userId: string) {
  const size = asset.file?.size ?? asset.size;
  if (!userId || !isWanVideoMime(asset.mimeType) || (size !== undefined && (size <= 0 || size > WAN_REFERENCE_MAX_BYTES))) {
    throw new Error("Choose an MP4 or MOV up to 10 MB.");
  }
  const item = { name: asset.name, sourceId: asset.id, mimeType: asset.mimeType };
  if (asset.key?.startsWith(`uploads/${userId}/`)) return { ...item, key: asset.key, url: asset.url };
  if (!asset.file) throw new Error("The reference video must be your own upload.");
  return { ...item, ...await uploadWorkflowVideo(asset.file, fetch, userId) };
}
