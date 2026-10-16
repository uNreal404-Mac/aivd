import { LegalPage } from "@/components/legal/legal-page";
import { LEGAL_CONFIG, legalSupportEmail } from "@/config/legal";
import type { Locale } from "@/config/i18n-config";
import { getLegalDoc, type LegalContext, type LegalLocale } from "@/lib/legal-content";
import { buildAlternates } from "@/lib/seo";
import type { Metadata } from "next";
import "@/styles/legal-tokens.css";

const ROUTE = "/privacy";

function toLegalLocale(locale: Locale): LegalLocale {
    return locale === "zh" ? "zh" : "en";
}

function buildLegalContext(): LegalContext {
    return {
        email: legalSupportEmail(),
        companyName: LEGAL_CONFIG.companyName,
        companyAddress: LEGAL_CONFIG.companyAddress,
        governingLaw: LEGAL_CONFIG.governingLaw,
        refundWindowDays: LEGAL_CONFIG.refundWindowDays,
    };
}

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: Locale }>;
}): Promise<Metadata> {
    const { locale } = await params;
    const alternates = buildAlternates(ROUTE, locale);
    const doc = getLegalDoc("privacy", toLegalLocale(locale), buildLegalContext());

    return {
        title: doc.title,
        description: doc.description,
        alternates: {
            canonical: alternates.canonical,
            languages: alternates.languages,
        },
    };
}

export default async function PrivacyPage({
    params,
}: {
    params: Promise<{ locale: Locale }>;
}) {
    const { locale } = await params;
    const resolvedLocale = toLegalLocale(locale);

    return (
        <LegalPage
            doc={getLegalDoc("privacy", resolvedLocale, buildLegalContext())}
            locale={resolvedLocale}
            lastUpdated={LEGAL_CONFIG.lastUpdated}
            email={legalSupportEmail()}
        />
    );
}
