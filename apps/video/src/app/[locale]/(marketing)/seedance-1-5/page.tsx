import { permanentRedirect } from "next/navigation";
import { i18n } from "@/config/i18n-config";

// Older address: the model now has its own landing page.
export default async function LegacyModelPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The default language has no prefix, so this lands in one hop.
  permanentRedirect(locale === i18n.defaultLocale ? "/models/seedance-1-5-pro" : `/${locale}/models/seedance-1-5-pro`);
}
