export const VIDEO_EDIT_MODEL = "kling-3.0-omni/transformation";
export const VIDEO_MOTION_MODEL = "kling-3.0/motion-control";
export type VideoTool = "edit" | "motion";
export type VideoToolSource = {
  sourceVideoKey?: string;
  sourceVideoUuid?: string;
};
export type VideoToolOrientation = "image" | "video";
export const videoToolModel = (tool: VideoTool) =>
  tool === "edit" ? VIDEO_EDIT_MODEL : VIDEO_MOTION_MODEL;
export const isMeasuredVideoTool = (model: string) =>
  model === VIDEO_EDIT_MODEL || model === VIDEO_MOTION_MODEL;
export type VideoToolSubmit = VideoToolSource & {
  model: string;
  prompt: string;
  duration: number;
  expectedCredits: number;
  quality: string;
  characterKey?: string;
  orientation?: VideoToolOrientation;
};

/** Specific guard failures shared by the preflight and submission forms. */
export function videoToolMessage(
  code: string | undefined,
  fallback: string,
  zh: boolean,
) {
  if (!zh) return fallback;
  const messages: Record<string, string> = {
    EDIT_CLIP_FORMAT:
      "请选择 3–15.5 秒、24–60 fps 的视频。每边 700–4553 像素，总像素不超过 829 万，宽高比在 2:5 至 2:1 之间。",
    MOTION_CLIP_FORMAT:
      "动作视频须为 3–30 秒，每边大于 340 像素，宽高比在 2:5 至 5:2 之间。",
    CHARACTER_IMAGE_FORMAT:
      "角色图每边须大于 340 像素，宽高比在 2:5 至 5:2 之间。",
    INVALID_TOOL_SOURCE:
      "请重新选择自己账户中可用的素材。支持 MP4、MOV 视频及 PNG、JPEG 角色图。",
    TOOL_SOURCE_UNVERIFIED: "当前无法核验原文件，请稍后重新选择素材。",
    VIDEO_QUOTE_CHANGED: "原片时长或报价已变动，请刷新查看最新报价后再生成。",
    TOOL_PROVIDER_REJECTED:
      "服务商未受理这组素材或参数，已释放冻结积分。可调整素材后再次提交。",
  };
  return messages[code ?? ""] ?? fallback;
}
