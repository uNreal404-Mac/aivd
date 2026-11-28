type Localized = { zh: string; en: string };

export const SOUND_CATEGORIES = {
  interface: { zh: "界面", en: "Interface" },
  transition: { zh: "转场", en: "Transitions" },
  percussion: { zh: "打击", en: "Percussion" },
} as const;

export type SoundCategory = keyof typeof SOUND_CATEGORIES;

interface CanvasSound {
  id: string;
  url: string;
  name: Localized;
  description: Localized;
  category: SoundCategory;
  seconds: number;
}

export const CANVAS_SOUNDS: readonly CanvasSound[] = [
  {
    id: "soft-click", url: "/canvas/sounds/soft-click.wav", category: "interface", seconds: 0.18,
    name: { zh: "轻触", en: "Soft click" },
    description: { zh: "短促、干净的按键声。", en: "A short, dry button tap." },
  },
  {
    id: "glass-chime", url: "/canvas/sounds/glass-chime.wav", category: "interface", seconds: 1.2,
    name: { zh: "玻璃双音", en: "Glass chime" },
    description: { zh: "两声清亮的铃音，适合完成提示。", en: "Two clear bell notes for a completion cue." },
  },
  {
    id: "air-sweep", url: "/canvas/sounds/air-sweep.wav", category: "transition", seconds: 0.8,
    name: { zh: "掠风", en: "Air sweep" },
    description: { zh: "逐渐靠近、迅速消散的风声。", en: "A rising rush of air with a quick tail." },
  },
  {
    id: "tape-drop", url: "/canvas/sounds/tape-drop.wav", category: "transition", seconds: 0.65,
    name: { zh: "磁带减速", en: "Tape drop" },
    description: { zh: "音高平滑下滑，像磁带缓缓停转。", en: "A sliding pitch bend that winds down to a stop." },
  },
  {
    id: "wood-pair", url: "/canvas/sounds/wood-pair.wav", category: "percussion", seconds: 0.45,
    name: { zh: "木块双击", en: "Wood knocks" },
    description: { zh: "一高一低两下空心木块敲击。", en: "Two hollow wooden knocks at different pitches." },
  },
  {
    id: "low-impact", url: "/canvas/sounds/low-impact.wav", category: "percussion", seconds: 0.9,
    name: { zh: "低频落点", en: "Low impact" },
    description: { zh: "带有低音余振的沉重鼓点。", en: "A weighty drum hit with a low resonant tail." },
  },
];

// Persist the catalog ID only. A stored string can never supply a playback URL.
export function getCanvasSound(id?: string) {
  return CANVAS_SOUNDS.find((sound) => sound.id === id);
}
