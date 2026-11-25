import type { Metadata } from "next";

import { NodeCanvas } from "@/components/creative-space/canvas/node-canvas";
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
      ? "在节点画布上连接文字、图片和视频，一步步生成并保存你的作品流程。"
      : "Wire text, images and video together on a node canvas, generate step by step and save the flow.",
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

  return <NodeCanvas locale={locale} initialPrompt={initialPrompt} />;
}
