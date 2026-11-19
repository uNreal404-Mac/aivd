import { permanentRedirect } from "next/navigation";
import { i18n } from "@/config/i18n-config";

// Profile, plan and preferences all live on the account page now; billing
// moved to credits. The old address points to the account page.
export default async function SettingsRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  permanentRedirect(locale === i18n.defaultLocale ? "/account" : `/${locale}/account`);
}
