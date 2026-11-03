import { ConversionHero } from "./conversion-hero";
import { ConversionShowcase } from "./conversion-showcase";

export function DuHome({ lang }: { lang: string }) {
  return <><ConversionHero lang={lang}/><ConversionShowcase lang={lang}/></>;
}
