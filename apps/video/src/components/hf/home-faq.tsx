import { useTranslations } from "next-intl";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { siteConfig } from "@/config/site";

interface FAQItem {
  questionKey: string;
  answerKey: string;
}

const faqData: FAQItem[] = [
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

export function HomeFaq() {
  const t = useTranslations("FAQ");

  // Generate FAQPage JSON-LD for SEO/GEO (+40% AI search visibility)
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((item) => ({
      "@type": "Question",
      name: t(item.questionKey),
      acceptedAnswer: {
        "@type": "Answer",
        text: t(item.answerKey, { email: siteConfig.supportEmail }),
      },
    })),
  };

  return (
    <section className="py-24 md:py-32 bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          {/* 标题 */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              {t("title")}
            </h2>
            <p className="text-lg text-muted-foreground">{t("subtitle")}</p>
          </div>

          {/* FAQ 列表 */}
          <div>
            <Accordion type="single" collapsible className="space-y-3">
              {faqData.map((item, index) => (
                <div key={item.questionKey}>
                  <AccordionItem
                    value={`faq-${index}`}
                    className="px-6 rounded-2xl border border-border bg-background/50 backdrop-blur-sm hover:border-primary/30 transition-colors"
                  >
                    <AccordionTrigger className="text-left hover:no-underline cursor-pointer py-4">
                      <span className="flex items-center gap-3">
                        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-semibold">
                          {index + 1}
                        </span>
                        <span className="font-medium">
                          {t(item.questionKey)}
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="pl-10 text-muted-foreground leading-relaxed">
                      {t(item.answerKey, { email: siteConfig.supportEmail })}
                    </AccordionContent>
                  </AccordionItem>
                </div>
              ))}
            </Accordion>
          </div>

          {/* 底部提示 */}
          <div className="text-center mt-12 p-6 rounded-2xl bg-primary/10 border border-primary/20">
            <p className="text-muted-foreground">
              {t("contact")}
              <a
                href={`mailto:${siteConfig.supportEmail}`}
                className="text-primary hover:underline mx-1"
              >
                {siteConfig.supportEmail}
              </a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
