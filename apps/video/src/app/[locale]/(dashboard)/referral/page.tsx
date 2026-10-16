import "@/styles/referral-tokens.css";

import type { Metadata } from "next";

import { ReferralPanel } from "@/components/referral/referral-panel";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "zh" ? "邀请" : "Invite" };
}

export default async function ReferralRoute({ params }: PageProps) {
  const { locale } = await params;
  return <ReferralPanel locale={locale} />;
}
