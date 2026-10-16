/**
 * Data for the DreamUtopia homepage (see spec.md, apps/video).
 * Locale-free hrefs only (see "Allowed hrefs"); prefix with localizedHref().
 */

const img = (seed: string, w: number, h: number) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

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

export interface Stat {
  value: string;
  label: string;
}

export interface CategoryCard {
  id: string;
  title: string;
  category: string;
  likes: string;
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
    "DreamUtopia turns a single sentence into cinematic clips, pictures and whole worlds — no camera required.",
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
    image: img("portrait-girl", 340, 453),
    alt: "Portrait lit by violet studio light",
    caption: "Tomorrow starts with one idea.",
    size: "large",
  },
  {
    image: img("neon-city", 260, 347),
    alt: "Neon city street at night",
    caption: "New worlds waiting.",
    size: "small",
  },
  {
    image: img("astronaut", 260, 347),
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

export const STATS: Stat[] = [
  { value: "5M+", label: "Creators" },
  { value: "12M+", label: "Clips made" },
  { value: "99%", label: "Happy makers" },
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
  { id: "golden-hour", title: "Golden Hour", category: "Cinematic", likes: "1.2k", image: img("golden-hour", 640, 400), alt: "Golden hour light across a field" },
  { id: "neon-streets", title: "Neon Streets", category: "Sci-Fi", likes: "980", image: img("neon-streets", 640, 400), alt: "Neon signs reflected on wet asphalt" },
  { id: "liquid-light", title: "Liquid Light", category: "Stylize", likes: "874", image: img("liquid-light", 640, 400), alt: "Liquid light swirls in violet tones" },
  { id: "coast-drive", title: "Coast Drive", category: "Cinematic", likes: "1.5k", image: img("coast-drive", 640, 400), alt: "Road along a coastal cliff" },
  { id: "first-steps", title: "First Steps", category: "Anime", likes: "760", image: img("first-steps", 640, 400), alt: "Anime style figure walking at dawn" },
  { id: "silver-muse", title: "Silver Muse", category: "Portrait", likes: "1.1k", image: img("silver-muse", 640, 400), alt: "Studio portrait in silver tones" },
  { id: "glass-city", title: "Glass City", category: "Sci-Fi", likes: "643", image: img("glass-city", 640, 400), alt: "Glass towers under a violet sky" },
  { id: "edge-of-space", title: "Edge of Space", category: "Fantasy", likes: "1.9k", image: img("edge-of-space", 640, 400), alt: "Lone figure at the edge of space" },
];

export const MODELS_HEADER: SectionHeader = {
  eyebrow: "Our models",
  title: "The right model for every frame.",
  accent: "every frame.",
  desc: "Realistic or stylized — pick the engine that fits your idea.",
};

export const MODEL_CARDS: ModelCard[] = [
  { id: "video-lite", title: "Video Lite", icon: "Zap", description: "Fast everyday clips for quick ideas and drafts.", href: "/text-to-video", image: img("video-lite", 640, 400), alt: "Quick draft clip preview" },
  { id: "video-pro", title: "Video Pro", icon: "Film", description: "Cinematic motion and detail for finished shots.", href: "/image-to-video", image: img("video-pro", 640, 400), alt: "Cinematic motion frame" },
  { id: "image-studio", title: "Image Studio", icon: "Image", description: "Detailed stills from text or reference.", href: "/reference-to-video", image: img("image-studio", 640, 400), alt: "Detailed generated still" },
  { id: "anime-style", title: "Anime & Style", icon: "Palette", description: "Bold styles and looks for standout frames.", href: "/text-to-video", image: img("anime-style", 640, 400), alt: "Stylized anime frame" },
];

export const EFFECTS_HEADER: SectionHeader = {
  eyebrow: "Creative effects",
  title: "Turn ordinary into unforgettable.",
  accent: "unforgettable.",
  desc: "One-click looks, camera moves and visual effects.",
};

export const EFFECT_CARDS: EffectCard[] = [
  { id: "float-away", title: "Float Away", image: img("float-away", 640, 360), alt: "Figure floating above the ground", href: "#" },
  { id: "style-swap", title: "Style Swap", image: img("style-swap", 640, 360), alt: "Scene changing visual style", href: "#" },
  { id: "fire-light", title: "Fire Light", image: img("fire-light", 640, 360), alt: "Warm fire light on a face", href: "#" },
  { id: "world-grow", title: "World Grow", image: img("world-grow", 640, 360), alt: "Landscape growing outward", href: "#" },
  { id: "orbit-360", title: "360 Orbit", image: img("orbit-360", 640, 360), alt: "Camera orbiting a subject", href: "#" },
  { id: "slow-time", title: "Slow Time", image: img("slow-time", 640, 360), alt: "Slow motion water splash", href: "#" },
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
  image: img("planet-horizon", 1600, 600),
  alt: "Planet horizon lit from behind",
};

export function localizedHref(lang: string, href: string): string {
  return href.startsWith("#") ? href : `/${lang}${href}`;
}
