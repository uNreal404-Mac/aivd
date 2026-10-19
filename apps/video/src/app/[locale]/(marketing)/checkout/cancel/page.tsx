import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { LegalLinks } from "@/components/legal/legal-links";
import "@/styles/checkout-tokens.css";

type CheckoutCancelPageProps = {
  params: Promise<{ locale: string }>;
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

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 20px",
  background: "var(--co-bg)",
  color: "var(--co-text)",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "460px",
  boxSizing: "border-box",
  padding: "40px 32px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  textAlign: "center",
  background: "var(--co-surface)",
  border: "1px solid var(--co-border)",
  borderRadius: "var(--co-radius)",
};

const titleStyle: CSSProperties = {
  margin: 0,
  fontSize: "24px",
  lineHeight: 1.3,
  fontWeight: 600,
  color: "var(--co-text)",
};

const textStyle: CSSProperties = {
  margin: 0,
  fontSize: "15px",
  lineHeight: 1.6,
  color: "var(--co-muted)",
};

const legalStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  justifyContent: "center",
  gap: "12px",
  fontSize: "13px",
};

const buttonStyle: CSSProperties = {
  display: "inline-block",
  marginTop: "4px",
  padding: "12px 24px",
  borderRadius: "999px",
  background: "var(--co-accent)",
  color: "var(--co-on-accent)",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
};

export default async function CheckoutCancelPage({
  params,
}: CheckoutCancelPageProps) {
  const { locale } = await params;
  const zh = locale === "zh";

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={titleStyle}>{zh ? "已取消支付" : "Checkout cancelled"}</h1>
        <p style={textStyle}>{zh ? "未产生任何扣款。" : "No charge was made."}</p>
        <Link style={buttonStyle} href={`/${locale}/pricing`}>
          {zh ? "返回定价页" : "Back to pricing"}
        </Link>
        <LegalLinks locale={locale} className="co-legal" style={legalStyle} />
      </section>
    </main>
  );
}
