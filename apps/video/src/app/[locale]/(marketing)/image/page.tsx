import { ImageSectionPage } from "@/components/section/section-pages";
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
  const alternates = buildAlternates("/image", locale as never);
  return {
    title: zh ? "AI 图片生成器 - 文字生成图片" : "AI Image Generator - Text to Image",
    description: zh
      ? "根据文字或参考图生成 AI 图片，可作为视频的起始帧。图片模型即将上线。"
      : "Generate AI images from text or a reference image and use them as a video start frame. Image models are coming soon.",
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
  };
}

export default async function ImagePage({ params, searchParams }: Props) {
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
  return <ImageSectionPage lang={locale} models={models} initialPrompt={prompt} />;
}
