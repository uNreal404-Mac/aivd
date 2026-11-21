import "@/styles/pricing-tokens.css";
import { HomePricing } from "@/components/hf/home-pricing";
import { PricingFaq } from "@/components/pricing/pricing-page";
import { faqItemsFor } from "@/components/pricing/pricing-data";
import { jsonLd, pricingGraph } from "@/lib/structured-data";
import { isPaymentsConfigured } from "@/lib/payments";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { CONTENT_UPDATED, formatUpdated } from "@/config/content-dates";
import { buildAlternates, openGraphLocale, resolveOgImage } from "@/lib/seo";
import { packOffers, planOffers, usd } from "@/lib/pricing-offers";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const alternates = buildAlternates("/pricing", locale);

  const isZh = locale === "zh";
  // Every figure comes from the pricing config, so a price change cannot leave the title behind.
  // Titles and descriptions stay inside a search result (60 and 160 wide; pnpm check:site).
  // Titles use the short "$9.9" searchers type; the page itself writes US$.
  const short = (value: number) => usd(value).replace(/^US\$/, "$");
  const from = short(planOffers()[0].monthlyPriceUsd);
  const packFrom = short(Math.min(...packOffers().map((pack) => pack.priceUsd)));
  const title = isZh
    ? `AI 视频生成器价格与套餐：月付 ${from} 起 | ${siteConfig.name}`
    : `AI Video Generator Pricing: Plans from ${from}/mo | ${siteConfig.name}`;
  const description = isZh
    ? `月付 ${from} 起，一站调用 Veo 3.1、Kling 4.0、Seedance 2.5、Wan 2.6 等全部模型。成片无水印、可商用，生成失败自动退积分；不想订阅可买 ${packFrom} 起的积分包。`
    : `Plans from ${from}/mo for Veo 3.1, Kling 4.0, Seedance 2.5 and more, with credits back on failed generations. Or skip the plan: credit packs from ${packFrom}.`;
  const ogImage = resolveOgImage();

  return {
    // The full title, without the site-wide "| aivd.ai" template added a second time.
    title: { absolute: title },
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

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  // Plans, the free credits and the FAQ for search engines and AI answers,
  // from the same config and FAQ list the page renders.
  const structuredData = pricingGraph(
    locale,
    faqItemsFor(locale).map((item) => ({ q: item.question, a: item.answer })),
  );

  // Same pricing block as the homepage, buying in place, then the FAQ.
  return (
    <div className="bg-[var(--du-bg)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }} />
      <HomePricing lang={locale} asPage checkout={{ enabled: isPaymentsConfigured() }} />
      <PricingFaq locale={locale} />
      <p className="mx-auto max-w-3xl px-6 pb-16 text-center text-[13px] text-[var(--ds-text-3)]">
        {locale === "zh" ? "价格更新于 " : "Prices last updated "}
        <time dateTime={CONTENT_UPDATED.pricing}>{formatUpdated(CONTENT_UPDATED.pricing, locale === "zh")}</time>
      </p>
    </div>
  );
}
