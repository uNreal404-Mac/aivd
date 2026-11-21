import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HelpArticleView } from "@/components/help/help-pages";
import { i18n, type Locale } from "@/config/i18n-config";
import { HELP_SLUGS, helpArticle, isHelpSlug } from "@/lib/help-articles";
import { buildAlternates, defaultShareImages, openGraphLocale } from "@/lib/seo";
import { helpPageGraph, jsonLd } from "@/lib/structured-data";

export const dynamicParams = false;

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export function generateStaticParams() {
  return i18n.locales.flatMap((locale) => HELP_SLUGS.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isHelpSlug(slug)) return {};
  const article = helpArticle(slug, locale === "zh" ? "zh" : "en");
  const alternates = buildAlternates(`/help/${slug}`, locale);
  return {
    title: article.question,
    description: article.description,
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
    openGraph: {
      type: "article",
      title: article.question,
      description: article.description,
      url: alternates.canonical,
      modifiedTime: article.updated,
      ...openGraphLocale(locale),
      images: defaultShareImages(article.question),
    },
  };
}

export default async function HelpArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isHelpSlug(slug)) notFound();
  const lang = locale === "zh" ? "zh" : "en";
  const article = helpArticle(slug, lang);
  const related = article.related.map((item) => helpArticle(item, lang));
  const graph = helpPageGraph({
    path: `/help/${slug}`,
    name: article.question,
    description: article.description,
    locale: lang,
    faqs: [{ q: article.question, a: article.answer }],
    dateModified: article.updated,
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
      <HelpArticleView article={article} related={related} lang={lang} />
    </>
  );
}
