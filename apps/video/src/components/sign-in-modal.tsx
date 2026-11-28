"use client";

import React, { useEffect, useState } from "react";
import { localizedHref } from "@/lib/locale-path";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { authClient } from "@/lib/auth/client";
import { getSafeCallbackURL } from "@/lib/auth/redirect";
import * as Icons from "@/components/ui/icons";
import { cn } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { NEW_USER_GIFT } from "@/config/pricing-user";
import "./sign-in-modal.css";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { toast } from "sonner";
import { Gift } from "lucide-react";

interface SignInModalContentProps {
  lang: string;
  /** Where to land after signing in. The modal defaults to the page it opened on. */
  callbackURL?: string;
}

export const SignInModalContent = ({ lang, callbackURL: landing }: SignInModalContentProps) => {
  const t = useTranslations("SignInModal");
  const signInModal = useSigninModal();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [signInClicked, setSignInClicked] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [internalLoginOpen, setInternalLoginOpen] = useState(false);
  const [internalUsername, setInternalUsername] = useState("");
  const [internalPassword, setInternalPassword] = useState("");
  // After a login link is sent the dialog stays open and says where it went,
  // with "resend" (after a short wait) and "use another email".
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resent, setResent] = useState(false);
  const zh = lang.startsWith("zh");
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const callbackURL = getSafeCallbackURL(
    landing ?? signInModal.callbackURL ?? searchParams?.get("callbackURL") ?? pathname,
  );

  const handleSocialLogin = async (provider: "google") => {
    setSignInClicked(provider);
    try {
      const { error } = await authClient.signIn.social({
        provider,
        callbackURL,
      });

      if (error) {
        console.error(`${provider} signIn error:`, error);
        setSignInClicked(null);
        toast.error(t("login_failed"), { description: t("login_failed_desc") });
      }
    } catch (error) {
      console.error(`${provider} signIn error:`, error);
      setSignInClicked(null);
      toast.error(t("login_failed"), { description: t("login_failed_desc") });
    }
  };

  const handleMagicLinkLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setEmailError(t("invalid_email"));
      return;
    }

    setEmailError("");
    await sendLink(email.toLowerCase());
  };

  const sendLink = async (address: string, again = false) => {
    setSignInClicked("email");
    try {
      const { error } = await authClient.signIn.magicLink({
        email: address,
        callbackURL,
      });

      if (error) {
        console.error("Magic link signIn error:", error);
        toast.error(t("request_failed"), { description: t("request_failed_desc") });
        return;
      }

      setSentTo(address);
      setResent(again);
      setResendIn(60);
    } catch (error) {
      console.error("Magic link signIn error:", error);
      toast.error(t("request_failed"), { description: t("request_failed_desc") });
    } finally {
      setSignInClicked(null);
    }
  };

  const isLoading = signInClicked !== null;

  const handleInternalLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!internalUsername.trim() || !internalPassword) return;
    setSignInClicked("internal");
    try {
      const identifier = internalUsername.trim().toLowerCase();
      const { error } = await authClient.signIn.email({
        email: identifier === "admin" ? "admin@aivd.internal" : identifier,
        password: internalPassword,
      });
      if (error) {
        toast.error(lang.startsWith("zh") ? "账号或密码不正确" : "Incorrect account or password");
        return;
      }
      window.location.assign(callbackURL);
    } catch {
      toast.error(lang.startsWith("zh") ? "登录失败，请重试" : "Sign in failed. Please try again.");
    } finally {
      setSignInClicked(null);
    }
  };

  const legal = (path: string) => localizedHref(lang, path);

  return (
    <div className="si">
      <div className="si-head">
        <div className="si-art" aria-hidden="true">
          <img src="/home/samples/rain-couple.webp" alt="" />
          <img src="/home/samples/red-carpet.webp" alt="" />
          <img src="/home/samples/autumn-walk.webp" alt="" />
        </div>
        <h3 className="si-title">{t("signin_title")}</h3>
        <p className="si-sub">{t("signin_subtitle")}</p>
        <p className="si-gift">
          <Gift className="h-3.5 w-3.5" aria-hidden="true" />
          {t("gift", { credits: NEW_USER_GIFT.credits })}
        </p>
      </div>

      <div className="si-body">
        {sentTo ? (
          <div className="si-sent" data-presence="fade" aria-live="polite">
            <Icons.Mail className="h-5 w-5" aria-hidden="true" />
            <p className="si-sent-title">{zh ? "登录链接已发到你的邮箱" : "Check your email"}</p>
            <p className="si-sent-to">{sentTo}</p>
            <p className="si-sent-hint">
              {resent
                ? zh ? "已重新发送，请查看最新的一封邮件。" : "Sent again. Open the newest email."
                : zh ? "点邮件里的链接就能直接登录，第一次用会自动创建账号。没收到的话，看看垃圾邮件，或者稍后重新发送。" : "Click the link in the email to sign in. New here? Your account is created automatically. Didn't get it? Check spam or resend."}
            </p>
            <button type="button" className="si-email" disabled={isLoading || resendIn > 0} onClick={() => void sendLink(sentTo, true)}>
              {signInClicked === "email" ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : <Icons.Mail className="h-4 w-4" />}
              {resendIn > 0 ? (zh ? `${resendIn} 秒后可重发` : `Resend in ${resendIn}s`) : zh ? "重新发送" : "Resend"}
            </button>
            <button
              type="button"
              className="si-sent-change"
              onClick={() => {
                setSentTo(null);
                setResent(false);
                // Straight back to the address, selected, to fix a typo.
                requestAnimationFrame(() => {
                  const field = document.getElementById("email") as HTMLInputElement | null;
                  field?.focus();
                  field?.select();
                });
              }}
            >
              {zh ? "换一个邮箱" : "Use another email"}
            </button>
          </div>
        ) : null}

        {!sentTo && siteConfig.auth.enableGoogleLogin && (
          <button type="button" className="si-google" disabled={isLoading} onClick={() => handleSocialLogin("google")}>
            {signInClicked === "google" ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : <Icons.Google className="h-4 w-4" />}
            {t("continue_google")}
          </button>
        )}

        {!sentTo && siteConfig.auth.enableMagicLinkLogin && (
          <>
            {siteConfig.auth.enableGoogleLogin && (
              <div className="si-or">
                <span>{t("or_continue_with")}</span>
              </div>
            )}
            <form onSubmit={handleMagicLinkLogin} className="si-form">
              <label className="sr-only" htmlFor="email">
                {t("email_label")}
              </label>
              <input
                id="email"
                className={cn("si-input", emailError && "si-input-error")}
                placeholder={t("email_placeholder")}
                type="email"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect="off"
                disabled={isLoading}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
              />
              {emailError ? <p className="si-error">{emailError}</p> : null}
              <button type="submit" className="si-email" disabled={isLoading}>
                {signInClicked === "email" ? <Icons.Spinner className="h-4 w-4 animate-spin" /> : <Icons.Mail className="h-4 w-4" />}
                {t("continue_email")}
              </button>
            </form>
          </>
        )}

        {process.env.NEXT_PUBLIC_IS_PREVIEW === "true" ? (
          <>
            <button type="button" className="si-email" onClick={() => setInternalLoginOpen((open) => !open)}>
              {lang.startsWith("zh") ? "内部测试账号登录" : "Internal test account"}
            </button>
            {internalLoginOpen ? (
              <form onSubmit={handleInternalLogin} className="si-form">
                <label className="sr-only" htmlFor="internal-username">{lang.startsWith("zh") ? "用户名" : "Username"}</label>
                <input id="internal-username" className="si-input" type="text" autoComplete="username" placeholder={lang.startsWith("zh") ? "用户名" : "Username"} value={internalUsername} onChange={(event) => setInternalUsername(event.target.value)} disabled={isLoading} />
                <label className="sr-only" htmlFor="internal-password">{lang.startsWith("zh") ? "密码" : "Password"}</label>
                <input id="internal-password" className="si-input" type="password" autoComplete="current-password" placeholder={lang.startsWith("zh") ? "密码" : "Password"} value={internalPassword} onChange={(event) => setInternalPassword(event.target.value)} disabled={isLoading} />
                <button type="submit" className="si-email" disabled={isLoading}>{lang.startsWith("zh") ? "登录" : "Sign in"}</button>
              </form>
            ) : null}
          </>
        ) : null}

        <p className="si-legal">
          {t("terms_prefix")} <a href={legal("/terms")}>{t("terms")}</a> {t("and")}{" "}
          <a href={legal("/privacy")}>{t("privacy_link")}</a>
        </p>
      </div>
    </div>
  );
};
