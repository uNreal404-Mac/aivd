import { DRAFT_ROBOTS } from "@/lib/indexing";
import type { Metadata } from "next";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";
import { AiImageStudio } from "@/components/hf/ai-image-studio";

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale === "zh";
  return {
    title: zh ? "AI 图片工作室" : "AI Image Studio",
    description: zh ? "用文字描述画面，选择图片模型并生成作品。" : "Describe an image, choose a model and create a visual.",
    robots: DRAFT_ROBOTS,
    alternates: buildAlternates("/ai/image", locale),
  };
}

export default async function AiImagePage({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { locale } = await params;
  const query = await searchParams;
  const modelParam = typeof query.model === "string" ? query.model : "";
  // Remount when the nav switches models, so the new choice is applied.
  return <AiImageStudio key={modelParam || "default"} locale={locale} initialPrompt={typeof query.prompt === "string" ? query.prompt.slice(0, 2000) : ""} initialModel={typeof query.model === "string" ? query.model : ""} initialAspect={typeof query.aspect === "string" ? query.aspect : ""} />;
}
