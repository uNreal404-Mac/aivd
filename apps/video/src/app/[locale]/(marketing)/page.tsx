import { HOME_SEO } from "@/lib/home-seo";
import { DuHome } from "@/components/hf/du-home";
import { HomeFaq } from "@/components/hf/home-faq";

import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { i18n } from "@/config/i18n-config";
import { buildAlternates, openGraphLocale, resolveOgImage } from "@/lib/seo";
import { getAvailableModels } from "@/config/credits";
import { getConfiguredAIProvider } from "@/ai/provider-config";

interface HomePageProps {
  params: Promise<{
    locale: Locale;
  }>;
}

interface PageMetadataProps {
  params: Promise<{
    locale: Locale;
  }>;
}

export async function generateMetadata({ params }: PageMetadataProps) {
  const { locale } = await params;

  // Title and description live in lib/home-seo with the H1; with the
  // " | aivd.ai" the layout adds, the title fits a search result.
  const titles = { en: HOME_SEO.en.title, zh: HOME_SEO.zh.title };
  const descriptions = { en: HOME_SEO.en.description, zh: HOME_SEO.zh.description };

  const canonicalUrl = `${siteConfig.url}${locale === i18n.defaultLocale ? "" : `/${locale}`}`;
  const alternates = buildAlternates("/", locale);
  const ogImage = resolveOgImage();

  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: titles[locale] || titles.en,
      description: descriptions[locale] || descriptions.en,
      url: canonicalUrl,
      siteName: siteConfig.name,
      ...openGraphLocale(locale),
      type: "website",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: titles[locale] || titles.en,
      description: descriptions[locale] || descriptions.en,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params;
  const models = getAvailableModels({
    provider: getConfiguredAIProvider() ?? "kie",
    mode: "text-to-video",
  });

  return (
    <>
      <DuHome
        lang={locale}
        models={models.map(({ id, name, durations, aspectRatios }) => ({
          id,
          name,
          durations: durations.filter((duration) => duration >= 4 && duration <= 15),
          aspects: aspectRatios.filter((aspect) => aspect !== "Auto"),
        }))}
      />
      <HomeFaq lang={locale} />
    </>
  );
}
