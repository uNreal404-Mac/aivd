import { VideoStudioPage } from "@/components/hf/video-studio-page";
import { FeatureContent } from "@/components/feature/feature-content";
import { ToolLanding } from "@/components/feature/tool-landing";
import { featureCopy } from "@/lib/feature-pages";
import { getToolPageConfig } from "@/config/tool-pages";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates, openGraphLocale, resolveOgImage } from "@/lib/seo";
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
  // Title, description and H1 come from the feature copy (lib/feature-pages).
  const { title, description } = featureCopy("image-to-video", isChinese);
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

export default async function ImageToVideoPage({
  params,
  searchParams,
}: ImageToVideoPageProps & { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale }, sp] = await Promise.all([params, searchParams]);
  return (
    <ToolLanding>
      <VideoStudioPage locale={locale} searchParams={sp} />
      <FeatureContent kind="image-to-video" locale={locale} />
    </ToolLanding>
  );
}
