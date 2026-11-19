import { DuHome } from "@/components/hf/du-home";
import { HomeFaq } from "@/components/hf/home-faq";

import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { i18n } from "@/config/i18n-config";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
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

  // With the " | aivd.ai" the layout adds, the title stays inside the 60
  // characters a search result shows. The model names are in the description.
  const titles = {
    en: "AI Video Generator: Text & Image to Video",
    zh: "AI视频生成器：文字、图片生成视频",
  };

  // Under 160 characters, so it is not cut off either.
  const descriptions = {
    en: "Turn a prompt or a photo into video with AI. Veo 3.1, Seedance 2.5, Kling 4.0 and more in one place, plus images and audio. See the cost before you generate.",
    zh: "用AI把一句话或一张图片变成视频。Veo 3.1、Seedance 2.5、Kling 4.0、Wan 2.6等模型一站可用，还能生成AI图片和音频。生成前就能看到要消耗的积分。",
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
      <HomeFaq lang={locale} />
    </>
  );
}
