import { getTranslations } from "next-intl/server";
import { siteConfig } from "@/config/site";

const faqData = [
  {
    questionKey: "general.question",
    answerKey: "general.answer",
  },
  {
    questionKey: "commercial.question",
    answerKey: "commercial.answer",
  },
  {
    questionKey: "aiModels.question",
    answerKey: "aiModels.answer",
  },
  {
    questionKey: "credits.question",
    answerKey: "credits.answer",
  },
  {
    questionKey: "refund.question",
    answerKey: "refund.answer",
  },
  {
    questionKey: "support.question",
    answerKey: "support.answer",
  },
];

export async function FAQSection() {
  const t = await getTranslations("FAQ");
  const supportEmail = siteConfig.supportEmail;
  const visibleFaqData = supportEmail
    ? faqData
    : faqData.filter((item) => item.questionKey !== "support.question");

  // Generate FAQPage JSON-LD for SEO/GEO (+40% AI search visibility)
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: visibleFaqData.map((item) => ({
      "@type": "Question",
      name: t(item.questionKey),
      acceptedAnswer: {
        "@type": "Answer",
        text: t(item.answerKey, { email: supportEmail ?? "" }),
      },
    })),
  };

  return <section className="du-faq du-frame" aria-labelledby="du-faq-heading">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}/>
    <div><h2 id="du-faq-heading">{t("title")}</h2><p>{t("subtitle")}</p></div>
    <div>{visibleFaqData.map(item => <details key={item.questionKey}>
      <summary>{t(item.questionKey)}</summary><p>{t(item.answerKey, { email: supportEmail ?? "" })}</p>
    </details>)}
    {supportEmail && <p>{t("contact")} <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>}</div>
  </section>;
}
