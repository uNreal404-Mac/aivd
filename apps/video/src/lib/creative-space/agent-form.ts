import { hasOutput, outputType, type CanvasData, type GraphNode } from "./canvas-graph";
import { previewFrame } from "./upload-video";
import { listGuestAssets, type PickerAsset } from "../home-media-library";

/** JPEG sample ≤1024px for the Agent's visual input. */
async function visualSample(blob: Blob, label: string): Promise<File> {
  const bitmap = await createImageBitmap(blob);
  const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height, 1));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preview is unavailable.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  } finally { bitmap.close(); }
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!out) throw new Error("sample");
  return new File([out], `${label}__sample.jpg`, { type: "image/jpeg" });
}

export async function buildCanvasAgentForm({ instruction, locale, userId, inputs, sourceFor, fetchAsset }: {
  instruction: string;
  locale: string;
  userId?: string | null;
  inputs: GraphNode[];
  sourceFor: (data: CanvasData) => string | null;
  fetchAsset: typeof fetch;
}): Promise<FormData> {
  const assets = inputs.filter(({ data }) => hasOutput(data) && ["image", "video"].includes(outputType(data) ?? "")).slice(0, 8);
  const form = new FormData();
  form.set("action", "plan"); form.set("instruction", instruction); form.set("locale", locale);
  const guests = assets.some(({ data }) => data.kind === "media" && data.localId)
    ? await listGuestAssets(userId, "all").catch(() => [] as PickerAsset[]) : [];
  const described = [];
  for (const [index, { id, data }] of assets.entries()) {
    const label = String.fromCharCode(65 + index);
    const type = outputType(data) === "video" ? "video" : "image";
    let blob: Blob | undefined = data.kind === "media" && data.localId ? guests.find(asset => asset.id === data.localId)?.file : undefined;
    if (!blob) {
      const url = sourceFor(data);
      if (!url) continue;
      const response = await fetchAsset(url);
      if (!response.ok) continue;
      blob = await response.blob();
    }
    const still = type === "video" ? await previewFrame(new File([blob], `${label}.mp4`, { type: blob.type || "video/mp4" })) : blob;
    form.append("visual", await visualSample(still, label));
    described.push({ id, label, name: (data.title || label).slice(0, 300), type });
  }
  form.set("assets", JSON.stringify(described));
  return form;
}
