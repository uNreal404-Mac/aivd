import type { Metadata } from "next";
import { AiAudioStudio } from "@/components/hf/ai-audio-studio";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale === "zh";
  return {
    title: zh ? "AI 文字转语音 - 配音与声音生成" : "AI Text to Speech - Voiceover and Voice Generation",
    description: zh
      ? "把脚本变成自然的人声，为视频配音。语音模型即将上线。"
      : "Turn a script into a natural voice for your videos. Voice models are coming soon.",
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
  return <AiAudioStudio key={`${mode}:${model}`} locale={locale} initialVoiceMode={mode} initialModelId={model} />;
}
