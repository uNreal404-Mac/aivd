/**
 * Data for the DreamUtopia homepage (see spec.md, apps/video).
 * Locale-free hrefs only (see "Allowed hrefs"); prefix with localizedHref().
 */

const img = (seed: string) => `/home/${seed}.webp`;

export type CtaVariant = "primary" | "outline" | "text";

export interface Cta {
  href: string;
  icon: string;
  variant: CtaVariant;
}

export interface HeroCard {
  image: string;
  size: "large" | "small";
}

export interface CategoryCard {
  id: string;
  category: string;
  image: string;
}

export interface ModelCard {
  id: string;
  icon: string;
  href: string;
  image: string;
}

export interface EffectCard {
  id: string;
  image: string;
  href: string;
}

export interface Step {
  number: string;
  icon: string;
}

export const HERO = {
  ctas: [
    {
      href: "/text-to-video",
      icon: "Sparkles",
      variant: "primary",
    },
    {
      href: "/image-to-video",
      icon: "Play",
      variant: "outline",
    },
    {
      href: "#",
      icon: "CirclePlay",
      variant: "text",
    },
  ] as Cta[],
};

export const HERO_CARDS: HeroCard[] = [
  { image: img("portrait-girl"), size: "large" },
  { image: img("neon-city"), size: "small" },
  { image: img("astronaut"), size: "small" },
];

export const TOOL_CHIPS: Cta[] = [
  { href: "/text-to-video", icon: "Clapperboard", variant: "outline" },
  { href: "/image-to-video", icon: "ImagePlus", variant: "outline" },
  { href: "#", icon: "Image", variant: "outline" },
  { href: "#", icon: "LayoutGrid", variant: "outline" },
];

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
  { id: "golden-hour", category: "Cinematic", image: img("golden-hour") },
  { id: "neon-streets", category: "Sci-Fi", image: img("neon-streets") },
  { id: "liquid-light", category: "Stylize", image: img("liquid-light") },
  { id: "coast-drive", category: "Cinematic", image: img("coast-drive") },
  { id: "first-steps", category: "Anime", image: img("first-steps") },
  { id: "silver-muse", category: "Portrait", image: img("silver-muse") },
  { id: "glass-city", category: "Sci-Fi", image: img("glass-city") },
  { id: "edge-of-space", category: "Fantasy", image: img("edge-of-space") },
];

export const MODEL_CARDS: ModelCard[] = [
  { id: "video-lite", icon: "Zap", href: "/text-to-video", image: img("video-lite") },
  { id: "video-pro", icon: "Film", href: "/image-to-video", image: img("video-pro") },
  { id: "image-studio", icon: "Image", href: "/reference-to-video", image: img("image-studio") },
  { id: "anime-style", icon: "Palette", href: "/text-to-video", image: img("anime-style") },
];

export const EFFECT_CARDS: EffectCard[] = [
  { id: "float-away", image: img("float-away"), href: "#" },
  { id: "style-swap", image: img("style-swap"), href: "#" },
  { id: "fire-light", image: img("fire-light"), href: "#" },
  { id: "world-grow", image: img("world-grow"), href: "#" },
  { id: "orbit-360", image: img("orbit-360"), href: "#" },
  { id: "slow-time", image: img("slow-time"), href: "#" },
];

export const STEPS: Step[] = [
  { number: "01", icon: "PenLine" },
  { number: "02", icon: "SlidersHorizontal" },
  { number: "03", icon: "Share2" },
];

export const CREDITS_BANNER = {
  cta: { href: "/pricing", icon: "ArrowRight", variant: "primary" } as Cta,
  image: img("planet-horizon"),
};

export function localizedHref(lang: string, href: string): string {
  return href.startsWith("#") ? href : `/${lang}${href}`;
}
