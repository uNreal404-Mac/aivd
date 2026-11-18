// Camera-move presets for the video studio. Picking one adds its camera
// direction to the prompt that is sent, so it works with every model.

export type VideoPreset = {
  id: string;
  zh: string;
  en: string;
  /** Camera direction appended to the prompt, in English for the models. */
  prompt: string;
  image: string;
  /** Hover animation on the thumbnail that hints at the move. */
  motion: "push" | "pull" | "pan" | "orbit" | "rise" | "tilt" | "shake" | "drift";
};

const S = (name: string) => `/home/samples/${name}.webp`;

export const VIDEO_PRESETS: VideoPreset[] = [
  { id: "push-in", zh: "缓慢推近", en: "Slow push-in", prompt: "Camera slowly pushes in toward the subject.", image: S("rain-couple"), motion: "push" },
  { id: "pull-out", zh: "拉远揭示", en: "Pull-out reveal", prompt: "Camera pulls back to reveal the wider scene.", image: S("mountain-valley"), motion: "pull" },
  { id: "orbit", zh: "环绕主体", en: "Orbit", prompt: "Camera orbits smoothly around the subject.", image: S("dancer"), motion: "orbit" },
  { id: "tracking", zh: "横移跟拍", en: "Tracking shot", prompt: "Camera tracks sideways alongside the subject.", image: S("autumn-walk"), motion: "pan" },
  { id: "crane-up", zh: "升起航拍", en: "Crane up", prompt: "Camera cranes up into a high aerial view.", image: S("storm-sea"), motion: "rise" },
  { id: "tilt-up", zh: "仰摇揭示", en: "Tilt up", prompt: "Camera tilts up from the ground to reveal the subject.", image: S("mech-warrior"), motion: "tilt" },
  { id: "handheld", zh: "手持纪实", en: "Handheld", prompt: "Handheld camera with natural, slight shake.", image: S("boy-and-dog"), motion: "shake" },
  { id: "dolly-zoom", zh: "希区柯克变焦", en: "Dolly zoom", prompt: "Dolly zoom: the background stretches while the subject stays fixed.", image: S("tomb-light"), motion: "drift" },
];

export function findVideoPreset(id: string | undefined | null): VideoPreset | undefined {
  return id ? VIDEO_PRESETS.find((preset) => preset.id === id) : undefined;
}

/** The prompt to send: the user's text plus the preset's camera direction. */
export function promptWithPreset(prompt: string, presetId: string | undefined | null): string {
  const text = prompt.trim();
  const preset = findVideoPreset(presetId);
  if (!preset || !text) return text;
  const joiner = /[.!?。！？]$/.test(text) ? " " : ". ";
  return `${text}${joiner}${preset.prompt}`;
}
