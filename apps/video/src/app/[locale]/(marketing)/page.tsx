import { FAQSection } from "@/components/landing/faq-section";
import { DuHome } from "@/components/hf/du-home";

import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { i18n } from "@/config/i18n-config";
import { buildAlternates, resolveOgImage } from "@/lib/seo";

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

  const titles = {
    en: "AI Video Generator — Seedance & Seedance 2.0 mini",
    zh: "AI视频生成器 — Seedance 与 Seedance 2.0 mini",
  };

  const descriptions = {
    en: "aivd.ai is a universe-level AI video generator, AI image generator, and AI music generator on Seedance and Seedance 2.0 mini. Seedance 1.5 Pro sunsets around November 11, 2026.",
    zh: "aivd.ai 用 Seedance 与 Seedance 2.0 mini 做宇宙级 AI 视频生成器、AI 图像生成器与 AI 音乐生成器。Seedance 1.5 Pro 约于 2026 年 11 月 11 日停用。",
  };

  const keywords = [
    "AI video generator",
    "AI image generator",
    "AI music generator",
    "Seedance",
    "Seedance 2.0 mini",
    "aivd.ai",
  ];

  const canonicalUrl = `${siteConfig.url}${locale === i18n.defaultLocale ? "" : `/${locale}`}`;
  const alternates = buildAlternates("/", locale);
  const ogImage = resolveOgImage();

  return {
    title: titles[locale] || titles.en,
    description: descriptions[locale] || descriptions.en,
    keywords,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: titles[locale] || titles.en,
      description: descriptions[locale] || descriptions.en,
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: locale === "zh" ? "zh_CN" : "en_US",
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

  return (
    <>
      <DuHome lang={locale} />
      <FAQSection />
    </>
  );
}
