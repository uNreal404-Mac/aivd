import { permanentRedirect } from "next/navigation";
import { i18n } from "@/config/i18n-config";

// Explore had placeholder pictures only; the template library covers the same
// need, so the address points there until there is real work to show.
export default async function ExplorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // The default language has no prefix, so this lands in one hop.
  permanentRedirect(locale === i18n.defaultLocale ? "/templates" : `/${locale}/templates`);
}
