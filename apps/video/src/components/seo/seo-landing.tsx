import {
  faqJsonLd,
  generatorHref,
  howToJsonLd,
  seoLandingFor,
  type SeoLandingSlug,
} from "@/lib/seo-landing";

interface SeoLandingProps {
  slug: SeoLandingSlug;
  locale: string;
  headingLevel: "h1" | "h2";
  showHeroEntry?: boolean;
}

function tableLabels(locale: string) {
  return locale === "zh"
    ? { model: "模型", bestFor: "适合", input: "输入" }
    : { model: "Model", bestFor: "Best for", input: "Input" };
}

export function SeoLanding({
  slug,
  locale,
  headingLevel,
  showHeroEntry = false,
}: SeoLandingProps) {
  const content = seoLandingFor(slug, locale);
  const labels = tableLabels(locale);

  return (
    <section className="seo-landing">
      <header className="seo-hero">
        {headingLevel === "h1" ? (
          <h1 className="seo-hero-title">{content.h1}</h1>
        ) : (
          <h2 className="seo-hero-title">{content.h1}</h2>
        )}
        <p className="seo-hero-sub">{content.heroSub}</p>
        {showHeroEntry ? (
          <form
            className="seo-entry"
            method="get"
            action={generatorHref(locale, slug)}
          >
            <textarea
              className="seo-textarea"
              name="prompt"
              aria-label={content.promptPlaceholder}
              placeholder={content.promptPlaceholder}
              rows={3}
            />
            <button className="seo-submit" type="submit">
              {content.ctaLabel}
            </button>
          </form>
        ) : null}
      </header>

      <div className="seo-section">
        <h2 className="seo-section-title">{content.whatTitle}</h2>
        <div className="seo-body">
          {content.whatBody.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </div>

      <div className="seo-section">
        <h2 className="seo-section-title">{content.stepsTitle}</h2>
        <ol className="seo-steps">
          {content.steps.map((step, index) => (
            <li className="seo-step" key={step.title}>
              <span className="seo-step-index" aria-hidden="true">
                {index + 1}
              </span>
              <h3 className="seo-step-title">{step.title}</h3>
              <p className="seo-step-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="seo-section">
        <h2 className="seo-section-title">{content.compareTitle}</h2>
        <div className="seo-table-wrap">
          <table className="seo-table">
            <thead>
              <tr>
                <th scope="col">{labels.model}</th>
                <th scope="col">{labels.bestFor}</th>
                <th scope="col">{labels.input}</th>
              </tr>
            </thead>
            <tbody>
              {content.compareRows.map((row) => (
                <tr key={row.model}>
                  <th scope="row">{row.model}</th>
                  <td>{row.bestFor}</td>
                  <td>{row.input}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="seo-section">
        <h2 className="seo-section-title">{content.faqTitle}</h2>
        <div className="seo-faq">
          {content.faq.map((item) => (
            <details className="seo-faq-item" key={item.q}>
              <summary className="seo-faq-question">{item.q}</summary>
              <p className="seo-faq-answer">{item.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(content)) }}
      />
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd(content)) }}
      />
    </section>
  );
}
