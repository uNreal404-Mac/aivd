import "@/styles/i2v-tokens.css";
import "@/styles/seo-landing-tokens.css";

import { getToolPageConfig } from "@/config/tool-pages";
import { I2VStudio } from "@/components/image-to-video/i2v-studio";
import { SeoLanding } from "@/components/seo/seo-landing";
import { isI2VGenerationEnabled } from "@/lib/image-to-video";
import { seoLandingFor } from "@/lib/seo-landing";
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
  const content = seoLandingFor("image-to-video", locale);
  const alternates = buildAlternates("/image-to-video", locale);
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

export default async function ImageToVideoPage({
  params,
}: ImageToVideoPageProps) {
  const { locale } = await params;
  const generationEnabled = isI2VGenerationEnabled();

  return (
    <>
      <I2VStudio generationEnabled={generationEnabled} locale={locale} />
      <SeoLanding
        slug="image-to-video"
        locale={locale}
        headingLevel="h2"
        showHeroEntry={false}
      />
    </>
  );
}
