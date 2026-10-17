import { getTranslations } from "next-intl/server";

import { GallerySection } from "@/components/gallery/gallery-section";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { buildAlternates, resolveOgImage } from "@/lib/seo";

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
    <div className="min-h-screen w-full bg-[var(--du-bg)]">
      <div className="mx-auto flex max-w-[1400px] flex-col px-4 py-10">
        <h1 className="text-3xl font-semibold text-[var(--du-text)] sm:text-4xl">
          {t("pageTitle")}
        </h1>
        <p className="mt-3 max-w-2xl text-[var(--du-text-muted)]">
          {t("pageSubtitle")}
        </p>
        <div className="mt-8">
          <GallerySection initialItemUuid={video} />
        </div>
      </div>
    </div>
  );
}
