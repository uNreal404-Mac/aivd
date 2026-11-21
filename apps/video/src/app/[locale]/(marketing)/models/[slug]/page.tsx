import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ModelLanding } from "@/components/model-landing/model-landing";
import { i18n, type Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { isNoIndexEnvironment, NOINDEX_ROBOTS } from "@/lib/indexing";
import { LANDING_SLUGS, getLandingModel, landingDescription, landingTitle } from "@/lib/model-landing";
import { buildAlternates, defaultShareImages, openGraphLocale } from "@/lib/seo";

export const dynamicParams = false;

interface ModelPageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export function generateStaticParams() {
  return i18n.locales.flatMap((locale) => LANDING_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: ModelPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const model = getLandingModel(slug);
  // Unknown slugs are handled by notFound() in the page, so keep metadata safe.
  if (!model) return {};

  const zh = locale.toLowerCase().startsWith("zh");
  const title = landingTitle(model, zh);
  const description = landingDescription(model, zh);
  const path = `/models/${slug}`;
  const localePrefix = locale === i18n.defaultLocale ? "" : `/${locale}`;

  return {
    title,
    description,
    alternates: buildAlternates(path, locale),
    openGraph: {
      title,
      description,
      url: `${siteConfig.url}${localePrefix}${path}`,
      siteName: siteConfig.name,
      type: "website",
      ...openGraphLocale(locale),
      images: defaultShareImages(title),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: defaultShareImages(title),
    },
    // Models that cannot generate here yet are not offered to search engines.
    robots: isNoIndexEnvironment() || !model.live ? NOINDEX_ROBOTS : undefined,
  };
}

export default async function ModelPage({ params }: ModelPageProps) {
  const { locale, slug } = await params;
  const model = getLandingModel(slug);
  if (!model) notFound();
  return <ModelLanding model={model} lang={locale} />;
}
