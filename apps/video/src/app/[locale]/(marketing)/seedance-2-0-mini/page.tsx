import type { Metadata } from "next";

import { Seedance2MiniPage } from "@/components/marketing/seedance-2-mini-page";
import type { Locale } from "@/config/i18n-config";
import { i18n } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import {
  getSeedance2MiniCopy,
  SEEDANCE_2_MINI_PATH,
} from "@/lib/seedance-2-mini-page";
import { buildAlternates } from "@/lib/seo";

interface PageProps {
  params: Promise<{ locale: Locale }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const copy = getSeedance2MiniCopy(locale);
  const alternates = buildAlternates(SEEDANCE_2_MINI_PATH, locale);
  const localePrefix = locale === i18n.defaultLocale ? "" : `/${locale}`;

  return {
    title: copy.title,
    description: copy.description,
    keywords: copy.keywords,
    alternates: {
      canonical: alternates.canonical,
      languages: alternates.languages,
    },
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: `${siteConfig.url}${localePrefix}${SEEDANCE_2_MINI_PATH}`,
      siteName: "aivd.ai",
      locale: locale === "zh" ? "zh_CN" : "en_US",
      type: "website",
    },
  };
}

export default async function Page({ params }: PageProps) {
  const { locale } = await params;
  return <Seedance2MiniPage locale={locale} />;
}
