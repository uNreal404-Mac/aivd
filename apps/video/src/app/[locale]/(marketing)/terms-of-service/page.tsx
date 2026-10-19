import { localeRedirect } from "@/i18n/navigation";
import type { Locale } from "@/config/i18n-config";

/** Legacy path. The public terms live at /terms. */
export default async function TermsOfServiceRedirect({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  localeRedirect({ href: "/terms", locale });
}
