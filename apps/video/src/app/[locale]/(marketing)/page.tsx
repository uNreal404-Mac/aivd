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
    en: "AI Video Generator - Create Videos with Veo 3.1, Seedance 2.5 & Kling 4.0",
    zh: "AI视频生成器 - 用Veo 3.1、Seedance 2.5、Kling 4.0生成视频",
  };

  const descriptions = {
    en: "Turn ideas into videos with AI. Veo 3.1, Seedance 2.5, Kling 4.0, Wan 2.6 and more in one place, plus AI images and audio. See the credit cost before you generate.",
    zh: "用AI把想法变成视频。Veo 3.1、Seedance 2.5、Kling 4.0、Wan 2.6等模型一站可用，还能生成AI图片和音频。生成前就能看到要消耗的积分。",
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
