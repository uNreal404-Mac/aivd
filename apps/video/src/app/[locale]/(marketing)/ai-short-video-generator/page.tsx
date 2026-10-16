import { SeoLanding } from "@/components/seo/seo-landing";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
import { seoLandingFor } from "@/lib/seo-landing";
import "@/styles/seo-landing-tokens.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const content = seoLandingFor("ai-short-video-generator", locale);
  const alternates = buildAlternates("/ai-short-video-generator", locale);
  const ogImage = resolveOgImage();

  return {
    title: content.title,
    description: content.description,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      type: "website",
      title: content.title,
      description: content.description,
      url: alternates.canonical,
      siteName: siteConfig.name,
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

export default async function AiShortVideoGeneratorPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  return (
    <SeoLanding
      slug="ai-short-video-generator"
      locale={locale}
      headingLevel="h1"
      showHeroEntry
    />
  );
}
