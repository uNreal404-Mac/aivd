import type { CSSProperties } from "react";
import type { Metadata } from "next";

import { i18n, type Locale } from "@/config/i18n-config";
import { siteConfig } from "@/config/site";
import { getModelConfig, calculateModelCredits } from "@/config/credits";
import { isNoIndexEnvironment, NOINDEX_ROBOTS } from "@/lib/indexing";
import { buildAlternates, getLocaleUrl, resolveOgImage } from "@/lib/seo";
import {
  aiVideoGeneratorEn,
  type AiVideoGeneratorContent,
  type ModelStatus,
} from "@/content/seo/ai-video-generator.en";
import { aiVideoGeneratorZh } from "@/content/seo/ai-video-generator.zh";

import "@/styles/model-seo-tokens.css";

const PATH = "/ai-video-generator";
const SEEDANCE_MODEL_ID = "seedance-1.5-pro";

interface Props {
  params: Promise<{ locale: Locale }>;
}

function getContent(locale: Locale): AiVideoGeneratorContent {
  return locale === "zh" ? aiVideoGeneratorZh : aiVideoGeneratorEn;
}

function localePath(locale: Locale, path: string): string {
  const normalized = path === "/" ? "" : path;
  if (locale === i18n.defaultLocale) {
    return normalized === "" ? "/" : normalized;
  }
  return normalized === "" ? `/${locale}` : `/${locale}${normalized}`;
}

function jsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

function statusPillStyle(status: ModelStatus): CSSProperties {
  const isLive = status === "available";
  return {
    display: "inline-block",
    padding: "var(--ms-space-1) var(--ms-space-2)",
    borderRadius: "999px",
    border: "var(--ms-border-width) solid var(--ms-border-color)",
    background: isLive ? "var(--ms-accent)" : "var(--ms-surface-muted)",
    color: isLive ? "var(--ms-on-accent)" : "var(--ms-muted)",
    fontSize: "var(--ms-font-small)",
    fontWeight: 600,
    whiteSpace: "nowrap",
  };
}

const pageStyle: CSSProperties = {
  background: "var(--ms-bg)",
  color: "var(--ms-text)",
  minHeight: "100vh",
  lineHeight: "var(--ms-line-height)",
};

const containerStyle: CSSProperties = {
  maxWidth: "var(--ms-page-max-width)",
  width: "100%",
  margin: "0 auto",
  padding: "var(--ms-space-6) var(--ms-space-5) var(--ms-space-8)",
  boxSizing: "border-box",
};

const breadcrumbStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "var(--ms-space-2)",
  marginBottom: "var(--ms-space-5)",
  fontSize: "var(--ms-font-small)",
  color: "var(--ms-muted)",
};

const breadcrumbLinkStyle: CSSProperties = {
  color: "var(--ms-muted)",
  textDecoration: "none",
};

const breadcrumbSeparatorStyle: CSSProperties = {
  color: "var(--ms-muted)",
};

const breadcrumbCurrentStyle: CSSProperties = {
  color: "var(--ms-text)",
};

const heroStyle: CSSProperties = {
  marginBottom: "var(--ms-space-7)",
};

const eyebrowStyle: CSSProperties = {
  margin: "0 0 var(--ms-space-3)",
  color: "var(--ms-accent)",
  fontSize: "var(--ms-font-small)",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const h1Style: CSSProperties = {
  margin: "0 0 var(--ms-space-4)",
  color: "var(--ms-text)",
  fontSize: "var(--ms-font-h1)",
  lineHeight: "var(--ms-line-height-tight)",
};

const leadStyle: CSSProperties = {
  margin: "0 0 var(--ms-space-3)",
  color: "var(--ms-muted)",
  fontSize: "var(--ms-font-body)",
};

const generatorEntryStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--ms-space-3)",
  marginTop: "var(--ms-space-5)",
  padding: "var(--ms-space-5)",
  background: "var(--ms-surface-muted)",
  border: "var(--ms-border-width) solid var(--ms-border-color)",
  borderRadius: "var(--ms-radius)",
};

