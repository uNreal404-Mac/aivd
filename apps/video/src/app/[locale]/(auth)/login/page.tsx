import type { Metadata } from "next";
import { localizedHref } from "@/lib/locale-path";
import { getTranslations } from "next-intl/server";

import { AuthPage } from "@/components/auth/auth-page";
import type { Locale } from "@/config/i18n-config";
import { getLoginErrorMessageKey } from "@/lib/auth/login-error";
import { getSafeCallbackURL } from "@/lib/auth/redirect";

type Props = {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ error?: string; callbackURL?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale === "zh";
  return {
    title: zh ? "登录" : "Log in",
    description: zh ? "登录 aivd.ai，继续生成视频、图片和音频。" : "Log in to aivd.ai to keep making videos, images and audio.",
  };
}

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations("Login");
  const error = query?.error ? t(`errors.${getLoginErrorMessageKey(query.error)}`) : null;
  // Without a callback, land on the home page in the visitor's language.
  const callbackURL = query?.callbackURL ? getSafeCallbackURL(query.callbackURL) : localizedHref(locale, "/");

  return <AuthPage locale={locale} callbackURL={callbackURL} error={error} />;
}
