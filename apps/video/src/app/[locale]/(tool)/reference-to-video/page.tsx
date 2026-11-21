import { VideoStudioPage } from "@/components/hf/video-studio-page";
import { getToolPageConfig } from "@/config/tool-pages";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates, openGraphLocale, resolveOgImage } from "@/lib/seo";
import { siteConfig } from "@/config/site";

interface ReferenceToVideoPageProps {
  params: Promise<{
    locale: Locale;
  }>;
}

export async function generateMetadata({
  params,
}: ReferenceToVideoPageProps) {
  const { locale } = await params;
  const config = getToolPageConfig("reference-to-video");
  const alternates = buildAlternates("/reference-to-video", locale);
  const ogImage = resolveOgImage(config.seo?.ogImage);
  const isChinese = locale.toLowerCase().startsWith("zh");
  const title = isChinese ? "参考图生成视频 - 人物和风格保持一致" : config.seo?.title;
  const description = isChinese ? "上传最多 4 张参考图，用 Kling 4.0 生成人物和风格一致的视频。" : config.seo?.description;

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

export default async function ReferenceToVideoPage({
  params,
  searchParams,
}: ReferenceToVideoPageProps & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  return <VideoStudioPage locale={locale} searchParams={sp} defaultModel="kling/v4-reference-to-video" />;
}
