import type { Metadata } from "next";
import { AiVideoStudio } from "@/components/hf/ai-video-studio";
import type { Locale } from "@/config/i18n-config";
import { settingsFromSearchParams } from "@/lib/ai-video-studio";
import { buildAlternates } from "@/lib/seo";

type PageParams = {
  locale: Locale;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { locale } = await params;

  return {
    title: "AI Video Studio",
    description:
      "Create short AI videos from a prompt or a start frame. Choose a model, length, ratio and sound.",
    alternates: buildAlternates("/ai/video", locale),
  };
}

export default async function AiVideoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  return (
    <AiVideoStudio
      generationEnabled={process.env.VIDEO_GENERATION_ENABLED === "true"}
      initialSettings={settingsFromSearchParams(sp)}
    />
  );
}
