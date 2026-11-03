import { ConversionHero } from "./conversion-hero";
import { ConversionShowcase } from "./conversion-showcase";
import { MobileCreateAction } from "./mobile-create-action";

export function DuHome({ lang }: { lang: string }) {
  return (
    <>
      <ConversionHero lang={lang} />
      <ConversionShowcase lang={lang} />
      <MobileCreateAction lang={lang} />
    </>
  );
}
