import { getConfiguredAIProvider } from "@/ai/provider-config";
import { PremiereCollection } from "./premiere-collection";
import { PremiereHero } from "./premiere-hero";

export function DuHome({ lang }: { lang: string }) {
  return (
    <div className="bg-[var(--du-bg)] text-[var(--du-text)]">
      <PremiereHero lang={lang} provider={getConfiguredAIProvider()} />
      <PremiereCollection lang={lang} />
    </div>
  );
}
