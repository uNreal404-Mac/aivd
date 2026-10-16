import { getToolPageConfig, getToolPageConfigForProvider } from "@/config/tool-pages";
import { ToolPageLayout } from "@/components/tool/tool-page-layout";
import { SeoLanding } from "@/components/seo/seo-landing";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import { seoLandingFor } from "@/lib/seo-landing";
import { getConfiguredAIProvider } from "@/ai";
import "@/styles/seo-landing-tokens.css";

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
  const content = seoLandingFor("text-to-video", locale);
  const alternates = buildAlternates("/text-to-video", locale);
  const ogImage = resolveOgImage(config.seo?.ogImage);

  return {
    title: content.title,
    description: content.description,
    keywords: config.seo?.keywords,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: content.title,
      description: content.description,
      url: alternates.canonical,
      siteName: siteConfig.name,
      type: "website",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: content.title,
      description: content.description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function TextToVideoPage({ params }: TextToVideoPageProps) {
  const config = getToolPageConfigForProvider(
    "text-to-video",
    getConfiguredAIProvider()
  );
  const { locale } = await params;
  return (
    <>
      <ToolPageLayout
        config={config}
        locale={locale}
        toolRoute="text-to-video"
      />
      <SeoLanding
        slug="text-to-video"
        locale={locale}
        headingLevel="h2"
        showHeroEntry={false}
      />
    </>
  );
}
