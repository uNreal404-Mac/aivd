import type { Metadata } from "next";

import { AiCanvasLoader } from "@/components/ai-canvas/loader";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates } from "@/lib/seo";

interface AiCanvasPageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: AiCanvasPageProps): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale === "zh";
  const alternates = buildAlternates("/ai-canvas", locale);
  return {
    title: zh ? "AI 画布" : "AI Canvas",
    description: zh
      ? "在无限画布上用节点串联文本、图片、视频和音频生成。"
      : "Chain text, image, video and audio generation as nodes on an infinite canvas.",
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
    // A working tool, not a landing page.
    robots: { index: false, follow: true },
  };
}

export default async function AiCanvasPage({ params }: AiCanvasPageProps) {
  const { locale } = await params;
  return <AiCanvasLoader locale={locale} />;
}
