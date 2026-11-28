"use client";

import { faqItemsFor, pricingCopy } from "@/components/pricing/pricing-data";

/** Pricing FAQ, shown under the pricing block on /pricing. */
export function PricingFaq({ locale }: { locale: string }) {
  const copy = pricingCopy(locale);
  const faq = faqItemsFor(locale);

  return (
    <div className="pr-page pr-page--under-pricing">
      <div className="pr-shell">
        <section className="pr-section" aria-labelledby="pr-faq-title">
          <div className="pr-faq-head">
            <h2 id="pr-faq-title" className="pr-section__title">
              {copy.faqTitle}
            </h2>
            <p className="pr-section__sub">{copy.faqSubtitle}</p>
          </div>
          <div className="pr-faq">
            {faq.map((item, index) => (
              <details key={item.id} open={index === 0 ? true : undefined}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
