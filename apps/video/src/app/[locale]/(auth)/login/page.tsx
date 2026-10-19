import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { cn } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button";
import * as Icons from "@/components/ui/icons";

import { UserAuthForm } from "@/components/user-auth-form";
import type { Locale } from "@/config/i18n-config";
import { getLoginErrorMessageKey } from "@/lib/auth/login-error";
import { getSafeCallbackURL } from "@/lib/auth/redirect";
import { PreviewBadge } from "@/components/layout/preview-badge";

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your account",
};

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{
    locale: Locale;
  }>;
  searchParams?: Promise<{
    error?: string;
    callbackURL?: string;
  }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const t = await getTranslations("Login");
  const callbackURL = getSafeCallbackURL(query?.callbackURL);
  const errorMessage = query?.error
    ? t(`errors.${getLoginErrorMessageKey(query.error)}`)
    : null;
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <Link
        href={`/${locale}`}
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "absolute left-4 top-4 md:left-8 md:top-8",
        )}
      >
        <>
          <Icons.ChevronLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </>
      </Link>
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <Image
            src="/images/avatars/saasfly-logo.svg"
            className="mx-auto"
            width="64"
            height="64"
            alt="aidv.ai Logo - AI Video Generation Platform"
          />
          <div className="flex items-center justify-center gap-2 text-sm font-medium">
            <span>aidv.ai</span>
            <PreviewBadge />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("welcome_back")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("signin_title")}
          </p>
        </div>
        {errorMessage ? (
          <p role="alert" className="text-center text-sm text-red-600">
            {errorMessage}
          </p>
        ) : null}
        <Suspense fallback={<div className="h-10" />}>
          <UserAuthForm lang={locale} callbackURL={callbackURL} />
        </Suspense>
      </div>
    </div>
  );
}
