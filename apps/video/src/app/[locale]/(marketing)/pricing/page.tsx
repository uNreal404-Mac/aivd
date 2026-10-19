import "@/styles/pricing-tokens.css";
import { PricingPage as PricingPageView } from "@/components/pricing/pricing-page";
import {
  buildPricingJsonLd,
  faqItemsFor,
  isPopular,
  pricingCopy,
  type FaqFacts,
  type PricingProduct,
} from "@/components/pricing/pricing-data";
import {
  CREDITS_CONFIG,
  calculateModelCredits,
  getModelConfig,
  getOnetimeProducts,
  getProductExpiryDays,
  getSubscriptionProducts,
} from "@/config/credits";
import { LEGAL_CONFIG } from "@/config/legal";
import {
  IMAGE_CREDITS_PER_IMAGE,
  MUSIC_CREDITS_PER_REQUEST,
  MUSIC_TRACKS_PER_REQUEST,
} from "@/config/media-credit-display";
import { isPaymentsConfigured } from "@/lib/payments";
import type { Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { buildAlternates, getLocaleUrl, resolveOgImage } from "@/lib/seo";

/** Video model whose credit cost we advertise on the pricing page. */
const PRICING_VIDEO_MODEL = "seedance-1.5-pro";
const PRICING_VIDEO_QUALITY = "720p";

const jsonLd = (o: unknown): string =>
  JSON.stringify(o).replace(/</g, "\\u003c");

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const alternates = buildAlternates("/pricing", locale);

  const isZh = locale === "zh";
  const title = isZh ? "价格方案与积分（美元计价）" : "Pricing — Plans & Credits in USD";
  const description = isZh
    ? "比较 aivd.ai 的月付、年付方案与一次性积分包，所有价格均以美元（USD）计价，生成前即可看到积分消耗。"
    : "Compare aivd.ai plans and credit packs for AI video generation. All prices in US dollars (USD), credit costs shown up front, cancel anytime.";
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
  const copy = pricingCopy(locale);

  /* -------- credit validity, straight from config -------- */
  const monthlyValidityDays = CREDITS_CONFIG.expiration.subscriptionDays;
  const packValidityDays = CREDITS_CONFIG.expiration.purchaseDays;
  const gift = CREDITS_CONFIG.registerGift;

  /* -------- subscriptions -------- */
  const subscriptionConfigs = getSubscriptionProducts();
  const subscriptions: PricingProduct[] = subscriptionConfigs.map(
    (product) => {
      const billingPeriod: "month" | "year" =
        product.billingPeriod === "year" ? "year" : "month";
      return {
        id: product.id,
        name: product.name,
        credits: product.credits,
        price: {
          amount: product.price.amount,
          currency: product.price.currency,
        },
        billingPeriod,
        popular: isPopular(product),
        validityDays:
          billingPeriod === "year"
            ? getProductExpiryDays(product)
            : monthlyValidityDays,
      };
    }
  );

  const monthlyPlans = subscriptions.filter(
    (plan) => plan.billingPeriod === "month"
  );
  const yearlyPlans = subscriptions.filter(
    (plan) => plan.billingPeriod === "year"
  );

  const yearlyValidityDays =
    yearlyPlans.length > 0
      ? Math.max(
          ...subscriptionConfigs
            .filter((product) => product.billingPeriod === "year")
            .map((product) => getProductExpiryDays(product))
        )
      : monthlyValidityDays;

  /* -------- credit packs -------- */
  const packs: PricingProduct[] = getOnetimeProducts().map((pack) => ({
    id: pack.id,
    name: pack.name,
    credits: pack.credits,
    price: {
      amount: pack.price.amount,
      currency: pack.price.currency,
    },
    validityDays: packValidityDays,
  }));

  /* -------- video credit costs (computed here, passed as numbers) -------- */
  const videoPerSecond = calculateModelCredits(PRICING_VIDEO_MODEL, {
    duration: 1,
    quality: PRICING_VIDEO_QUALITY,
  });

  const durations = getModelConfig(PRICING_VIDEO_MODEL)?.durations ?? [];
  const videoDurations = durations.map((seconds) => ({
    seconds,
    credits: calculateModelCredits(PRICING_VIDEO_MODEL, {
      duration: seconds,
      quality: PRICING_VIDEO_QUALITY,
    }),
  }));

  const cheapestVideo = videoDurations.reduce(
    (min, row) => (row.credits < min.credits ? row : min),
    videoDurations[0] ?? { seconds: 0, credits: 0 }
  );

  /* -------- feature flags -------- */
  const imageEnabled = process.env.IMAGE_GENERATION_ENABLED === "true";
  const musicEnabled = process.env.AUDIO_GENERATION_ENABLED === "true";

  /* -------- FAQ (same items rendered and emitted as JSON-LD) -------- */
  const facts: FaqFacts = {
    welcomeCredits: gift.amount,
    welcomeDays: gift.expireDays,
    giftEnabled: gift.enabled === true,
    monthlyValidityDays,
    yearlyValidityDays,
    packValidityDays,
    refundWindowDays: LEGAL_CONFIG.refundWindowDays,
    cheapestVideoSeconds: cheapestVideo.seconds,
    cheapestVideoCredits: cheapestVideo.credits,
    videoPerSecond,
    imageCredits: IMAGE_CREDITS_PER_IMAGE,
    musicCredits: MUSIC_CREDITS_PER_REQUEST,
    musicTracks: MUSIC_TRACKS_PER_REQUEST,
  };
  const faq = faqItemsFor(locale, facts);

  /* -------- JSON-LD -------- */
  const pricingUrl = getLocaleUrl("/pricing", locale);
  const homeUrl = getLocaleUrl("/", locale);

  const structuredData = buildPricingJsonLd({
    homeUrl,
    pricingUrl,
    homeLabel: copy.breadcrumbHome,
    pricingLabel: copy.breadcrumbPricing,
    productName: "aivd.ai credits",
    productDescription: copy.productDescription,
    siteName: siteConfig.name,
    subscriptions: subscriptions.map((plan) => ({
      name: plan.name,
      priceCents: plan.price.amount,
      billingPeriod: plan.billingPeriod === "year" ? "year" : "month",
    })),
    packs: packs.map((pack) => ({
      name: pack.name,
      priceCents: pack.price.amount,
    })),
    faq,
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(structuredData) }}
      />
      <PricingPageView
        locale={locale}
        paymentsEnabled={isPaymentsConfigured()}
        monthlyPlans={monthlyPlans}
        yearlyPlans={yearlyPlans}
        packs={packs}
        giftEnabled={facts.giftEnabled}
        giftCredits={facts.welcomeCredits}
        giftDays={facts.welcomeDays}
        videoPerSecond={videoPerSecond}
        videoDurations={videoDurations}
        cheapestVideoSeconds={facts.cheapestVideoSeconds}
        cheapestVideoCredits={facts.cheapestVideoCredits}
        imageEnabled={imageEnabled}
        musicEnabled={musicEnabled}
        imageCredits={facts.imageCredits}
        musicCredits={facts.musicCredits}
        musicTracks={facts.musicTracks}
        faq={faq}
      />
    </>
  );
}
