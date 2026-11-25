export const CANVAS_IMAGE_TOOLS = {
  inpaint: { zh: "局部重绘", en: "Inpaint" },
  cutout: { zh: "背景去除", en: "Remove background" },
  upscale: { zh: "高清放大", en: "Upscale" },
  outpaint: { zh: "扩图", en: "Expand image" },
} as const;

export type CanvasImageTool = keyof typeof CANVAS_IMAGE_TOOLS;
export type CanvasEditEntry = CanvasImageTool | "image";

export function readCanvasEditEntry(value: string | string[] | undefined): CanvasEditEntry | undefined {
  if (typeof value !== "string") return undefined;
  return value === "image" || Object.hasOwn(CANVAS_IMAGE_TOOLS, value) ? value as CanvasEditEntry : undefined;
}
