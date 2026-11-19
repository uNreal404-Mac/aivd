import { VideoStudioPage } from "@/components/hf/video-studio-page";
import { getToolPageConfig } from "@/config/tool-pages";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
import { siteConfig } from "@/config/site";

interface ImageToVideoPageProps {
  params: Promise<{
    locale: Locale;
  }>;
}

export async function generateMetadata({
  params,
}: ImageToVideoPageProps) {
  const { locale } = await params;
  const config = getToolPageConfig("image-to-video");
  const isChinese = locale.toLowerCase().startsWith("zh");
  const title = isChinese ? "图片生成视频 - AI 动画工具" : config.seo?.title;
  const description = isChinese
    ? "上传照片并通过 AI 生成自然流畅的视频动画。"
    : config.seo?.description;
  const alternates = buildAlternates("/image-to-video", locale);
  const ogImage = resolveOgImage(config.seo?.ogImage);

  return {
    title,
    description,
    keywords: config.seo?.keywords,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
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

export default async function ImageToVideoPage({
  params,
  searchParams,
}: ImageToVideoPageProps & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  return <VideoStudioPage locale={locale} searchParams={sp} />;
}
