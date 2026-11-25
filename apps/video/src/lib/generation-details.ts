import { findVideoPreset } from "@/lib/video-presets";

/** Settings saved with a generation. Older rows may only have a few fields. */
export type GenerationParameters = Record<string, unknown>;

export type GenerationDetail = { label: string; value: string };

const nonempty = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export function generationDetails(
  kind: "image" | "video",
  model: string | undefined,
  parameters: GenerationParameters | null | undefined,
  zh: boolean,
): GenerationDetail[] {
  const rows: GenerationDetail[] = [];
  const add = (zhLabel: string, enLabel: string, value: string | undefined) => {
    if (value) rows.push({ label: zh ? zhLabel : enLabel, value });
  };
  add("模型", "Model", nonempty(model));
  if (!parameters) return rows;

  const mode = nonempty(parameters.mode);
  const modes: Record<string, [string, string]> = {
    "text-to-video": ["文生视频", "Text to video"],
    "image-to-video": ["图生视频", "Image to video"],
    "reference-to-video": ["参考生视频", "Reference to video"],
  };
  if (kind === "video" && mode) add("生成方式", "Mode", modes[mode]?.[zh ? 0 : 1] ?? mode);
  const preset = nonempty(parameters.preset);
  if (kind === "video" && preset) {
    const known = findVideoPreset(preset);
    add("镜头预设", "Camera preset", known ? (zh ? known.zh : known.en) : preset);
  }
  add("画面比例", "Aspect ratio", nonempty(parameters.aspectRatio));
  add("分辨率", "Resolution", nonempty(parameters.resolution) ?? nonempty(parameters.quality));
  if (kind === "video" && typeof parameters.duration === "number" && Number.isFinite(parameters.duration)) {
    add("时长", "Duration", `${parameters.duration}${zh ? " 秒" : "s"}`);
  }
  const audio = typeof parameters.audio === "boolean" ? parameters.audio :
    typeof parameters.generateAudio === "boolean" ? parameters.generateAudio : undefined;
  if (kind === "video" && audio !== undefined) add("声音", "Audio", audio ? (zh ? "开启" : "On") : (zh ? "关闭" : "Off"));
  if (kind === "image" && typeof parameters.count === "number" && Number.isFinite(parameters.count)) {
    add("生成张数", "Images", `${parameters.count}`);
  }
  const references = Array.isArray(parameters.imageUrls) ? parameters.imageUrls.length :
    parameters.imageUrl ? 1 : 0;
  const videoReferences = Array.isArray(parameters.videoKeys) ? parameters.videoKeys.length : 0;
  const frames = parameters.keyframes && typeof parameters.keyframes === "object" ? parameters.keyframes as Record<string, unknown> : null;
  const frameCount = frames ? Number(Boolean(frames.first)) + Number(Boolean(frames.last)) + (Array.isArray(frames.middle) ? frames.middle.length : 0) : 0;
  const total = references + videoReferences + frameCount;
  if (total) add("参考素材", "References", `${total}`);
  return rows;
}
