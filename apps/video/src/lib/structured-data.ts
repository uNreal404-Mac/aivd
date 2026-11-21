/**
 * schema.org data (JSON-LD) shared by the layout and pages. Prices and FAQ
 * answers are read from the same config the pages render, so the data can
 * never say something the page does not.
 */
import { CONTENT_UPDATED } from "@/config/content-dates";
import { i18n, localeConfig } from "@/config/i18n-config";
import { NEW_USER_GIFT, SUBSCRIPTION_PRODUCTS } from "@/config/pricing-user";
import { SUPPORT_EMAIL, siteConfig } from "@/config/site";
import { packOffers } from "@/lib/pricing-offers";
import { getLocaleUrl } from "@/lib/seo";

type Json = Record<string, unknown>;

export const ORGANIZATION_ID = `${siteConfig.url}/#organization`;
export const WEBSITE_ID = `${siteConfig.url}/#website`;

/** JSON for a <script type="application/ld+json">, with "<" escaped so it can never close the element. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function isZh(locale: string): boolean {
  return locale.toLowerCase().startsWith("zh");
}

/** The official profiles that are filled in, for sameAs. */
export function sameAsLinks(links: Record<string, string | undefined> = siteConfig.links): string[] {
  return Object.values(links).filter((link): link is string => Boolean(link?.trim()));
}

/** Organization and WebSite, linked by @id; rendered once in the root layout. */
export function siteGraph(): Json {
  const sameAs = sameAsLinks();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        logo: { "@type": "ImageObject", url: `${siteConfig.url}/logo.svg` },
        ...(SUPPORT_EMAIL
          ? {
              email: SUPPORT_EMAIL,
              contactPoint: { "@type": "ContactPoint", contactType: "customer support", email: SUPPORT_EMAIL, availableLanguage: ["English", "Chinese"] },
            }
          : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        inLanguage: i18n.locales.map((locale) => localeConfig[locale].hreflang),
        publisher: { "@id": ORGANIZATION_ID },
      },
    ],
  };
}

/** FAQPage from question/answer pairs. */
export function faqPage(faqs: { q: string; a: string }[], locale: string): Json {
  return {
    "@type": "FAQPage",
    inLanguage: isZh(locale) ? "zh-CN" : "en",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

/** BreadcrumbList from (name, path) pairs; paths are without the locale prefix. */
export function breadcrumbList(items: { name: string; path: string }[], locale: string): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getLocaleUrl(item.path, locale as (typeof i18n.locales)[number]),
    })),
  };
}

function planLabel(name: string): string {
  return name.replace(/\s*\((?:yearly|annual|year)\)\s*$/i, "").replace(/\s*plan$/i, "").trim();
}

/**
 * The offers shown on /pricing: the free sign-up credits and every enabled
 * plan, monthly and yearly, at its list price. Checkout-only discounts (the
 * first-month offer) are left out because the list price is what is promised.
 */
export function pricingOffers(locale: string): Json[] {
  const zh = isZh(locale);
  const url = getLocaleUrl("/pricing", locale as (typeof i18n.locales)[number]);
  const offers: Json[] = [];

  if (NEW_USER_GIFT.enabled) {
    offers.push({
      "@type": "Offer",
      name: zh ? "免费试用" : "Free trial",
      description: zh
        ? `注册即送 ${NEW_USER_GIFT.credits} 积分，${NEW_USER_GIFT.validDays} 天内有效，无需绑卡。`
        : `${NEW_USER_GIFT.credits} free credits on sign-up, valid for ${NEW_USER_GIFT.validDays} days. No card needed.`,
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url,
    });
  }

  for (const plan of SUBSCRIPTION_PRODUCTS) {
    if (!plan.enabled) continue;
    const label = planLabel(plan.name);
    const yearly = plan.period === "year";
    offers.push({
      "@type": "Offer",
      name: zh ? `${label} ${yearly ? "年付" : "月付"}` : `${label} ${yearly ? "yearly" : "monthly"}`,
      description: zh
        ? `每${yearly ? "年" : "月"} ${plan.credits.toLocaleString("en-US")} 积分`
        : `${plan.credits.toLocaleString("en-US")} credits per ${yearly ? "year" : "month"}`,
      price: plan.priceUsd.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url,
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: plan.priceUsd.toFixed(2),
        priceCurrency: "USD",
        billingDuration: 1,
        unitCode: yearly ? "ANN" : "MON",
      },
    });
  }

  for (const pack of packOffers()) {
    offers.push({
      "@type": "Offer",
      name: zh ? `${pack.credits.toLocaleString("en-US")} 积分包` : `${pack.credits.toLocaleString("en-US")} credit pack`,
      description: zh ? "一次性购买，不用订阅" : "One-time purchase, no subscription",
      price: pack.priceUsd.toFixed(2),
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      url,
    });
  }

  return offers;
}

/** SoftwareApplication with the pricing offers, plus the page's FAQ, for /pricing. */
export function pricingGraph(locale: string, faqs: { q: string; a: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: siteConfig.name,
        url: siteConfig.url,
        description: siteConfig.description,
        applicationCategory: "MultimediaApplication",
        operatingSystem: "Web",
        publisher: { "@id": ORGANIZATION_ID },
        dateModified: CONTENT_UPDATED.pricing,
        offers: pricingOffers(locale),
      },
      faqPage(faqs, locale),
    ],
  };
}

/**
 * A feature page (/text-to-video and the like): where it sits in the site,
 * when its facts were last checked, and its questions.
 */
export function featurePageGraph(input: {
  path: string;
  name: string;
  description: string;
  locale: string;
  faqs: { q: string; a: string }[];
  dateModified: string;
}): Json {
  const zh = isZh(input.locale);
  const url = getLocaleUrl(input.path, input.locale as (typeof i18n.locales)[number]);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: input.name,
        description: input.description,
        inLanguage: zh ? "zh-CN" : "en",
        dateModified: input.dateModified,
        isPartOf: { "@id": WEBSITE_ID },
        publisher: { "@id": ORGANIZATION_ID },
      },
      breadcrumbList(
        [
          { name: siteConfig.name, path: "/" },
          { name: input.name, path: input.path },
        ],
        input.locale,
      ),
      faqPage(input.faqs, input.locale),
    ],
  };
}
