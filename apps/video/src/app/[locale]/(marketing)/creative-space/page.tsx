import { CreativeSpaceHome } from "@/components/creative-space/creative-space-home";
import { getConfiguredAIProvider } from "@/ai/provider-config";
import { getAvailableModels } from "@/config/credits";
import { buildAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const zh = locale.startsWith("zh");
  const alternates = buildAlternates("/creative-space", locale as never);
  return {
    title: zh ? "AI 创作空间 - 视频、图片和 Agent" : "AI Creative Space - Video, Images, and Agent",
    description: zh
      ? "在创作空间中选择视频、图片或 Agent，使用共享素材库，生成作品或让 DeepSeek 帮你规划创意。"
      : "Choose video, image, or Agent in Creative Space. Use your shared media library to create or plan with DeepSeek.",
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
  };
}

export default async function CreativeSpacePage({ params }: Props) {
  const { locale } = await params;
  const models = getAvailableModels({ provider: getConfiguredAIProvider() ?? "kie", mode: "text-to-video" }).map(
    ({ id, name, durations, aspectRatios }) => ({ id, name, durations, aspects: aspectRatios.filter((aspect) => aspect !== "Auto") }),
  );
  return <CreativeSpaceHome lang={locale} models={models} />;
}
