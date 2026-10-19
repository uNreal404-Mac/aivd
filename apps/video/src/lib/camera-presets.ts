export interface CameraPreset {
  id: CameraPresetId;
  labelEn: string;
  labelZh: string;
  descriptionEn: string;
  descriptionZh: string;
  promptEn: string;
  promptZh: string;
  /** Seedance fixed_lens value this preset needs (true = lock camera). */
  fixedLens: boolean;
}

export const CAMERA_PRESET_IDS = [
  "static",
  "push-in",
  "pull-out",
  "pan-left",
  "pan-right",
  "tilt-up",
  "tilt-down",
  "truck-left",
  "truck-right",
  "orbit",
  "dive",
  "crane-up",
  "crane-down",
  "tracking",
  "handheld",
  "dolly-zoom",
  "tornado",
  "drone-aerial",
  "fpv",
] as const;

export type CameraPresetId = (typeof CAMERA_PRESET_IDS)[number];

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  {
    id: "static",
    labelEn: "Static",
    labelZh: "固定机位",
    descriptionEn: "A locked-off shot with no camera movement.",
    descriptionZh: "固定机位拍摄，镜头完全静止。",
    promptEn: "Locked-off static camera on a tripod, no camera movement.",
    promptZh: "固定机位，三脚架稳定拍摄，镜头不动。",
    fixedLens: true,
  },
  {
    id: "push-in",
    labelEn: "Push in",
    labelZh: "推镜头",
    descriptionEn: "Move the camera smoothly closer to the subject.",
    descriptionZh: "镜头平滑靠近主体，增强聚焦感。",
    promptEn: "Slow, smooth dolly push-in toward the subject.",
    promptZh: "镜头缓慢平稳地向主体推进。",
    fixedLens: false,
  },
  {
    id: "pull-out",
    labelEn: "Pull out",
    labelZh: "拉镜头",
    descriptionEn: "Move the camera smoothly away from the subject.",
    descriptionZh: "镜头平滑远离主体，展现环境。",
    promptEn: "Slow, smooth dolly pull-out away from the subject.",
    promptZh: "镜头缓慢平稳地从主体向后拉远。",
    fixedLens: false,
  },
  {
    id: "pan-left",
    labelEn: "Pan left",
    labelZh: "左摇",
    descriptionEn: "Rotate the camera horizontally to the left.",
    descriptionZh: "镜头水平向左摇摄。",
    promptEn: "Smooth pan to the left across the scene.",
    promptZh: "镜头平稳向左摇摄全景。",
    fixedLens: false,
  },
  {
    id: "pan-right",
    labelEn: "Pan right",
    labelZh: "右摇",
    descriptionEn: "Rotate the camera horizontally to the right.",
    descriptionZh: "镜头水平向右摇摄。",
    promptEn: "Smooth pan to the right across the scene.",
    promptZh: "镜头平稳向右摇摄全景。",
    fixedLens: false,
  },
  {
    id: "tilt-up",
    labelEn: "Tilt up",
    labelZh: "上摇",
    descriptionEn: "Tilt the camera upward.",
    descriptionZh: "镜头向上摇摄。",
    promptEn: "Smooth tilt upward, revealing more of the scene above.",
    promptZh: "镜头平稳向上摇摄，展现上方场景。",
    fixedLens: false,
  },
  {
    id: "tilt-down",
    labelEn: "Tilt down",
    labelZh: "下摇",
    descriptionEn: "Tilt the camera downward.",
    descriptionZh: "镜头向下摇摄。",
    promptEn: "Smooth tilt downward toward the lower part of the scene.",
    promptZh: "镜头平稳向下摇摄，聚焦下方场景。",
    fixedLens: false,
  },
  {
    id: "truck-left",
    labelEn: "Truck left",
    labelZh: "左移",
    descriptionEn: "Move the camera laterally to the left.",
    descriptionZh: "镜头向左横向移动。",
    promptEn: "Lateral truck left, keeping the subject centered.",
    promptZh: "镜头向左横移，保持主体居中。",
    fixedLens: false,
  },
  {
    id: "truck-right",
    labelEn: "Truck right",
    labelZh: "右移",
    descriptionEn: "Move the camera laterally to the right.",
    descriptionZh: "镜头向右横向移动。",
    promptEn: "Lateral truck right, keeping the subject centered.",
    promptZh: "镜头向右横移，保持主体居中。",
    fixedLens: false,
  },
  {
    id: "orbit",
    labelEn: "Orbit",
    labelZh: "环绕",
    descriptionEn: "Circle smoothly around the subject.",
    descriptionZh: "镜头围绕主体平稳环绕。",
    promptEn: "Smooth orbit around the subject, keeping it centered.",
    promptZh: "镜头环绕主体平稳运动，保持主体居中。",
    fixedLens: false,
  },
  {
    id: "dive",
    labelEn: "Dive",
    labelZh: "俯冲",
    descriptionEn: "Dive quickly toward the subject from above.",
    descriptionZh: "镜头从高处快速俯冲逼近主体。",
    promptEn: "Fast dive toward the subject from a high vantage point.",
    promptZh: "镜头从高处快速俯冲逼近主体。",
    fixedLens: false,
  },
  {
    id: "crane-up",
    labelEn: "Crane up",
    labelZh: "升镜头",
    descriptionEn: "Rise vertically with the camera.",
    descriptionZh: "镜头垂直上升。",
    promptEn: "Crane up smoothly, rising above the subject.",
    promptZh: "镜头平滑升起，越过主体向上运动。",
    fixedLens: false,
  },
  {
    id: "crane-down",
    labelEn: "Crane down",
    labelZh: "降镜头",
    descriptionEn: "Descend vertically with the camera.",
    descriptionZh: "镜头垂直下降。",
    promptEn: "Crane down smoothly, descending toward the subject.",
    promptZh: "镜头平滑下降，向主体靠近。",
    fixedLens: false,
  },
  {
    id: "tracking",
    labelEn: "Tracking",
    labelZh: "跟拍",
    descriptionEn: "Follow the subject's movement with the camera.",
    descriptionZh: "镜头跟随主体运动。",
    promptEn: "Tracking shot following the subject's movement.",
    promptZh: "跟拍镜头紧随主体运动。",
    fixedLens: false,
  },
  {
    id: "handheld",
    labelEn: "Handheld",
    labelZh: "手持",
    descriptionEn: "Handheld camera with natural movement and shake.",
    descriptionZh: "手持拍摄，带有自然晃动。",
    promptEn: "Handheld camera with subtle natural shake and movement.",
    promptZh: "手持拍摄，带有自然轻微晃动。",
    fixedLens: false,
  },
  {
    id: "dolly-zoom",
    labelEn: "Dolly zoom",
    labelZh: "希区柯克变焦",
    descriptionEn: "Camera moves back while zooming in for a Vertigo effect.",
    descriptionZh: "镜头后退同时变焦推近，营造希区柯克变焦效果。",
    promptEn: "Dolly zoom (Vertigo effect): camera moves back while zooming in, background stretches, subject stays the same size.",
    promptZh: "希区柯克变焦：镜头后退同时变焦推近，背景拉伸，主体大小不变。",
    fixedLens: false,
  },
  {
    id: "tornado",
    labelEn: "Tornado spin",
    labelZh: "龙卷风旋转",
    descriptionEn: "Camera spirals rapidly around the subject.",
    descriptionZh: "镜头围绕主体快速螺旋旋转。",
    promptEn: "Camera spins rapidly around the subject in a rising spiral, tornado-like motion.",
    promptZh: "镜头围绕主体快速螺旋上升旋转，如龙卷风般。",
    fixedLens: false,
  },
  {
    id: "drone-aerial",
    labelEn: "Drone aerial",
    labelZh: "无人机航拍",
    descriptionEn: "High-altitude aerial glide over the scene.",
    descriptionZh: "无人机高空平稳滑行俯瞰全景。",
    promptEn: "High-altitude drone aerial shot gliding forward over the scene.",
    promptZh: "无人机高空航拍，平稳向前滑行俯瞰全景。",
    fixedLens: false,
  },
  {
    id: "fpv",
    labelEn: "FPV fly-through",
    labelZh: "FPV穿越",
    descriptionEn: "Fast first-person drone flight through tight spaces.",
    descriptionZh: "FPV 第一人称高速穿越狭窄空间。",
    promptEn: "Fast FPV drone fly-through weaving close past obstacles.",
    promptZh: "FPV 无人机高速穿越，贴近障碍物灵活穿梭。",
    fixedLens: false,
  },
];

