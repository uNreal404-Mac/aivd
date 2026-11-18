import type { Metadata } from "next";
import type { Locale } from "@/config/i18n-config";
import { findNavModel } from "@/lib/nav-models";
import { buildAlternates } from "@/lib/seo";
import { AiImageStudio } from "@/components/hf/ai-image-studio";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale === "zh";
  return {
    title: zh ? "AI 图片生成器 - 文字生成图片" : "AI Image Generator - Text to Image",
    description: zh ? "用文字描述画面，选择图片模型并生成作品。" : "Describe an image, choose a model and create a visual.",
    alternates: buildAlternates("/ai/image", locale),
  };
}

export default async function AiImagePage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const query = await searchParams;
  const modelParam = typeof query.model === "string" ? query.model : "";
  // A nav model we do not have in the KIE catalogue yet opens as coming soon.
  // No image model can generate yet, so a nav pick always shows its menu name.
  const upcoming = findNavModel("image", modelParam);
  return <AiImageStudio key={modelParam || "default"} upcomingName={upcoming?.name} locale={locale} initialPrompt={typeof query.prompt === "string" ? query.prompt.slice(0, 2000) : ""} initialModel={typeof query.model === "string" ? query.model : ""} initialAspect={typeof query.aspect === "string" ? query.aspect : ""} />;
}
