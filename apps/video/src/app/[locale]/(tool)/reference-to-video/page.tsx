import { Suspense } from "react";
import { getToolPageConfig, getToolPageConfigForProvider } from "@/config/tool-pages";
import { ToolPageLayout } from "@/components/tool/tool-page-layout";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import { getConfiguredAIProvider } from "@/ai";
import { SeoLanding } from "@/components/seo/seo-landing";
import { seoLandingFor } from "@/lib/seo-landing";
import "@/styles/seo-landing-tokens.css";

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
  const landing = seoLandingFor("reference-to-video", locale);
  const alternates = buildAlternates("/reference-to-video", locale);
  const ogImage = resolveOgImage(config.seo?.ogImage);

  return {
    title: landing.title,
    description: landing.description,
    keywords: config.seo?.keywords,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: landing.title,
      description: landing.description,
      url: alternates.canonical,
      siteName: siteConfig.name,
      type: "website",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: landing.title,
      description: landing.description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function ReferenceToVideoPage({ params }: ReferenceToVideoPageProps) {
  const config = getToolPageConfigForProvider(
    "reference-to-video",
    getConfiguredAIProvider()
  );
  const { locale } = await params;
  return (
    <>
      <Suspense fallback={null}>
        <ToolPageLayout
          config={config}
          locale={locale}
          toolRoute="reference-to-video"
        />
      </Suspense>
      <SeoLanding
        slug="reference-to-video"
        locale={locale}
        headingLevel="h2"
        showHeroEntry={false}
      />
    </>
  );
}
