import type { Metadata } from "next";

import { CreativeWorkflowStudio } from "@/components/creative-space/creative-workflow-studio";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";

interface CreativeSpacePageProps {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ prompt?: string | string[] }>;
}

export async function generateMetadata({
  params,
}: CreativeSpacePageProps): Promise<Metadata> {
  const { locale } = await params;
  const isChinese = locale === "zh";
  const alternates = buildAlternates("/creative-space/canvas", locale);

  return {
    title: isChinese ? "创作空间画布" : "Creative Space Canvas",
    description: isChinese
      ? "在无限画布中整理图片和视频，并通过 Agent 编排创意。"
      : "Arrange images and videos on an infinite canvas and plan with an Agent.",
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    // The canvas is a working tool; /creative-space is the indexable page.
    robots: { index: false, follow: true },
  };
}

export default async function CreativeSpacePage({
  params,
  searchParams,
}: CreativeSpacePageProps) {
  const { locale } = await params;
  const { prompt } = await searchParams;
  const initialPrompt = (Array.isArray(prompt) ? prompt[0] : prompt)?.slice(0, 2000) ?? "";

  return <CreativeWorkflowStudio locale={locale} initialPrompt={initialPrompt} />;
}
