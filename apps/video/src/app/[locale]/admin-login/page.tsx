import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NOINDEX_ROBOTS } from "@/lib/indexing";
import { getAdminPanelPrincipal } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Admin Login",
  robots: NOINDEX_ROBOTS,
};

export default async function AdminLoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (await getAdminPanelPrincipal(await headers())) {
    redirect(`/${locale}/admin`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md border-border/70 shadow-2xl">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">
            A
          </div>
          <CardTitle className="text-2xl">AIVD 管理后台</CardTitle>
          <CardDescription>
            此入口与普通用户登录完全隔离，仅授权管理员可访问。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdminLoginForm locale={locale} />
        </CardContent>
      </Card>
    </main>
  );
}
