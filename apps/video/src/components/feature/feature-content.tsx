import Link from "next/link";

import { CONTENT_UPDATED, formatUpdated } from "@/config/content-dates";
import { featureCopy, type FeatureKind } from "@/lib/feature-pages";
import { featurePageGraph, jsonLd } from "@/lib/structured-data";
import { localizedHref } from "@/lib/locale-path";

import "./feature-content.css";

/**
 * The text under the generator on /text-to-video and /image-to-video: the
 * page's H1, how to use the tool, prompt tips and examples, the models and
 * their prices, the questions people search for, and links to the related
 * pages. Server-rendered, so all of it is in the HTML a search engine reads.
 */
export function FeatureContent({ kind, locale }: { kind: FeatureKind; locale: string }) {
  const zh = locale.toLowerCase().startsWith("zh");
  const copy = featureCopy(kind, zh);
  const href = (path: string) => localizedHref(locale, path);
  const graph = jsonLd(
    featurePageGraph({ path: `/${kind}`, name: copy.h1, description: copy.description, locale, faqs: copy.faqs, dateModified: CONTENT_UPDATED.features }),
  );

  return (
    <div className="fc">
      <section className="fc-hero" aria-labelledby="fc-title">
        <h1 id="fc-title" className="fc-title">
          {copy.h1}
        </h1>
        {copy.intro.map((paragraph) => (
          <p key={paragraph} className="fc-lead">
            {paragraph}
          </p>
        ))}
      </section>

      <section className="fc-section" aria-labelledby="fc-steps">
        <h2 id="fc-steps" className="fc-h2">
          {copy.stepsTitle}
        </h2>
        <ol className="fc-steps">
          {copy.steps.map((step, index) => (
            <li key={step.title} className="fc-step">
              <span className="fc-step-num" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="fc-h3">{step.title}</h3>
              <p className="fc-body">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {copy.useCases ? (
        <section className="fc-section" aria-labelledby="fc-uses">
          <h2 id="fc-uses" className="fc-h2">
            {copy.useCasesTitle}
          </h2>
          <ul className="fc-grid">
            {copy.useCases.map((item) => (
              <li key={item.title} className="fc-card">
                <h3 className="fc-h3">{item.title}</h3>
                <p className="fc-body">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="fc-section" aria-labelledby="fc-tips">
        <h2 id="fc-tips" className="fc-h2">
          {copy.tipsTitle}
        </h2>
        <ul className="fc-tips">
          {copy.tips.map((tip) => (
            <li key={tip.title} className="fc-tip">
              <h3 className="fc-h3">{tip.title}</h3>
              <p className="fc-body">{tip.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="fc-section" aria-labelledby="fc-examples">
        <h2 id="fc-examples" className="fc-h2">
          {copy.examplesTitle}
        </h2>
        <p className="fc-body">{copy.examplesIntro}</p>
        <ul className="fc-grid">
          {copy.examples.map((example) => (
            <li key={example.title} className="fc-card">
              <h3 className="fc-h3">{example.title}</h3>
              <p className="fc-prompt">{example.prompt}</p>
              {/* A full page load, so the generator starts with this prompt filled in. */}
              {copy.tryable ? (
                <a className="fc-try" rel="nofollow" href={`${href(`/${kind}`)}?prompt=${encodeURIComponent(example.prompt)}`}>
                  {copy.tryLabel}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="fc-section" aria-labelledby="fc-models">
        <h2 id="fc-models" className="fc-h2">
          {copy.modelsTitle}
        </h2>
        <p className="fc-body">{copy.modelsIntro}</p>
        <table className="fc-models">
          <thead>
            <tr className="fc-model fc-model-head">
              {copy.columns.map((column) => (
                <th key={column} scope="col">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {copy.models.map((model) => (
              <tr key={model.name} className="fc-model">
                <th scope="row" className="fc-model-name">
                  {model.href ? <Link href={href(model.href)}>{model.name}</Link> : model.name}
                </th>
                <td className="fc-model-spec">{model.spec}</td>
                <td className="fc-model-credits">
                  <strong>{model.credits.toLocaleString(zh ? "zh-CN" : "en-US")}</strong> {copy.creditsLabel}
                </td>
                <td className="fc-model-cost">{model.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="fc-section" aria-labelledby="fc-faq">
        <h2 id="fc-faq" className="fc-h2">
          {copy.faqTitle}
        </h2>
        <div className="fc-faq">
          {copy.faqs.map((faq, index) => (
            <details key={faq.q} open={index === 0}>
              <summary>{faq.q}</summary>
              <p className="fc-body">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>

      <nav className="fc-section fc-related" aria-labelledby="fc-related">
        <h2 id="fc-related" className="fc-h2">
          {copy.relatedTitle}
        </h2>
        <ul>
          {copy.related.map((link) => (
            <li key={link.href}>
              <Link href={href(link.href)}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </nav>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: graph }} />
      <p className="fc-updated">
        {zh ? "价格和模型信息更新于 " : "Prices and model details last updated "}
        <time dateTime={CONTENT_UPDATED.features}>{formatUpdated(CONTENT_UPDATED.features, zh)}</time>
      </p>
    </div>
  );
}
