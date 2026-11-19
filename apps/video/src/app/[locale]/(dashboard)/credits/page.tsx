import { CreditsPage } from "@/components/credits/credits-page";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { locale } = await params;
  return { title: locale === "zh" ? "积分与账单" : "Credits & billing" };
}

export default async function CreditsRoute({ params }: PageProps) {
  const { locale } = await params;
  return <CreditsPage locale={locale} />;
}
