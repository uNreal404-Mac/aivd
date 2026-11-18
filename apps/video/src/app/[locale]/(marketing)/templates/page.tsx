import { TemplatesSectionPage } from "@/components/section/section-pages";
import { buildAlternates } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const zh = locale.startsWith("zh");
  const alternates = buildAlternates("/templates", locale as never);
  return {
    title: zh ? "AI 视频模板 - 一键套用提示词" : "AI Video Templates - Ready-to-use Prompts",
    description: zh
      ? "浏览故事视频、动态创作和创意重构模板，一键把提示词带入 AI 视频生成器。"
      : "Browse story, motion and recast templates and load their prompts into the AI video generator in one click.",
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
  };
}

export default async function TemplatesPage({ params }: Props) {
  const { locale } = await params;
  return <TemplatesSectionPage lang={locale} />;
}
