import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GLASS_CARD } from "@/components/ui/glass";
import { i18n, type Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { isNoIndexEnvironment, NOINDEX_ROBOTS } from "@/lib/indexing";
import {
  MODEL_PAGE_COPY,
  MODEL_SEO,
  MODEL_SLUGS,
  buildFaqJsonLd,
  getCapabilities,
  getModelSeo,
  localizeModelSeo,
  modelHref,
  resolveLocale,
  tryHref,
} from "@/lib/model-seo";
import { buildAlternates } from "@/lib/seo";

import "@/styles/model-seo-tokens.css";

export const dynamicParams = false;

interface ModelSeoPageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export function generateStaticParams() {
  return i18n.locales.flatMap((locale) =>
    MODEL_SLUGS.map((slug) => ({ locale, slug }))
  );
}

export async function generateMetadata({
  params,
}: ModelSeoPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const entry = getModelSeo(slug);

  // Unknown slugs are handled by notFound() in the page, so keep metadata safe.
  if (!entry) {
    return {};
  }

  const loc = resolveLocale(locale);
  const copy = localizeModelSeo(entry, loc);
  const path = `/models/${slug}`;
  const localePrefix = locale === i18n.defaultLocale ? "" : `/${locale}`;

  return {
    title: copy.title,
    description: copy.description,
    alternates: buildAlternates(path, locale),
    openGraph: {
      title: copy.title,
      description: copy.description,
      url: `${siteConfig.url}${localePrefix}${path}`,
      locale: loc === "zh" ? "zh_CN" : "en_US",
    },
    robots: isNoIndexEnvironment() ? NOINDEX_ROBOTS : undefined,
  };
}

const pageStyle: CSSProperties = {
  background: "var(--ms-bg)",
  color: "var(--ms-text)",
  minHeight: "100vh",
};

const containerStyle: CSSProperties = {
  maxWidth: "840px",
  margin: "0 auto",
  padding: "48px 24px 64px",
};

const h1Style: CSSProperties = {
  margin: "0 0 16px",
  fontSize: "38px",
  lineHeight: 1.2,
  color: "var(--ms-text)",
};

const introStyle: CSSProperties = {
  margin: "0 0 24px",
  fontSize: "18px",
  color: "var(--ms-muted)",
};

const sectionStyle: CSSProperties = {
  marginTop: "40px",
};

const h2Style: CSSProperties = {
  margin: "0 0 8px",
  fontSize: "22px",
  color: "var(--ms-text)",
};

const listStyle: CSSProperties = {
  margin: "12px 0 0",
  paddingLeft: "20px",
  color: "var(--ms-muted)",
};

const buttonStyle: CSSProperties = {
  display: "inline-block",
  background: "var(--ms-accent)",
  color: "var(--ms-on-accent)",
  borderRadius: "var(--ms-radius)",
  padding: "14px 24px",
  fontWeight: 600,
  textDecoration: "none",
};

const cardStyle: CSSProperties = {
  padding: "24px",
};

const detailsStyle: CSSProperties = {
  ...cardStyle,
  marginBottom: "12px",
};

const summaryStyle: CSSProperties = {
  cursor: "pointer",
  fontWeight: 600,
  color: "var(--ms-text)",
};

const answerStyle: CSSProperties = {
  margin: "12px 0 0",
  color: "var(--ms-muted)",
};

const linkStyle: CSSProperties = {
  color: "var(--ms-accent)",
  textDecoration: "none",
};

export default async function ModelSeoPage({ params }: ModelSeoPageProps) {
  const { locale, slug } = await params;
  const entry = getModelSeo(slug);

  if (!entry) {
    notFound();
  }

  const loc = resolveLocale(locale);
  const copy = MODEL_PAGE_COPY[loc];
  const localized = localizeModelSeo(entry, loc);

  const capabilities = getCapabilities(entry.modelId);
  const otherModels = MODEL_SEO.filter((model) => model.slug !== entry.slug);
  const steps = copy.steps(localized.name);

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={h1Style}>{copy.h1(localized.name)}</h1>
        <p style={introStyle}>{localized.intro}</p>

        <a href={tryHref(locale, entry)} style={buttonStyle}>
          {copy.tryLabel(localized.name)}
        </a>

        {capabilities && (
          <section style={sectionStyle}>
            <h2 style={h2Style}>{copy.capabilitiesHeading}</h2>
            <ul style={listStyle}>
              <li>
                {copy.durations}:{" "}
                {capabilities.durations
                  .map((d) => `${d}${copy.secondsSuffix}`)
                  .join(", ")}
              </li>
              {capabilities.resolutions.length > 0 && (
                <li>
                  {copy.resolutions}: {capabilities.resolutions.join(", ")}
                </li>
              )}
              <li>
                {copy.aspectRatios}: {capabilities.aspectRatios.join(", ")}
              </li>
              <li>
                {copy.imageToVideo}:{" "}
                {capabilities.imageToVideo ? copy.yes : copy.no}
              </li>
            </ul>
          </section>
        )}

        <section style={sectionStyle}>
          <h2 style={h2Style}>{copy.useCasesHeading}</h2>
          <ul style={listStyle}>
            {localized.useCases.map((useCase) => (
              <li key={useCase}>{useCase}</li>
            ))}
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{copy.howToHeading}</h2>
          <ol style={listStyle}>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{copy.faqHeading}</h2>
          {localized.faqs.map((faq) => (
            <details className={GLASS_CARD} key={faq.q} style={detailsStyle}>
              <summary style={summaryStyle}>{faq.q}</summary>
              <p style={answerStyle}>{faq.a}</p>
            </details>
          ))}
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{copy.otherModelsHeading}</h2>
          <ul style={listStyle}>
            {otherModels.map((model) => (
              <li key={model.slug}>
                <a href={modelHref(locale, model.slug)} style={linkStyle}>
                  {model.name}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildFaqJsonLd(entry, loc)),
        }}
      />
    </main>
  );
}
