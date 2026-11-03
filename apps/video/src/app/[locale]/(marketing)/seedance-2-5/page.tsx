import { SeedanceSupportPage } from "@/components/hf/seedance-support-page";
import type { Locale } from "@/config/i18n-config";
import { supportMetadata } from "@/lib/seedance-support";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  return supportMetadata("2.5", locale);
}

export default async function Page({ params }: Props) {
  const { locale } = await params;
  return <SeedanceSupportPage version="2.5" lang={locale} />;
}
