import { getMarketModel } from "@/ai/kie-market";

// The same limits generateMedia enforces on the server, checked before a
// request leaves the page so the user sees what to change instead of a 400.
export type MarketInputProblem =
  | { code: "needs_image" }
  | { code: "too_short"; min: number }
  | { code: "too_long"; max: number; length: number };

export function marketInputProblem(modelId: string, input: { prompt: string; imageCount: number }): MarketInputProblem | null {
  const model = getMarketModel(modelId);
  if (!model) return null;
  const { requiresImage, minPromptLength, maxPromptLength } = model.options;
  if (requiresImage && input.imageCount === 0) return { code: "needs_image" };
  if (minPromptLength && input.prompt.trim().length < minPromptLength) return { code: "too_short", min: minPromptLength };
  if (maxPromptLength && input.prompt.length > maxPromptLength) return { code: "too_long", max: maxPromptLength, length: input.prompt.length };
  return null;
}

export function marketInputMessage(problem: MarketInputProblem, modelName: string, zh: boolean): string {
  switch (problem.code) {
    case "needs_image":
      return zh ? `${modelName} 需要先添加一张图片作为首帧，再生成。` : `${modelName} needs a start image. Add one before generating.`;
    case "too_short":
      return zh ? `${modelName} 的提示词至少要 ${problem.min} 个字，请再多写几句。` : `${modelName} needs a prompt of at least ${problem.min} characters.`;
    case "too_long":
      return zh
        ? `${modelName} 的提示词最多 ${problem.max} 个字，现在有 ${problem.length} 个，请删减后再生成。`
        : `${modelName} accepts up to ${problem.max} characters; this prompt has ${problem.length}. Shorten it first.`;
  }
}

// Check a request against its model; returns the message to show, or null.
export function marketInputNotice(modelId: string, input: { prompt: string; imageCount: number }, zh: boolean): string | null {
  const problem = marketInputProblem(modelId, input);
  return problem ? marketInputMessage(problem, getMarketModel(modelId)?.name ?? modelId, zh) : null;
}

type ImageRef = { url?: string | null; mimeType?: string | null; name?: string | null; file?: File | null };

const EXTENSION_TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

function imageType(ref: ImageRef): string | undefined {
  const known = ref.mimeType || ref.file?.type;
  if (known) return known;
  const extension = (ref.name || ref.url || "").split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  return extension ? EXTENSION_TYPES[extension] : undefined;
}

function imageSize(ref: ImageRef): Promise<{ width: number; height: number } | null> {
  const source = ref.file ? URL.createObjectURL(ref.file) : ref.url;
  if (!source || typeof Image === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const done = (size: { width: number; height: number } | null) => {
      if (settled) return;
      settled = true;
      if (ref.file) URL.revokeObjectURL(source);
      resolve(size);
    };
    // A slow image does not hold up the submit.
    setTimeout(() => done(null), 5000);
    image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => done(null);
    image.src = source;
  });
}

const TYPE_LABELS: Record<string, string> = { "image/jpeg": "JPG", "image/png": "PNG", "image/webp": "WebP", "image/gif": "GIF" };

// Image types and sizes a model rejects. An image whose type or size cannot be
// read is let through; KIE still checks it and a rejected task is refunded.
export async function marketImageNotice(modelId: string, refs: ImageRef[], zh: boolean): Promise<string | null> {
  const model = getMarketModel(modelId);
  if (!model || !refs.length) return null;
  const { imageTypes, minImageSide } = model.options;
  if (imageTypes) {
    const index = refs.findIndex((ref) => {
      const type = imageType(ref);
      return Boolean(type?.startsWith("image/")) && !imageTypes.includes(type!);
    });
    if (index >= 0) {
      const allowed = imageTypes.map((type) => TYPE_LABELS[type] ?? type).join(zh ? " 和 " : " and ");
      const found = TYPE_LABELS[imageType(refs[index])!] ?? imageType(refs[index]);
      return zh
        ? `${model.name} 只支持 ${allowed} 图片，第 ${index + 1} 张是 ${found}，请换一张或换个模型。`
        : `${model.name} accepts ${allowed} images only; image ${index + 1} is ${found}. Replace it or choose another model.`;
    }
  }
  if (minImageSide) {
    const sizes = await Promise.all(refs.map(imageSize));
    const index = sizes.findIndex((size) => size !== null && (size.width < minImageSide || size.height < minImageSide));
    if (index >= 0) {
      const size = sizes[index]!;
      return zh
        ? `${model.name} 要求图片的宽和高都至少 ${minImageSide} 像素，第 ${index + 1} 张只有 ${size.width}×${size.height}，请换一张清晰些的。`
        : `${model.name} needs images at least ${minImageSide}px on each side; image ${index + 1} is ${size.width}×${size.height}.`;
    }
  }
  return null;
}
