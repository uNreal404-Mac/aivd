import { MotionFeatures } from "@/components/motion/provider";
import { ConversionHero } from "./conversion-hero";
import { StudioPrismPoster } from "./studio-prism-poster";
import { ConversionShowcase } from "./conversion-showcase";
import { MobileCreateAction } from "./mobile-create-action";

export function DuHome({ lang }: { lang: string }) {
  return (
    <MotionFeatures afterPoster>
      <ConversionHero lang={lang} initialPoster={<StudioPrismPoster />} />
      <ConversionShowcase lang={lang} />
      <MobileCreateAction lang={lang} />
    </MotionFeatures>
  );
}
