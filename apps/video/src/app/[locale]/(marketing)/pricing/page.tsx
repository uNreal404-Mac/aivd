import "@/styles/pricing-tokens.css";
import { HomePricing } from "@/components/hf/home-pricing";
import { PricingFaq } from "@/components/pricing/pricing-page";
import { isPaymentsConfigured } from "@/lib/payments";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { buildAlternates, resolveOgImage } from "@/lib/seo";

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

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;

  // Same pricing block as the homepage, buying in place, then the FAQ.
  return (
    <div className="bg-[var(--du-bg)]">
      <HomePricing lang={locale} asPage checkout={{ enabled: isPaymentsConfigured() }} />
      <PricingFaq locale={locale} />
    </div>
  );
}
