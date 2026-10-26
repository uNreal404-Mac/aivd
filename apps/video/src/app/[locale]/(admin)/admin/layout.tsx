import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminLogoutButton } from "@/components/admin/admin-logout-button";
import { NOINDEX_ROBOTS } from "@/lib/indexing";

interface AdminLayoutProps {
  children?: React.ReactNode;
  params: Promise<{
    locale: string;
  }>;
}

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

export default async function AdminLayout({
  children,
  params,
}: AdminLayoutProps) {
  const { locale } = await params;

  // 检查管理员权限
  const user = await requireAdmin(`/${locale}/admin-login`);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex h-16 items-center justify-between border-b bg-card px-6">
        <div>
          <p className="font-semibold">AIVD Admin</p>
          <p className="text-xs text-muted-foreground">{user.name || user.email}</p>
        </div>
        <AdminLogoutButton locale={locale} />
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Admin Sidebar */}
        <AdminSidebar locale={locale} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
