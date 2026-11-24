import { localizedHref } from "@/lib/locale-path";

export const EFFECT_CATEGORIES = [
  "all",
  "camera",
  "transform",
  "atmosphere",
  "style",
  "motion",
] as const;

export type EffectsCategory = (typeof EFFECT_CATEGORIES)[number];

export type NonAllCategory = Exclude<EffectsCategory, "all">;

export type LocalizedText = {
  en: string;
  zh: string;
};

export type EffectTemplate = {
  id: string;
  category: NonAllCategory;
  name: LocalizedText;
  description: LocalizedText;
  prompt: string;
  /** The same prompt in Chinese, used on the Chinese pages. */
  promptZh?: string;
  image: string;
  badge?: "new";
};

export type EffectsCopy = {
  title: string;
  heading: string;
  sub: string;
  use: string;
  newBadge: string;
  empty: string;
};

export const CATEGORY_LABELS: Record<EffectsCategory, LocalizedText> = {
  all: { en: "All", zh: "全部" },
  camera: { en: "Camera moves", zh: "镜头运动" },
  transform: { en: "Transform", zh: "变形" },
  atmosphere: { en: "Atmosphere", zh: "氛围" },
  style: { en: "Style", zh: "风格" },
  motion: { en: "Motion", zh: "动作" },
};

export const PRESET_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

export const EFFECT_TEMPLATES: EffectTemplate[] = [
  {
    id: "slow-push-in",
    category: "camera",
    name: { en: "Slow Push In", zh: "缓慢推进" },
    description: {
      en: "Glide toward the subject for a calm, cinematic reveal.",
      zh: "镜头缓缓推近主体，营造平静的电影式开场。",
    },
    prompt:
      "Slowly push the camera toward the subject with a steady, smooth motion and a shallow depth of field, keeping the framing centered.",
    promptZh: "镜头平稳、缓慢地推近主体，浅景深，构图保持居中。",
    image: "/effects/effect-01.webp",
    badge: "new",
  },
  {
    id: "orbit-reveal",
    category: "camera",
    name: { en: "Orbit Reveal", zh: "环绕揭示" },
    description: {
      en: "Circle the subject to reveal its depth and shape.",
      zh: "围绕主体环绕拍摄，展现立体与轮廓。",
    },
    prompt:
      "Circle the camera around the subject in a smooth half orbit, revealing its depth and shape under consistent lighting.",
    promptZh: "镜头绕主体平滑地转半圈，在统一的光线下展现它的立体感和轮廓。",
    image: "/effects/effect-02.webp",
  },
  {
    id: "crash-zoom",
    category: "camera",
    name: { en: "Crash Zoom", zh: "急速变焦" },
    description: {
      en: "Snap a fast zoom to punch up a moment.",
      zh: "瞬间快速变焦，强化画面的冲击力。",
    },
    prompt:
      "Rapidly zoom the camera toward the subject in a single decisive move to add sudden impact.",
    promptZh: "镜头一下子快速推向主体，一气呵成，制造突然的冲击感。",
    image: "/effects/effect-03.webp",
  },
  {
    id: "dolly-drift",
    category: "camera",
    name: { en: "Dolly Drift", zh: "平移漂移" },
    description: {
      en: "Slide sideways at an even pace for a dreamy glide.",
      zh: "横向匀速滑移，带来梦幻般的漂移感。",
    },
    prompt:
      "Drift the camera sideways at a constant speed while keeping the horizon level for a soft, dreamy glide.",
    promptZh: "镜头匀速横向漂移，地平线保持水平，画面轻柔梦幻。",
    image: "/effects/effect-04.webp",
  },
  {
    id: "melt-away",
    category: "transform",
    name: { en: "Melt Away", zh: "融化消散" },
    description: {
      en: "Let the subject soften and melt into the frame.",
      zh: "让主体逐渐软化并融化进画面。",
    },
    prompt:
      "Make the subject soften and melt downward into liquid drips, dissolving gradually into the background.",
    promptZh: "主体慢慢变软，向下融化成液滴，逐渐消散进背景里。",
    image: "/effects/effect-05.webp",
  },
  {
    id: "paper-fold",
    category: "transform",
    name: { en: "Paper Fold", zh: "折纸变形" },
    description: {
      en: "Fold the scene like paper to change its shape.",
      zh: "像折纸一样折叠画面，改变其形状。",
    },
    prompt:
      "Fold the scene like a sheet of paper along crisp creases, transforming its shape in smooth stages.",
    promptZh: "把画面像一张纸那样沿清晰的折痕折起来，分几步平滑地变形。",
    image: "/effects/effect-06.webp",
  },
  {
    id: "liquid-morph",
    category: "transform",
    name: { en: "Liquid Morph", zh: "液态变形" },
    description: {
      en: "Reshape one form into another like liquid.",
      zh: "如液体般将一个形态重塑为另一个。",
    },
    prompt:
      "Morph one shape smoothly into another with a glossy liquid surface that ripples gently through the transition.",
    promptZh: "一个形状平滑地变成另一个形状，表面像光亮的液体，过渡时轻轻泛起涟漪。",
    image: "/effects/effect-07.webp",
  },
  {
    id: "neon-rain",
    category: "atmosphere",
    name: { en: "Neon Rain", zh: "霓虹雨" },
    description: {
      en: "Add glowing rain and reflected neon light.",
      zh: "加入发光雨丝与霓虹光的倒影。",
    },
    prompt:
      "Add falling neon rain with glowing droplets and colorful reflections that light up the whole scene.",
    promptZh: "加入落下的霓虹雨，发光的雨滴和彩色倒影把整个画面点亮。",
    image: "/effects/effect-08.webp",
  },
  {
    id: "golden-dust",
    category: "atmosphere",
    name: { en: "Golden Dust", zh: "金色尘埃" },
    description: {
      en: "Float warm golden particles through the air.",
      zh: "让温暖的金色微粒在空气中飘浮。",
    },
    prompt:
      "Fill the air with slow-floating golden dust particles that catch a warm, soft light.",
    promptZh: "空气里飘着缓慢浮动的金色微尘，映着温暖柔和的光。",
    image: "/effects/effect-09.webp",
    badge: "new",
  },
  {
    id: "fog-roll",
    category: "atmosphere",
    name: { en: "Fog Roll", zh: "雾气翻滚" },
    description: {
      en: "Roll soft fog across the scene for depth.",
      zh: "让柔和的雾气在画面中滚动，增加层次。",
    },
    prompt:
      "Roll soft layers of fog across the scene, adding depth and a quiet, mysterious mood.",
    promptZh: "柔和的雾一层层漫过画面，增加纵深，气氛安静而神秘。",
    image: "/effects/effect-10.webp",
  },
  {
    id: "ink-wash",
    category: "style",
    name: { en: "Ink Wash", zh: "水墨晕染" },
    description: {
      en: "Render the frame in flowing ink brush strokes.",
      zh: "以流动的水墨笔触渲染画面。",
    },
    prompt:
      "Render the frame as flowing ink wash brush strokes with soft bleeding edges and a paper texture.",
    promptZh: "把画面变成流动的水墨笔触，边缘轻轻晕开，带纸张纹理。",
    image: "/effects/effect-11.webp",
  },
  {
    id: "pixel-pop",
    category: "style",
    name: { en: "Pixel Pop", zh: "像素跃动" },
    description: {
      en: "Turn the image into bold, colorful pixels.",
      zh: "把画面变成大胆鲜艳的像素块。",
    },
    prompt:
      "Convert the image into bold, colorful pixel art with crisp square blocks and a lively palette.",
    promptZh: "把画面变成色彩鲜明的像素画，方块清晰利落，配色活泼。",
    image: "/effects/effect-12.webp",
  },
  {
    id: "claymation",
    category: "style",
    name: { en: "Claymation", zh: "黏土定格" },
    description: {
      en: "Sculpt the scene into stop-motion clay.",
      zh: "把画面塑造成定格黏土的质感。",
    },
    prompt:
      "Sculpt the scene into soft stop-motion clay with visible fingerprints and a gentle frame-by-frame motion.",
    promptZh: "把场景做成柔软的定格黏土动画，能看到指纹痕迹，动作一帧一帧地轻轻变化。",
    image: "/effects/effect-13.webp",
    badge: "new",
  },
  {
    id: "float-up",
    category: "motion",
    name: { en: "Float Up", zh: "向上漂浮" },
    description: {
      en: "Lift the subject gently upward as it rises.",
      zh: "让主体轻轻向上漂浮升起。",
    },
    prompt:
      "Lift the subject gently upward so it floats and rises with a light, weightless motion.",
    promptZh: "主体轻轻向上浮起，动作轻盈，像没有重量一样。",
    image: "/effects/effect-14.webp",
  },
  {
    id: "wind-sweep",
    category: "motion",
    name: { en: "Wind Sweep", zh: "疾风扫过" },
    description: {
      en: "Send a gust sweeping through hair and cloth.",
      zh: "让一阵疾风扫过发丝与衣物。",
    },
    prompt:
      "Sweep a strong gust of wind through hair and cloth, bending them in one flowing direction.",
    promptZh: "一阵强风吹过，头发和衣服都朝同一个方向飘动。",
    image: "/effects/effect-15.webp",
  },
  {
    id: "freeze-burst",
    category: "motion",
    name: { en: "Freeze Burst", zh: "骤停爆发" },
    description: {
      en: "Freeze the action mid-burst for a dramatic beat.",
      zh: "在爆发瞬间冻结动作，制造戏剧性停顿。",
    },
    prompt:
      "Freeze the action at the peak of a burst, holding the particles suspended for a dramatic beat.",
    promptZh: "在爆发最强的一瞬间定格，粒子悬停在空中，留出一个戏剧性的停顿。",
    image: "/effects/effect-16.webp",
  },
];

