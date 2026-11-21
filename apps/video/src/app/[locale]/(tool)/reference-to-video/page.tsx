import { VideoStudioPage } from "@/components/hf/video-studio-page";
import { FeatureContent } from "@/components/feature/feature-content";
import { ToolLanding } from "@/components/feature/tool-landing";
import { featureCopy } from "@/lib/feature-pages";
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
  // Title, description and H1 come from the feature copy (lib/feature-pages).
  const { title, description } = featureCopy("reference-to-video", isChinese);

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
  return (
    <ToolLanding>
      <VideoStudioPage locale={locale} searchParams={sp} defaultModel="kling/v4-reference-to-video" />
      <FeatureContent kind="reference-to-video" locale={locale} />
    </ToolLanding>
  );
}
