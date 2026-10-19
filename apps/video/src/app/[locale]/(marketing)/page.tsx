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
    en: "AI Video Generator – Text & Image to Video with Seedance 1.5 Pro",
    zh: "AI 视频生成器 – 用 Seedance 1.5 Pro 文字、图片生成视频",
  };

  const descriptions = {
    en: "Turn a prompt or a photo into a short AI video with Seedance 1.5 Pro. Text-to-video and image-to-video in your browser, pay with credits, no editing skills needed.",
    zh: "用 Seedance 1.5 Pro 把一句描述或一张图片变成 AI 短视频。浏览器里直接文生视频、图生视频，按积分付费，无需剪辑基础。",
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

  return (
    <>
      <DuHome lang={locale} />
      <FAQSection />
    </>
  );
}