export function filterEffects(
  items: EffectTemplate[],
  category: EffectsCategory,
): EffectTemplate[] {
  if (category === "all") {
    return items;
  }
  return items.filter((item) => item.category === category);
}

export function presetHref(lang: string, template: EffectTemplate): string {
  const prompt = lang.toLowerCase().startsWith("zh") && template.promptZh ? template.promptZh : template.prompt;
  return localizedHref(lang, `/ai/video?preset=${encodeURIComponent(template.id)}&prompt=${encodeURIComponent(prompt)}`);
}

export const EFFECTS_COPY: Record<"en" | "zh", EffectsCopy> = {
  en: {
    title: "Effects",
    heading: "Effects",
    sub: "Pick a ready-made look or camera move, then make it yours in the studio.",
    use: "Use",
    newBadge: "New",
    empty: "No effects in this category yet.",
  },
  zh: {
    title: "特效",
    heading: "特效模板",
    sub: "挑一个现成的风格或镜头运动，再到创作页按你的想法调整。",
    use: "使用",
    newBadge: "新",
    empty: "该分类暂无特效",
  },
};

export function copyFor(locale: string): EffectsCopy {
  return locale === "zh" ? EFFECTS_COPY.zh : EFFECTS_COPY.en;
}

export function labelFor(text: LocalizedText, locale: string): string {
  return locale === "zh" ? text.zh : text.en;
}
