import { localeRedirect } from "@/i18n/navigation";
import type { Locale } from "@/config/i18n-config";

/** Legacy path. The public policy lives at /privacy. */
export default async function PrivacyPolicyRedirect({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  localeRedirect({ href: "/privacy", locale });
}
