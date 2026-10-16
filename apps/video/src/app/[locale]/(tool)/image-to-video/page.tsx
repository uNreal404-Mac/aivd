import "@/styles/i2v-tokens.css";

import { getToolPageConfig } from "@/config/tool-pages";
import { I2VStudio } from "@/components/image-to-video/i2v-studio";
import { isI2VGenerationEnabled } from "@/lib/image-to-video";
import type { Locale } from "@/config/i18n-config";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
import { siteConfig } from "@/config/site";

interface ImageToVideoPageProps {
  params: Promise<{
    locale: Locale;
  }>;
}

export async function generateMetadata({
  params,
}: ImageToVideoPageProps) {
  const { locale } = await params;
  const config = getToolPageConfig("image-to-video");
  const alternates = buildAlternates("/image-to-video", locale);
  const ogImage = resolveOgImage(config.seo?.ogImage);

  return {
    title: config.seo?.title,
    description: config.seo?.description,
    keywords: config.seo?.keywords,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: config.seo?.title,
      description: config.seo?.description,
      url: alternates.canonical,
      siteName: siteConfig.name,
      type: "website",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: config.seo?.title,
      description: config.seo?.description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default function ImageToVideoPage() {
  const generationEnabled = isI2VGenerationEnabled();

  return <I2VStudio generationEnabled={generationEnabled} />;
}
