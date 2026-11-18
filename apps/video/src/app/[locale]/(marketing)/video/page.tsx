import { VideoSectionPage } from "@/components/section/section-pages";
import { getConfiguredAIProvider } from "@/ai/provider-config";
import { getAvailableModels } from "@/config/credits";
import { buildAlternates } from "@/lib/seo";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const zh = locale.startsWith("zh");
  const alternates = buildAlternates("/video", locale as never);
  return {
    title: zh ? "AI 视频生成器 - 文字和图片生成视频" : "AI Video Generator - Text and Image to Video",
    description: zh
      ? "用文字或图片生成带运镜和声音的 AI 视频，支持 Veo 3.1 与 Wan 2.6，生成前显示所需积分。"
      : "Create AI videos with camera moves and sound from text or an image using Veo 3.1 and Wan 2.6. See the credit cost before you generate.",
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
  };
}

export default async function VideoPage({ params, searchParams }: Props) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const models = getAvailableModels({ provider: getConfiguredAIProvider() ?? "kie", mode: "text-to-video" }).map(
    ({ id, name, durations, aspectRatios }) => ({
      id,
      name,
      durations: durations.filter((duration) => duration >= 4 && duration <= 15),
      aspects: aspectRatios.filter((aspect) => aspect !== "Auto"),
    }),
  );
  const prompt = typeof query.prompt === "string" ? query.prompt : "";
  return <VideoSectionPage lang={locale} models={models} initialPrompt={prompt} />;
}
