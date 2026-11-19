import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { requireAuth } from "@/lib/auth";
import { HfTopNav } from "@/components/hf/top-nav";
import { AccountNav } from "@/components/dashboard/account-nav";
import "@/components/dashboard/dashboard.css";
import { UpgradeModal } from "@/components/upgrade/upgrade-modal";
import { i18n } from "@/config/i18n-config";
import { NOINDEX_ROBOTS } from "@/lib/indexing";

interface DashboardLayoutProps {
  children?: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

export function generateStaticParams() {
  return i18n.locales.map((locale) => ({ locale }));
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params;
  const user = await requireAuth(`/${locale}/login`);

  return (
    <div className="min-h-screen bg-background">
      <HfTopNav
        user={{
          name: user.name,
          image: user.image,
          email: user.email,
        }}
        lang={locale}
      />

      <div className="db-shell">
        <AccountNav lang={locale} />
        <main className="db-main">{children}</main>
      </div>

      {/* 全局升级弹窗 */}
      <UpgradeModal />
    </div>
  );
}
