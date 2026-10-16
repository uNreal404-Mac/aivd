import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { i18n, type Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { isNoIndexEnvironment, NOINDEX_ROBOTS } from "@/lib/indexing";
import {
  MODEL_SEO,
  MODEL_SLUGS,
  buildFaqJsonLd,
  getCapabilities,
  getModelSeo,
  modelHref,
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

  const path = `/models/${slug}`;
  const localePrefix = locale === i18n.defaultLocale ? "" : `/${locale}`;

  return {
    title: entry.title,
    description: entry.description,
    alternates: buildAlternates(path, locale),
    openGraph: {
      title: entry.title,
      description: entry.description,
      url: `${siteConfig.url}${localePrefix}${path}`,
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
  background: "var(--ms-surface)",
  border: "1px solid var(--ms-border)",
  borderRadius: "var(--ms-radius)",
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

  const capabilities = getCapabilities(entry.modelId);
  const otherModels = MODEL_SEO.filter((model) => model.slug !== entry.slug);
  const steps = [
    "Write a prompt",
    `Pick ${entry.name} and settings`,
    "Generate and download",
  ];

  return (
    <main style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={h1Style}>{entry.name} AI Video Generator</h1>
        <p style={introStyle}>{entry.intro}</p>

        <a href={tryHref(locale, entry)} style={buttonStyle}>
          Try {entry.name}
        </a>

        {capabilities && (
          <section style={sectionStyle}>
            <h2 style={h2Style}>Capabilities</h2>
            <ul style={listStyle}>
              <li>
                Durations:{" "}
                {capabilities.durations.map((d) => `${d}s`).join(", ")}
              </li>
              {capabilities.resolutions.length > 0 && (
                <li>Resolutions: {capabilities.resolutions.join(", ")}</li>
              )}
              <li>Aspect ratios: {capabilities.aspectRatios.join(", ")}</li>
              <li>
                Image to video: {capabilities.imageToVideo ? "Yes" : "No"}
              </li>
            </ul>
          </section>
        )}

        <section style={sectionStyle}>
          <h2 style={h2Style}>Use cases</h2>
          <ul style={listStyle}>
            {entry.useCases.map((useCase) => (
              <li key={useCase}>{useCase}</li>
            ))}
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>How to use</h2>
          <ol style={listStyle}>
            {steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>FAQ</h2>
          {entry.faqs.map((faq) => (
            <details key={faq.q} style={detailsStyle}>
              <summary style={summaryStyle}>{faq.q}</summary>
              <p style={answerStyle}>{faq.a}</p>
            </details>
          ))}
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>Other models</h2>
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
          __html: JSON.stringify(buildFaqJsonLd(entry)),
        }}
      />
    </main>
  );
}
