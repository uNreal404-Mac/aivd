/** A canvas download keeps the original files and works offline for local assets. */
export async function canvasZip(files: { title: string; blob: Blob }[]) {
  const { zipSync } = await import("fflate");
  const entries: Record<string, Uint8Array> = Object.create(null);
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a", "text/plain": "txt" };
  for (const [i, { title, blob }] of files.entries()) {
    const safe = title.replace(/[\\/:*?"<>|\p{Cc}]/gu, "_").trim().slice(0, 90) || "asset";
    const match = /\.([a-z0-9]{1,5})$/i.exec(safe);
    const extension = extensions[blob.type.split(";")[0]] ?? match?.[1] ?? "bin";
    const stem = match ? safe.slice(0, match.index) : safe;
    entries[`${String(i + 1).padStart(2, "0")}-${stem}.${extension}`] = new Uint8Array(await blob.arrayBuffer());
  }
  return new Blob([new Uint8Array(zipSync(entries, { level: 0 })).buffer], { type: "application/zip" });
}
