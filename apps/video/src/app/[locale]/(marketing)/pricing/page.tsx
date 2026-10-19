import "@/styles/pricing-tokens.css";
import { PricingPage as PricingPageView } from "@/components/pricing/pricing-page";
import {
  getOnetimeProducts,
  getSubscriptionProducts,
  type CreditPackageConfig,
} from "@/config/credits";
import { isPaymentsConfigured } from "@/lib/payments";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { buildAlternates, resolveOgImage } from "@/lib/seo";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const alternates = buildAlternates("/pricing", locale);

  const isZh = locale === "zh";
  const title = isZh ? "价格方案与积分" : "Pricing - Plans & Credits";
  const description = isZh
    ? "比较 AI 视频生成的月付、年付方案与一次性积分包。美元计价，透明定价，可随时取消。"
    : "Compare monthly and yearly plans and one-time credit packs for AI video generation. Transparent USD pricing, cancel anytime.";
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

function featureLabelsFor(
  products: CreditPackageConfig[],
  translate: { has: (key: string) => boolean; (key: string): string },
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const product of products) {
    for (const key of product.features ?? []) {
      if (labels[key]) continue;
      labels[key] = translate.has(key) ? translate(key) : key;
    }
  }
  return labels;
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const subscriptions = getSubscriptionProducts();
  const packs = getOnetimeProducts();
  const features = await getTranslations({
    locale,
    namespace: "Credits.features",
  });

  return (
    <PricingPageView
      locale={locale}
      paymentsEnabled={isPaymentsConfigured()}
      subscriptions={subscriptions}
      packs={packs}
      featureLabels={featureLabelsFor([...subscriptions, ...packs], features)}
    />
  );
}
