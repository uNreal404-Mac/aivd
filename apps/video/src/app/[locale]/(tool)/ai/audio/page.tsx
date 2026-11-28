import { redirect } from "next/navigation";
import type { Locale } from "@/config/i18n-config";
import { localizedHref } from "@/lib/locale-path";

export default async function AiAudioRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`${localizedHref(locale, "/audio")}${suffix}`);
}
