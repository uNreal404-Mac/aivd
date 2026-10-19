/**
 * Data for the aivd.ai homepage (see spec.md, apps/video).
 * Locale-free hrefs only (see "Allowed hrefs"); prefix with localizedHref().
 */

const img = (seed: string) => `/home/${seed}.webp`;

export type CtaVariant = "primary" | "outline" | "text";

export interface Cta {
  label: string;
  href: string;
  icon: string;
  variant: CtaVariant;
}

export interface SectionHeader {
  eyebrow: string;
  title: string;
  /** Tail of `title` rendered in the accent color. */
  accent: string;
  desc: string;
}

export interface HeroCard {
  image: string;
  alt: string;
  caption: string;
  size: "large" | "small";
}

export interface CategoryCard {
  id: string;
  title: string;
  category: string;
  image: string;
  alt: string;
}

export interface ModelCard {
  id: string;
  title: string;
  icon: string;
  description: string;
  href: string;
  image: string;
  alt: string;
}

export interface EffectCard {
  id: string;
  title: string;
  image: string;
  alt: string;
  href: string;
}

export interface Step {
  number: string;
  title: string;
  icon: string;
  description: string;
}

export const HERO = {
  eyebrow: "AI studio · Write · Animate · Discover",
  titleLead: "Bring stories",
  titleAccent: "to life.",
  subtitle:
    "aivd.ai turns a single sentence into cinematic clips, pictures and whole worlds — no camera required.",
  ctas: [
    {
      label: "Start Creating",
      href: "/text-to-video",
      icon: "Sparkles",
      variant: "primary",
    },
    {
      label: "Try a Sample",
      href: "/image-to-video",
      icon: "Play",
      variant: "outline",
    },
    {
      label: "Watch Video",
      href: "#",
      icon: "CirclePlay",
      variant: "text",
    },
  ] as Cta[],
};

export const HERO_CARDS: HeroCard[] = [
  {
    image: img("portrait-girl"),
    alt: "Portrait lit by violet studio light",
    caption: "Tomorrow starts with one idea.",
    size: "large",
  },
  {
    image: img("neon-city"),
    alt: "Neon city street at night",
    caption: "New worlds waiting.",
    size: "small",
  },
  {
    image: img("astronaut"),
    alt: "Astronaut drifting above a planet",
    caption: "Push past limits.",
    size: "small",
  },
];

export const TOOL_CHIPS: Cta[] = [
  { label: "Text to Video", href: "/text-to-video", icon: "Clapperboard", variant: "outline" },
  { label: "Image to Video", href: "/image-to-video", icon: "ImagePlus", variant: "outline" },
  { label: "Image Generation", href: "#", icon: "Image", variant: "outline" },
  { label: "More Tools", href: "#", icon: "LayoutGrid", variant: "outline" },
];

export const CATEGORY_HEADER: SectionHeader = {
  eyebrow: "Explore ideas",
  title: "Find your next direction.",
  accent: "next direction.",
  desc: "From film-style shots to anime worlds — see what the community is making.",
};

export const CATEGORY_FILTERS: string[] = [
  "All",
  "Cinematic",
  "Anime",
  "Portrait",
  "Fantasy",
  "Sci-Fi",
  "Nature",
  "Stylize",
  "More",
];

export const CATEGORY_CARDS: CategoryCard[] = [
  { id: "golden-hour", title: "Golden Hour", category: "Cinematic", image: img("golden-hour"), alt: "Golden hour light across a field" },
  { id: "neon-streets", title: "Neon Streets", category: "Sci-Fi", image: img("neon-streets"), alt: "Neon signs reflected on wet asphalt" },
  { id: "liquid-light", title: "Liquid Light", category: "Stylize", image: img("liquid-light"), alt: "Liquid light swirls in violet tones" },
  { id: "coast-drive", title: "Coast Drive", category: "Cinematic", image: img("coast-drive"), alt: "Road along a coastal cliff" },
  { id: "first-steps", title: "First Steps", category: "Anime", image: img("first-steps"), alt: "Anime style figure walking at dawn" },
  { id: "silver-muse", title: "Silver Muse", category: "Portrait", image: img("silver-muse"), alt: "Studio portrait in silver tones" },
  { id: "glass-city", title: "Glass City", category: "Sci-Fi", image: img("glass-city"), alt: "Glass towers under a violet sky" },
  { id: "edge-of-space", title: "Edge of Space", category: "Fantasy", image: img("edge-of-space"), alt: "Lone figure at the edge of space" },
];

