import type { Metadata } from "next";

import { HelpIndexView } from "@/components/help/help-pages";
import { CONTENT_UPDATED } from "@/config/content-dates";
import type { Locale } from "@/config/i18n-config";
import { helpArticles } from "@/lib/help-articles";
import { buildAlternates, defaultShareImages, openGraphLocale } from "@/lib/seo";
import { helpPageGraph, jsonLd } from "@/lib/structured-data";

const ROUTE = "/help";

function copy(zh: boolean) {
  return zh
    ? { title: "帮助中心：积分、价格、退款和模型", description: "aivd.ai 常见问题：生成失败退积分、不订阅按次付费、免费积分、每条视频的积分、积分有效期、退款、商用和可用模型。" }
    : { title: "Help Center: Credits, Pricing, Refunds and Models", description: "aivd.ai answers: failed generations refunded, pay as you go without a subscription, free credits, credits per video, expiry, refunds and commercial use." };
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const { title, description } = copy(locale === "zh");
  const alternates = buildAlternates(ROUTE, locale);
  return {
    title,
    description,
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
    openGraph: { type: "website", title, description, url: alternates.canonical, ...openGraphLocale(locale), images: defaultShareImages(title) },
  };
}

export default async function HelpIndexPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const lang = locale === "zh" ? "zh" : "en";
  const articles = helpArticles(lang);
  const { title, description } = copy(lang === "zh");
  const graph = helpPageGraph({
    path: ROUTE,
    name: title,
    description,
    locale: lang,
    faqs: articles.map((article) => ({ q: article.question, a: article.answer })),
    dateModified: CONTENT_UPDATED.pricing,
  });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(graph) }} />
      <HelpIndexView articles={articles} lang={lang} updated={CONTENT_UPDATED.pricing} />
    </>
  );
}
