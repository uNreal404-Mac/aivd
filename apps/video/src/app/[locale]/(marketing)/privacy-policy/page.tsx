import { permanentRedirect } from "next/navigation";

// Old address from the starter template; the real document lives at /privacy.
export default async function LegacyRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(locale === "en" ? "/privacy" : `/${locale}/privacy`);
}
