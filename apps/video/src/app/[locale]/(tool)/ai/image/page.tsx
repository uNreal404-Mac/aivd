import type { Metadata } from "next";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";
import { AiImageStudio } from "@/components/hf/ai-image-studio";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale === "zh";
  return {
    title: zh ? "文字生成图片 | aivd.ai" : "Text to Image | aivd.ai",
    description: zh ? "用文字描述画面，选择图片模型并生成作品。" : "Describe an image, choose a model and create a visual.",
    alternates: buildAlternates("/ai/image", locale),
  };
}

export default async function AiImagePage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <AiImageStudio locale={locale} />;
}
