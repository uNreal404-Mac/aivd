import { setRequestLocale } from "next-intl/server";

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
    en: "AI Video Generator - Create Videos with Seedance 1.5 Pro & Seedance 1.0",
    zh: "AI视频生成器 - 使用 Seedance 1.5 Pro 与 Seedance 1.0 创作视频",
  };

  const descriptions = {
    en: "Turn your ideas into videos with AI. Choose Seedance 1.5 Pro, Seedance 1.0 Pro Fast or Seedance 1.0 Pro Quality for text-to-video and image-to-video.",
    zh: "用 AI 把想法变成视频。可选 Seedance 1.5 Pro、Seedance 1.0 Pro Fast 或 Seedance 1.0 Pro Quality，支持文字生成视频和图片生成视频。",
  };

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
  setRequestLocale(locale);

  return (
    <>
      <DuHome lang={locale} />
      <FAQSection />
    </>
  );
}