const buttonStyle: CSSProperties = {
  display: "inline-block",
  width: "100%",
  maxWidth: "360px",
  boxSizing: "border-box",
  padding: "var(--ms-space-3) var(--ms-space-5)",
  background: "var(--ms-accent)",
  color: "var(--ms-on-accent)",
  border: "var(--ms-border-width) solid var(--ms-accent)",
  borderRadius: "var(--ms-radius-sm)",
  fontSize: "var(--ms-font-body)",
  fontWeight: 600,
  textAlign: "center",
  textDecoration: "none",
};

const ctaNoteStyle: CSSProperties = {
  margin: 0,
  color: "var(--ms-muted)",
  fontSize: "var(--ms-font-small)",
};

const sectionStyle: CSSProperties = {
  marginTop: "var(--ms-space-7)",
};

const h2Style: CSSProperties = {
  margin: "0 0 var(--ms-space-3)",
  color: "var(--ms-text)",
  fontSize: "var(--ms-font-h2)",
  lineHeight: "var(--ms-line-height-tight)",
};

const h3Style: CSSProperties = {
  margin: "0 0 var(--ms-space-2)",
  color: "var(--ms-text)",
  fontSize: "var(--ms-font-h3)",
  lineHeight: "var(--ms-line-height-tight)",
};

const paragraphStyle: CSSProperties = {
  margin: "0 0 var(--ms-space-3)",
  color: "var(--ms-muted)",
};

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "var(--ms-space-4)",
  marginTop: "var(--ms-space-4)",
};

const cardStyle: CSSProperties = {
  padding: "var(--ms-space-5)",
  background: "var(--ms-surface)",
  border: "var(--ms-border-width) solid var(--ms-border-color)",
  borderRadius: "var(--ms-radius)",
};

const cardBodyStyle: CSSProperties = {
  margin: 0,
  color: "var(--ms-muted)",
  fontSize: "var(--ms-font-body)",
};

const tableWrapStyle: CSSProperties = {
  width: "100%",
  overflowX: "auto",
  marginTop: "var(--ms-space-4)",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: "var(--ms-font-small)",
  background: "var(--ms-surface)",
  borderRadius: "var(--ms-radius-sm)",
};

const modelsTableStyle: CSSProperties = {
  ...tableStyle,
  minWidth: "640px",
};

const captionStyle: CSSProperties = {
  padding: "var(--ms-space-2) 0",
  color: "var(--ms-muted)",
  fontSize: "var(--ms-font-small)",
  textAlign: "left",
};

const thStyle: CSSProperties = {
  padding: "var(--ms-space-3)",
  background: "var(--ms-surface-muted)",
  color: "var(--ms-text)",
  fontSize: "var(--ms-font-small)",
  fontWeight: 600,
  textAlign: "left",
  verticalAlign: "top",
  border: "var(--ms-border-width) solid var(--ms-border-color)",
};

const tdStyle: CSSProperties = {
  padding: "var(--ms-space-3)",
  color: "var(--ms-muted)",
  textAlign: "left",
  verticalAlign: "top",
  border: "var(--ms-border-width) solid var(--ms-border-color)",
};

const rowHeaderStyle: CSSProperties = {
  ...tdStyle,
  color: "var(--ms-text)",
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const footnoteStyle: CSSProperties = {
  margin: "var(--ms-space-3) 0 0",
  color: "var(--ms-muted)",
  fontSize: "var(--ms-font-small)",
};

const linkStyle: CSSProperties = {
  color: "var(--ms-accent)",
  textDecoration: "none",
  fontWeight: 600,
};

const stepListStyle: CSSProperties = {
  margin: "var(--ms-space-4) 0 0",
  paddingLeft: "var(--ms-space-5)",
  color: "var(--ms-muted)",
};

const stepItemStyle: CSSProperties = {
  marginBottom: "var(--ms-space-5)",
};

const bulletListStyle: CSSProperties = {
  margin: "var(--ms-space-4) 0 0",
  paddingLeft: "var(--ms-space-5)",
  color: "var(--ms-muted)",
};

const bulletItemStyle: CSSProperties = {
  marginBottom: "var(--ms-space-3)",
};

const detailsStyle: CSSProperties = {
  ...cardStyle,
  marginBottom: "var(--ms-space-3)",
};

const summaryStyle: CSSProperties = {
  cursor: "pointer",
  color: "var(--ms-text)",
  fontWeight: 600,
};

const answerStyle: CSSProperties = {
  margin: "var(--ms-space-3) 0 0",
  color: "var(--ms-muted)",
};

const relatedListStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "var(--ms-space-2) var(--ms-space-5)",
  margin: "var(--ms-space-3) 0 0",
  padding: 0,
  listStyle: "none",
};