export function isCameraPresetId(v: unknown): v is CameraPresetId {
  return CAMERA_PRESET_IDS.includes(v as CameraPresetId);
}

export function getCameraPreset(id: string | null | undefined): CameraPreset | null {
  if (!id) {
    return null;
  }
  return CAMERA_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function containsCjk(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}

/** Models whose provider exposes a camera-lock switch (kie Seedance 1.5 Pro `fixed_lens`, https://docs.kie.ai/market/bytedance/seedance-1-5-pro). */
export const FIXED_LENS_MODELS: readonly string[] = ["seedance-1.5-pro"];

export function applyCameraPreset(args: {
  prompt: string;
  presetId?: string | null;
  modelId: string;
}): { prompt: string; fixedLens?: boolean; presetId: CameraPresetId | null } {
  const preset = getCameraPreset(args.presetId);
  if (!preset) {
    return { prompt: args.prompt, presetId: null };
  }

  const isZh = containsCjk(args.prompt);
  const fragment = isZh ? preset.promptZh : preset.promptEn;
  const fixedLens = FIXED_LENS_MODELS.includes(args.modelId)
    ? { fixedLens: preset.fixedLens }
    : {};

  if (args.prompt.includes(fragment)) {
    return {
      prompt: args.prompt,
      ...fixedLens,
      presetId: preset.id,
    };
  }

  const trimmed = args.prompt.trimEnd();
  let separator = "";

  if (trimmed.length > 0) {
    const endsWithSentencePunctuation = /[.!?。！？]$/.test(trimmed);
    if (endsWithSentencePunctuation) {
      separator = isZh ? "" : " ";
    } else {
      separator = isZh ? "。" : ". ";
    }
  }

  return {
    prompt: `${trimmed}${separator}${fragment}`,
    ...fixedLens,
    presetId: preset.id,
  };
}

export const CAMERA_PRESET_MAX_PROMPT_EXTRA = CAMERA_PRESETS.reduce(
  (max, preset) => Math.max(max, preset.promptEn.length, preset.promptZh.length),
  0,
);
