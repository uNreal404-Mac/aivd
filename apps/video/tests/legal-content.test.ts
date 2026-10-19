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

const SUPPORT_EMAIL = "tuapi@mail.grokbot.com";

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
                expect(text).not.toContain("example.com");
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
        expect(siteConfig.supportEmail).toBe(SUPPORT_EMAIL);
        expect(legalSupportEmail()).toBe(SUPPORT_EMAIL);
    });

    it("brands every document as aidv.ai and prices refunds in USD", () => {
        for (const kind of KINDS) {
            for (const locale of LOCALES) {
                const text = docToText(getLegalDoc(kind, locale, buildContext()));
                expect(text).toContain("aidv.ai");
                expect(text).not.toContain("DreamUtopia");
                expect(text).not.toContain("aivd");
                expect(text.toUpperCase()).toContain("USD");
            }
        }
    });

    it("marks an unknown legal entity and address instead of inventing them", () => {
        const en = docToText(getLegalDoc("contact", "en", buildContext()));
        expect(en).toContain("[Company legal name]");
        expect(en).toContain("[Company address]");
        expect(en).not.toMatch(/\d+\s+[A-Z][a-z]+ (Street|St|Road|Ave)/);

        const zh = docToText(getLegalDoc("contact", "zh", buildContext()));
        expect(zh).toContain("【公司法律主体名称】");
        expect(zh).toContain("【公司地址】");
    });

    it("uses a contact-email placeholder when no email is configured", () => {
        const en = docToText(
            getLegalDoc("terms", "en", buildContext({ email: "  " })),
        );
        expect(en).toContain("[Contact email]");
        expect(en).not.toContain(SUPPORT_EMAIL);
    });

    it("uses a configured legal entity when one is provided", () => {
        const en = docToText(
            getLegalDoc(
                "terms",
                "en",
                buildContext({
                    companyName: "Acme Co",
                    companyAddress: "1 Example Plaza",
                }),
            ),
        );
        expect(en).toContain("Acme Co");
        expect(en).not.toContain("[Company legal name]");
    });
});
