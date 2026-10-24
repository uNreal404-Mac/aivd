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
  const isChinese = locale.toLowerCase().startsWith("zh");

  return {
    title: isChinese ? "AI 视频工作室" : "AI Video Studio",
    description: isChinese
      ? "通过提示词或起始帧创作 AI 短视频，并选择模型、时长、比例与声音。"
      : "Create short AI videos from a prompt or a start frame. Choose a model, length, ratio and sound.",
    alternates: buildAlternates("/ai/video", locale),
  };
}

export default async function AiVideoPage({
  params,
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [sp, { locale }] = await Promise.all([searchParams, params]);

  return (
    <AiVideoStudio
      generationEnabled={process.env.VIDEO_GENERATION_ENABLED === "true"}
      initialSettings={settingsFromSearchParams(sp)}
      locale={locale}
    />
  );
}
