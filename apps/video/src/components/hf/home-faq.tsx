import { ChevronDown } from "lucide-react";

import { homeFaqs } from "@/lib/home-faq";
import "./home-showcase.css";

/**
 * The questions at the foot of the homepage, with the matching FAQPage data
 * for search engines. Plain <details>, so every answer is in the page and it
 * works without scripts. The answers come from lib/home-faq.
 */
export function HomeFaq({ lang }: { lang: string }) {
  const zh = lang.toLowerCase().startsWith("zh");
  const faqs = homeFaqs(zh);
  const json = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({ "@type": "Question", name: faq.q, acceptedAnswer: { "@type": "Answer", text: faq.a } })),
  };

  return (
    <div className="hs bg-[var(--du-bg)]">
      {/* "<" is escaped so the data can never close the script element. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }} />
      <section className="hs-faq" aria-labelledby="hs-faq-title">
        <div>
          <h2 id="hs-faq-title" className="hs-title">{zh ? "AI 视频生成器常见问题" : "AI video generator FAQ"}</h2>
          <p className="hs-sub">{zh ? "关于费用、模型和版权，最常被问到的几件事。" : "What people ask most about cost, models and rights."}</p>
        </div>
        <div className="hs-faq-list">
          {faqs.map((faq, index) => (
            <details key={faq.q} open={index === 0}>
              <summary>
                {faq.q}
                <ChevronDown aria-hidden="true" />
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}
