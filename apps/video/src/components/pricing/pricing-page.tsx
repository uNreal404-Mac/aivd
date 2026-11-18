"use client";

import { faqItemsFor, pricingCopy } from "@/components/pricing/pricing-data";

/** Pricing FAQ, shown under the pricing block on /pricing. */
export function PricingFaq({ locale }: { locale: string }) {
  const copy = pricingCopy(locale);
  const faq = faqItemsFor(locale);

  return (
    <div className="pr-page">
      <div className="pr-shell">
        <section className="pr-section">
          <h2 className="pr-section__title">{copy.faqTitle}</h2>
          <p className="pr-section__sub">{copy.faqSubtitle}</p>
          <div className="pr-faq">
            {faq.map((item) => (
              <details key={item.id}>
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
