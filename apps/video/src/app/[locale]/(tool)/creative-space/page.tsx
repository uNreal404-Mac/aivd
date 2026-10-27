import type { Metadata } from "next";

import { CreativeSpaceStudio } from "@/components/creative-space/creative-space-studio";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";

interface CreativeSpacePageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({
  params,
}: CreativeSpacePageProps): Promise<Metadata> {
  const { locale } = await params;
  const isChinese = locale === "zh";
  const alternates = buildAlternates("/creative-space", locale);

  return {
    title: isChinese ? "创作空间 | aidv.ai" : "Creative Space | aidv.ai",
    description: isChinese
      ? "在无限画布中整理图片和视频，并通过 Agent 编排创意。"
      : "Arrange images and videos on an infinite canvas and plan with an Agent.",
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
  };
}

export default async function CreativeSpacePage({
  params,
}: CreativeSpacePageProps) {
  const { locale } = await params;

  return <CreativeSpaceStudio locale={locale} />;
}