const finalCtaStyle: CSSProperties = {
  ...cardStyle,
  marginTop: "var(--ms-space-8)",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "var(--ms-space-3)",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const content = getContent(locale);
  const ogImage = resolveOgImage();

  return {
    title: content.meta.title,
    description: content.meta.description,
    alternates: buildAlternates(PATH, locale),
    openGraph: {
      title: content.meta.title,
      description: content.meta.description,
      url: getLocaleUrl(PATH, locale),
      siteName: siteConfig.name,
      locale: locale === "zh" ? "zh_CN" : "en_US",
      type: "website",
      images: ogImage ? [ogImage] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: content.meta.title,
      description: content.meta.description,
    },
    robots: isNoIndexEnvironment() ? NOINDEX_ROBOTS : undefined,
  };
}

export default async function AiVideoGeneratorPage({ params }: Props) {
  const { locale } = await params;
  const content = getContent(locale);
  const zh = locale === "zh";
  const inLanguage = zh ? "zh-CN" : "en";

  const seedance = getModelConfig(SEEDANCE_MODEL_ID);
  const durations = seedance?.durations ?? [];
  const pricingRows = durations.map((duration) => ({
    durationLabel: zh ? `${duration} 秒` : `${duration}s`,
    credits: calculateModelCredits(SEEDANCE_MODEL_ID, {
      duration,
      quality: "720p",
    }),
  }));

  const homeHref = localePath(locale, "/");
  const generatorHref = localePath(locale, "/image-to-video");

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage,
    mainEntity: content.faq.items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: content.breadcrumb.home,
        item: getLocaleUrl("/", locale),
      },
      {
        "@type": "ListItem",
        position: 2,
        name: content.breadcrumb.current,
        item: getLocaleUrl(PATH, locale),
      },
    ],
  };

  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "aivd.ai AI Video Generator",
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    url: getLocaleUrl(PATH, locale),
    description: content.meta.description,
    inLanguage,
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: getLocaleUrl("/", locale),
    },
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <nav aria-label="Breadcrumb" style={breadcrumbStyle}>
          <a href={homeHref} style={breadcrumbLinkStyle}>
            {content.breadcrumb.home}
          </a>
          <span aria-hidden="true" style={breadcrumbSeparatorStyle}>
            ›
          </span>
          <span style={breadcrumbCurrentStyle}>{content.breadcrumb.current}</span>
        </nav>

        <header style={heroStyle}>
          <p style={eyebrowStyle}>{content.hero.eyebrow}</p>
          <h1 style={h1Style}>{content.hero.h1}</h1>
          {content.hero.intro.map((paragraph) => (
            <p key={paragraph} style={leadStyle}>
              {paragraph}
            </p>
          ))}
          {/* TODO(T2): replace this entry card with the shared <HeroGenerator /> component */}
          <div style={generatorEntryStyle}>
            <a href={generatorHref} style={buttonStyle}>
              {content.hero.ctaLabel}
            </a>
            <p style={ctaNoteStyle}>{content.hero.ctaNote}</p>
            <p style={ctaNoteStyle}>
              <a
                href={localePath(locale, content.hero.secondaryCta.path)}
                style={linkStyle}
              >
                {content.hero.secondaryCta.label}
              </a>
            </p>
          </div>
        </header>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.overview.heading}</h2>
          {content.overview.paragraphs.map((paragraph) => (
            <p key={paragraph} style={paragraphStyle}>
              {paragraph}
            </p>
          ))}
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.features.heading}</h2>
          <p style={paragraphStyle}>{content.features.intro}</p>
          <div style={gridStyle}>
            {content.features.items.map((item) => (
              <article key={item.title} style={cardStyle}>
                <h3 style={h3Style}>{item.title}</h3>
                <p style={cardBodyStyle}>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.models.heading}</h2>
          <p style={paragraphStyle}>{content.models.intro}</p>
          <div style={tableWrapStyle}>
            <table style={modelsTableStyle}>
              <thead>
                <tr>
                  <th scope="col" style={thStyle}>
                    {content.models.columns.model}
                  </th>
                  <th scope="col" style={thStyle}>
                    {content.models.columns.status}
                  </th>
                  <th scope="col" style={thStyle}>
                    {content.models.columns.modes}
                  </th>
                  <th scope="col" style={thStyle}>
                    {content.models.columns.notes}
                  </th>
                </tr>
              </thead>
              <tbody>
                {content.models.rows.map((row) => (
                  <tr key={row.name}>
                    <th scope="row" style={rowHeaderStyle}>
                      {row.name}
                    </th>
                    <td style={tdStyle}>
                      <span style={statusPillStyle(row.status)}>
                        {content.models.statusLabels[row.status]}
                      </span>
                    </td>
                    <td style={tdStyle}>{row.modes}</td>
                    <td style={tdStyle}>{row.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={footnoteStyle}>{content.models.footnote}</p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.pricing.heading}</h2>
          {content.pricing.paragraphs.map((paragraph) => (
            <p key={paragraph} style={paragraphStyle}>
              {paragraph}
            </p>
          ))}
          <div style={tableWrapStyle}>
            <table style={tableStyle}>
              <caption style={captionStyle}>{content.pricing.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col" style={thStyle}>
                    {content.pricing.columns.duration}
                  </th>
                  <th scope="col" style={thStyle}>
                    {content.pricing.columns.credits}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pricingRows.map((row) => (
                  <tr key={row.durationLabel}>
                    <th scope="row" style={rowHeaderStyle}>
                      {row.durationLabel}
                    </th>
                    <td style={tdStyle}>{row.credits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p style={footnoteStyle}>
            <a href={localePath(locale, content.pricing.link.path)} style={linkStyle}>
              {content.pricing.link.label}
            </a>
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.useCases.heading}</h2>
          <p style={paragraphStyle}>{content.useCases.intro}</p>
          <div style={gridStyle}>
            {content.useCases.items.map((item) => (
              <article key={item.title} style={cardStyle}>
                <h3 style={h3Style}>{item.title}</h3>
                <p style={cardBodyStyle}>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.steps.heading}</h2>
          <p style={paragraphStyle}>{content.steps.intro}</p>
          <ol style={stepListStyle}>
            {content.steps.items.map((step) => (
              <li key={step.title} style={stepItemStyle}>
                <h3 style={h3Style}>{step.title}</h3>
                <p style={cardBodyStyle}>{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.tips.heading}</h2>
          <p style={paragraphStyle}>{content.tips.intro}</p>
          <ul style={bulletListStyle}>
            {content.tips.items.map((tip) => (
              <li key={tip} style={bulletItemStyle}>
                {tip}
              </li>
            ))}
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.faq.heading}</h2>
          {content.faq.items.map((item) => (
            <details key={item.q} style={detailsStyle}>
              <summary style={summaryStyle}>{item.q}</summary>
              <p style={answerStyle}>{item.a}</p>
            </details>
          ))}
        </section>

        <section style={sectionStyle}>
          <h2 style={h2Style}>{content.related.heading}</h2>
          <ul style={relatedListStyle}>
            {content.related.links.map((link) => (
              <li key={link.path}>
                <a href={localePath(locale, link.path)} style={linkStyle}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section style={finalCtaStyle}>
          <h2 style={h2Style}>{content.finalCta.heading}</h2>
          <p style={cardBodyStyle}>{content.finalCta.body}</p>
          <a href={generatorHref} style={buttonStyle}>
            {content.finalCta.ctaLabel}
          </a>
        </section>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(softwareJsonLd) }}
      />
    </div>
  );
}
