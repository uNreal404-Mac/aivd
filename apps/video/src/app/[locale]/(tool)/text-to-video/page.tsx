import { VideoStudioPage } from "@/components/hf/video-studio-page";
import { getToolPageConfig } from "@/config/tool-pages";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates, openGraphLocale, resolveOgImage } from "@/lib/seo";
import { siteConfig } from "@/config/site";

interface TextToVideoPageProps {
  params: Promise<{
    locale: Locale;
  }>;
}

export async function generateMetadata({
  params,
}: TextToVideoPageProps) {
  const { locale } = await params;
  const config = getToolPageConfig("text-to-video");
  const alternates = buildAlternates("/text-to-video", locale);
  const ogImage = resolveOgImage(config.seo?.ogImage);
  const isChinese = locale.toLowerCase().startsWith("zh");
  const title = isChinese ? "文字生成视频 - AI 文生视频工具" : config.seo?.title;
  const description = isChinese ? "输入一句描述，用 Veo 3.1、Seedance 2.5、Kling 4.0 等模型生成视频，生成前显示积分。" : config.seo?.description;

  return {
    title,
    description,
    keywords: config.seo?.keywords,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      ...openGraphLocale(locale),
      title,
      description,
      url: alternates.canonical,
      siteName: siteConfig.name,
      type: "website",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function TextToVideoPage({
  params,
  searchParams,
}: TextToVideoPageProps & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  return <VideoStudioPage locale={locale} searchParams={sp} />;
}
