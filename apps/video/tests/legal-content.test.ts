import { describe, expect, it } from "vitest";

import { LEGAL_CONFIG, legalSupportEmail } from "@/config/legal";
import { siteConfig } from "@/config/site";
import {
    getLegalDoc,
    type LegalContext,
    type LegalDoc,
    type LegalKind,
    type LegalLocale,
} from "@/lib/legal-content";

const SUPPORT_EMAIL = "support@example.com";

const KINDS: LegalKind[] = ["terms", "privacy", "refund", "contact"];
const LOCALES: LegalLocale[] = ["en", "zh"];

function buildContext(overrides: Partial<LegalContext> = {}): LegalContext {
    return {
        email: SUPPORT_EMAIL,
        companyName: "",
        companyAddress: "",
        governingLaw: "",
        refundWindowDays: LEGAL_CONFIG.refundWindowDays,
        ...overrides,
    };
}

function docToText(doc: LegalDoc): string {
    return [
        doc.title,
        doc.description,
        doc.intro,
        ...doc.sections.flatMap((section) => [
            section.heading,
            ...section.paragraphs,
            ...(section.bullets ?? []),
        ]),
    ].join("\n");
}

describe("getLegalDoc", () => {
    for (const kind of KINDS) {
        for (const locale of LOCALES) {
            const doc = getLegalDoc(kind, locale, buildContext());
            const text = docToText(doc);

            it(`${kind}/${locale} has a meta description within the limit`, () => {
                expect(doc.title.length).toBeGreaterThan(0);
                expect(doc.description.length).toBeGreaterThan(0);
                expect(doc.description.length).toBeLessThanOrEqual(155);
            });

            it(`${kind}/${locale} has the expected number of sections`, () => {
                const minimum = kind === "contact" ? 1 : 3;
                expect(doc.sections.length).toBeGreaterThanOrEqual(minimum);
                expect(doc.intro.length).toBeGreaterThan(0);
                for (const section of doc.sections) {
                    expect(section.heading.length).toBeGreaterThan(0);
                    expect(section.paragraphs.length).toBeGreaterThan(0);
                }
            });

            it(`${kind}/${locale} surfaces the support email`, () => {
                expect(text).toContain(SUPPORT_EMAIL);
            });

            it(`${kind}/${locale} avoids placeholders and invented facts`, () => {
                expect(text).not.toContain("undefined");
                expect(text.toLowerCase()).not.toContain("higgsfield");
                expect(text).not.toContain("Inc.");
                expect(text).not.toContain("Ltd");
                expect(text).not.toContain("LLC");
                expect(text).not.toContain("business days");
                expect(text).not.toContain("工作日");
            });
        }
    }

    it("terms covers credits, cancellation, prohibited content and ownership", () => {
        const en = docToText(getLegalDoc("terms", "en", buildContext())).toLowerCase();
        expect(en).toContain("credit");
        expect(en).toContain("cancel");
        expect(en).toContain("prohibited");
        expect(en).toContain("own");

        const zh = docToText(getLegalDoc("terms", "zh", buildContext()));
        expect(zh).toContain("积分");
        expect(zh).toContain("取消");
        expect(zh).toContain("禁止");
        expect(zh).toContain("拥有");
    });

    it("refund explains automatic credit returns and the refund window", () => {
        const ctx = buildContext();

        const en = docToText(getLegalDoc("refund", "en", ctx)).toLowerCase();
        expect(en).toContain("automatically");
        expect(en).toContain(String(ctx.refundWindowDays));

        const zh = docToText(getLegalDoc("refund", "zh", ctx));
        expect(zh).toContain("自动");
        expect(zh).toContain(String(ctx.refundWindowDays));
    });

    it("uses the configured company name in the contact document", () => {
        const doc = getLegalDoc("contact", "en", buildContext({ companyName: "Acme Co" }));
        expect(docToText(doc)).toContain("Acme Co");
    });

    it("uses the support email from the site config", () => {
        expect(siteConfig.supportEmail).toBeUndefined();
        expect(legalSupportEmail()).toBeUndefined();
    });

    it("omits support paragraphs when no support email is configured", () => {
        for (const kind of KINDS) {
            for (const locale of LOCALES) {
                const text = docToText(
                    getLegalDoc(kind, locale, buildContext({ email: undefined })),
                );

                expect(text).not.toContain("undefined");
                expect(text).not.toContain("mailto:");
            }
        }
    });
});

describe("commercial use in the terms", () => {
  // Decided 2026-11-21: everything generated may be used commercially, free credits included.
  it("says all generated content, free credits included, may be used commercially, in both languages", () => {
    const en = getLegalDoc("terms", "en", buildContext());
    const zh = getLegalDoc("terms", "zh", buildContext());
    const text = (doc: typeof en) => doc.sections.flatMap((section) => section.paragraphs).join("\n");
    expect(text(en)).toContain("content you generate with the service may be used commercially, including content made with the free sign-up credits");
    expect(text(zh)).toContain("你在本服务生成的内容都可以用于商业用途，包括用注册赠送的免费积分生成的内容");
  });

  it("is said the same way wherever the site answers it", async () => {
    const { helpArticle } = await import("@/lib/help-articles");
    const { featureCopy } = await import("@/lib/feature-pages");
    for (const zh of [false, true]) {
      const help = helpArticle("commercial-use", zh ? "zh" : "en");
      expect(help?.answer).toMatch(zh ? /免费积分/ : /free sign-up credits/);
      const faq = featureCopy("text-to-video", zh).faqs.find((item) => /commercial|商用/.test(item.q));
      expect(faq?.a).toMatch(zh ? /免费积分/ : /free credits/);
      expect(faq?.a).not.toMatch(/Yes on paid plans|付费套餐可以：/);
    }
  });
});
