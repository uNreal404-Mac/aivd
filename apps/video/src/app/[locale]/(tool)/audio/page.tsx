import type { Metadata } from "next";
import { FeatureContent } from "@/components/feature/feature-content";
import { ToolLanding } from "@/components/feature/tool-landing";
import { AiAudioStudio } from "@/components/hf/ai-audio-studio";
import { featureCopy } from "@/lib/feature-pages";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  // Title, description and H1 come from the feature copy (lib/feature-pages).
  const { title, description } = featureCopy("audio", locale.toLowerCase().startsWith("zh"));
  return {
    title,
    description,
    alternates: buildAlternates("/audio", locale),
  };
}

export default async function AudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const mode = typeof query.voiceMode === "string" ? query.voiceMode : "";
  const model = typeof query.audioModel === "string" ? query.audioModel : "";
  return (
    <ToolLanding>
      <AiAudioStudio key={`${mode}:${model}`} locale={locale} initialVoiceMode={mode} initialModelId={model} />
      <FeatureContent kind="audio" locale={locale} />
    </ToolLanding>
  );
}
