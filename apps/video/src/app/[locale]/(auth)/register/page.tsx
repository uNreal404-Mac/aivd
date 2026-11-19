import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/auth-page";
import type { Locale } from "@/config/i18n-config";

type Props = { params: Promise<{ locale: Locale }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale === "zh";
  return {
    title: zh ? "创建账户" : "Create an account",
    description: zh ? "用邮箱或 Google 创建 aivd.ai 账户。" : "Create an aivd.ai account with email or Google.",
  };
}

// Signing in for the first time creates the account, so registering is the
// same card with a line saying so.
export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  const zh = locale === "zh";
  return (
    <AuthPage
      locale={locale}
      callbackURL={`/${locale}`}
      note={zh ? "第一次用邮箱或 Google 登录，就会自动创建账户。" : "Signing in for the first time creates your account."}
    />
  );
}
