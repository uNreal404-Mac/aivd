import { getTranslations } from "next-intl/server";

import { GallerySection } from "@/components/gallery/gallery-section";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { buildAlternates, openGraphLocale, resolveOgImage } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Gallery" });

  const title = t("pageTitle");
  const description = t("pageSubtitle");
  const alternates = buildAlternates("/gallery", locale);
  const ogImage = resolveOgImage();

  return {
    title,
    description,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      ...openGraphLocale(locale),
      type: "website",
      title,
      description,
      url: alternates.canonical,
      siteName: siteConfig.name,
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<{ video?: string }>;
}) {
  const { locale } = await params;
  const { video } = await searchParams;
  const t = await getTranslations({ locale, namespace: "Gallery" });

  return (
    <div className="gl-page">
      <header className="gl-head">
        <p className="gl-kicker">{t("title")}</p>
        <h1 className="gl-title">{t("pageTitle")}</h1>
        <p className="gl-sub">{t("pageSubtitle")}</p>
      </header>
      <GallerySection initialItemUuid={video} />
    </div>
  );
}
