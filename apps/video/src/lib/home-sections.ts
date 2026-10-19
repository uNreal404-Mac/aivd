export type VfxPreset = {
  id: string;
  title: string;
};

export type CommunityProject = {
  id: string;
  title: string;
  author: string;
};

export const VFX_PRESETS: VfxPreset[] = [
  { id: "neon-rain", title: "Neon rain" },
  { id: "ink-bloom", title: "Ink bloom" },
  { id: "slow-dolly", title: "Slow dolly push" },
  { id: "film-grain", title: "Analog film grain" },
  { id: "golden-haze", title: "Golden hour haze" },
  { id: "deep-orbit", title: "Deep space orbit" },
  { id: "handheld", title: "Handheld energy" },
  { id: "product-spin", title: "Product spin" },
  { id: "chroma-pulse", title: "Chroma pulse" },
  { id: "paper-cut", title: "Paper cutout" },
  { id: "liquid-metal", title: "Liquid metal" },
  { id: "desert-dust", title: "Desert dust" },
  { id: "underwater-glow", title: "Underwater glow" },
  { id: "sketch-lines", title: "Sketch lines" },
  { id: "neon-outline", title: "Neon outline" },
];

export const COMMUNITY_PROJECTS: CommunityProject[] = [
  { id: "rooftop-dawn", title: "Rooftop at dawn", author: "Studio" },
  { id: "glass-city", title: "Glass city run", author: "Studio" },
  { id: "quiet-forest", title: "Quiet forest walk", author: "Studio" },
  { id: "neon-alley", title: "Neon alley chase", author: "Studio" },
  { id: "desert-train", title: "Desert train window", author: "Studio" },
  { id: "ocean-drift", title: "Ocean drift above", author: "Studio" },
  { id: "studio-portrait", title: "Studio portrait loop", author: "Studio" },
  { id: "midnight-market", title: "Midnight market stroll", author: "Studio" },
];

export const ASSISTANT_ROLES: string[] = [
  "Character builder",
  "Shot director",
  "Content planner",
  "Motion designer",
];

const GRADIENTS: string[] = [
  "radial-gradient(120% 120% at 20% 15%, var(--hfh-glow-a) 0%, transparent 55%), linear-gradient(150deg, var(--hfh-panel-3) 0%, var(--hfh-panel) 60%, var(--hfh-bg) 100%)",
  "radial-gradient(120% 120% at 80% 20%, var(--hfh-glow-b) 0%, transparent 50%), linear-gradient(160deg, var(--hfh-panel-3) 0%, var(--hfh-panel-2) 55%, var(--hfh-bg) 100%)",
  "radial-gradient(100% 100% at 50% 100%, var(--hfh-accent-soft) 0%, transparent 60%), linear-gradient(200deg, var(--hfh-panel-2) 0%, var(--hfh-panel) 50%, var(--hfh-bg) 100%)",
  "radial-gradient(120% 120% at 25% 80%, var(--hfh-glow-a) 0%, transparent 55%), linear-gradient(120deg, var(--hfh-panel-2) 0%, var(--hfh-panel) 60%, var(--hfh-bg) 100%)",
  "radial-gradient(110% 110% at 75% 25%, var(--hfh-glow-b) 0%, transparent 55%), linear-gradient(140deg, var(--hfh-panel-3) 0%, var(--hfh-panel-2) 60%, var(--hfh-bg) 100%)",
  "radial-gradient(120% 120% at 50% 20%, var(--hfh-accent-soft) 0%, transparent 60%), linear-gradient(180deg, var(--hfh-panel) 0%, var(--hfh-bg) 100%)",
];

export function gradientFor(index: number): string {
  const count = GRADIENTS.length;
  const safeIndex = ((Math.trunc(index) % count) + count) % count;

  return GRADIENTS[safeIndex] ?? "";
}

export function duplicateForMarquee<T>(items: T[]): T[] {
  return [...items, ...items];
}