export const MODELS_HEADER: SectionHeader = {
  eyebrow: "Our models",
  title: "The right model for every frame.",
  accent: "every frame.",
  desc: "Realistic or stylized — pick the engine that fits your idea.",
};

export const MODEL_CARDS: ModelCard[] = [
  { id: "video-lite", title: "Video Lite", icon: "Zap", description: "Fast everyday clips for quick ideas and drafts.", href: "/text-to-video", image: img("video-lite"), alt: "Quick draft clip preview" },
  { id: "video-pro", title: "Video Pro", icon: "Film", description: "Cinematic motion and detail for finished shots.", href: "/image-to-video", image: img("video-pro"), alt: "Cinematic motion frame" },
  { id: "image-studio", title: "Image Studio", icon: "Image", description: "Detailed stills from text or reference.", href: "/reference-to-video", image: img("image-studio"), alt: "Detailed generated still" },
  { id: "anime-style", title: "Anime & Style", icon: "Palette", description: "Bold styles and looks for standout frames.", href: "/text-to-video", image: img("anime-style"), alt: "Stylized anime frame" },
];

export const EFFECTS_HEADER: SectionHeader = {
  eyebrow: "Creative effects",
  title: "Turn ordinary into unforgettable.",
  accent: "unforgettable.",
  desc: "One-click looks, camera moves and visual effects.",
};

export const EFFECT_CARDS: EffectCard[] = [
  { id: "float-away", title: "Float Away", image: img("float-away"), alt: "Figure floating above the ground", href: "#" },
  { id: "style-swap", title: "Style Swap", image: img("style-swap"), alt: "Scene changing visual style", href: "#" },
  { id: "fire-light", title: "Fire Light", image: img("fire-light"), alt: "Warm fire light on a face", href: "#" },
  { id: "world-grow", title: "World Grow", image: img("world-grow"), alt: "Landscape growing outward", href: "#" },
  { id: "orbit-360", title: "360 Orbit", image: img("orbit-360"), alt: "Camera orbiting a subject", href: "#" },
  { id: "slow-time", title: "Slow Time", image: img("slow-time"), alt: "Slow motion water splash", href: "#" },
];

export const STEPS_HEADER: SectionHeader = {
  eyebrow: "How it works",
  title: "From idea to incredible. In 3 steps.",
  accent: "In 3 steps.",
  desc: "Go from a rough idea to a finished clip in a few clicks.",
};

export const STEPS: Step[] = [
  { number: "01", title: "Describe it", icon: "PenLine", description: "Write a sentence, a mood or a full scene." },
  { number: "02", title: "Pick a model", icon: "SlidersHorizontal", description: "Choose the engine and the look you want." },
  { number: "03", title: "Generate & share", icon: "Share2", description: "Render your clip and share it in one tap." },
];

export const CREDITS_BANNER = {
  title: "Start creating with free credits.",
  accent: "free credits.",
  subtitle: "No card needed. Turn your next idea into something real.",
  cta: { label: "Get Free Credits →", href: "/pricing", icon: "ArrowRight", variant: "primary" } as Cta,
  image: img("planet-horizon"),
  alt: "Planet horizon lit from behind",
};

export function localizedHref(lang: string, href: string): string {
  return href.startsWith("#") ? href : `/${lang}${href}`;
}
