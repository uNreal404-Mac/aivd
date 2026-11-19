import type { Metadata } from "next";

import CheckoutSuccess from "@/components/checkout/checkout-success";

type CheckoutSuccessPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: CheckoutSuccessPageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "支付成功" : "Payment received",
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutSuccessPage({
  params,
  searchParams,
}: CheckoutSuccessPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const raw = query?.session_id;
  const sessionId = Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null);

  return <CheckoutSuccess lang={locale} sessionId={sessionId} />;
}
