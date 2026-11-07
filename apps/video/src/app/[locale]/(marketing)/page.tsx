import { FAQSection } from "@/components/landing/faq-section";
import { DuHome } from "@/components/hf/du-home";
import { HomePricingPreview } from "@/components/hf/home-pricing-preview";

import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { i18n } from "@/config/i18n-config";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
import { getAvailableModels } from "@/config/credits";
import { getConfiguredAIProvider } from "@/ai/provider-config";
import { SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";

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
    en: "AI Video Generator - Create Stunning Videos with Sora 2 & Veo 3.1",
    zh: "AI视频生成器 - 使用Sora 2和Veo 3.1创建精彩视频",
  };

  const descriptions = {
    en: "Transform your ideas into stunning videos with AI. Access Sora 2, Veo 3.1, Wan 2.6, and more. Fast, easy, and professional quality video generation in minutes. Start creating today!",
    zh: "用AI将您的想法转化为精彩视频。访问Sora 2、Veo 3.1、Wan 2.6等模型。快速、简单、专业品质的视频生成，几分钟内完成。立即开始创作！",
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
      <HomePricingPreview
        lang={locale}
        plans={SUBSCRIPTION_PRODUCTS.filter((plan) => plan.enabled).map(({ name, priceUsd, credits, period, popular }) => ({ name, priceUsd, credits, period, popular }))}
        models={models.map((model) => model.name)}
      />
      <FAQSection />
    </>
  );
}
