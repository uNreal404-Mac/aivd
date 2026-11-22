import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComparePageView } from "@/components/compare/compare-page";
import { CONTENT_UPDATED } from "@/config/content-dates";
import { i18n, type Locale } from "@/config/i18n-config";
import { comparePage, compareSlugs } from "@/lib/compare-pages";
import { buildAlternates, defaultShareImages, openGraphLocale } from "@/lib/seo";
import { featurePageGraph, jsonLd } from "@/lib/structured-data";

export const dynamicParams = false;

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return i18n.locales.flatMap((locale) => compareSlugs().map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const page = comparePage(slug, locale === "zh");
  if (!page) return {};
  const alternates = buildAlternates(`/compare/${slug}`, locale);
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
    openGraph: {
      type: "article",
      title: page.title,
      description: page.description,
      url: alternates.canonical,
      modifiedTime: CONTENT_UPDATED.models,
      ...openGraphLocale(locale),
      images: defaultShareImages(page.title),
    },
  };
}

export default async function ComparePageRoute({ params }: Props) {
  const { locale, slug } = await params;
  const lang = locale === "zh" ? "zh" : "en";
  const page = comparePage(slug, lang === "zh");
  if (!page) notFound();
  // WebPage + BreadcrumbList + FAQPage, from structured-data.ts.
  const graph = featurePageGraph({
    path: `/compare/${slug}`,
    name: page.h1,
    description: page.description,
    locale: lang,
    faqs: page.faqs,
    dateModified: CONTENT_UPDATED.models,
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
      <ComparePageView page={page} lang={lang} />
    </>
  );
}
