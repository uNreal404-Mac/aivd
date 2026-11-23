import type { Metadata } from "next";
import { localizedHref } from "@/lib/locale-path";
import Link from "next/link";
import { safeReturnTo } from "@/lib/credit-return";
import { CircleSlash } from "lucide-react";

import "@/components/checkout/checkout.css";

type CheckoutCancelPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: CheckoutCancelPageProps): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "zh" ? "已取消支付" : "Checkout cancelled",
    robots: { index: false, follow: false },
  };
}

export default async function CheckoutCancelPage({
  params,
  searchParams,
}: CheckoutCancelPageProps) {
  const { locale } = await params;
  const query = await searchParams;
  const returnTo = safeReturnTo(Array.isArray(query.returnTo) ? query.returnTo[0] : query.returnTo);
  const zh = locale === "zh";

  return (
    <main className="co-page">
      <section className="co-card">
        <span className="co-badge co-badge-muted" aria-hidden="true">
          <CircleSlash />
        </span>
        <h1 className="co-title">{zh ? "已取消支付" : "Checkout cancelled"}</h1>
        <p className="co-text">{zh ? "没有产生任何扣款。需要的话可以随时重新选择套餐。" : "No charge was made. You can pick a plan again any time."}</p>
        <div className="co-actions">
          <Link className="co-btn" href={localizedHref(locale, "/pricing")}>
            {zh ? "返回定价页" : "Back to pricing"}
          </Link>
          <Link className="co-link" href={returnTo ?? localizedHref(locale, "/ai/video")}>
            {returnTo ? (zh ? "返回之前的创作" : "Return to your draft") : (zh ? "先免费试试生成" : "Try generating first")}
          </Link>
        </div>
      </section>
    </main>
  );
}
