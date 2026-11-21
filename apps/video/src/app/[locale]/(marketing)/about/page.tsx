import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { CONTENT_UPDATED } from "@/config/content-dates";
import type { Locale } from "@/config/i18n-config";
import { LEGAL_CONFIG, legalSupportEmail } from "@/config/legal";
import { aboutDoc } from "@/lib/about-content";
import { buildAlternates } from "@/lib/seo";
import "@/styles/legal-tokens.css";

const ROUTE = "/about";

function doc(locale: Locale) {
  return aboutDoc(locale === "zh" ? "zh" : "en", { email: legalSupportEmail(), companyName: LEGAL_CONFIG.companyName });
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
  const { locale } = await params;
  const alternates = buildAlternates(ROUTE, locale);
  const { title, description } = doc(locale);
  return {
    title,
    description,
    alternates: { canonical: alternates.canonical, languages: alternates.languages },
  };
}

export default async function AboutPage({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  return <LegalPage doc={doc(locale)} locale={locale === "zh" ? "zh" : "en"} lastUpdated={CONTENT_UPDATED.models} email={legalSupportEmail()} />;
}
