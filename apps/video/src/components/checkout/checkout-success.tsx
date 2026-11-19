"use client";

import Link from "next/link";
import { localizedHref } from "@/lib/locale-path";
import { useEffect, useState, type ReactNode } from "react";

import { Check, Clock, LogIn, SearchX, TriangleAlert } from "lucide-react";
import {
  POLL_INTERVAL_MS,
  classifyStatusResponse,
  isValidSessionId,
  isTestModeSession,
  shouldKeepPolling,
  type CheckoutStatus,
} from "@/lib/checkout-status";
import "./checkout.css";

export type CheckoutSuccessProps = {
  lang: string;
  sessionId: string | null;
};

type View =
  | { kind: "pending" }
  | { kind: "paid"; credits: number }
  | { kind: "timeout" }
  | { kind: "unauthorized" }
  | { kind: "error" };

type Copy = {
  notFoundTitle: string;
  backToPricing: string;
  pending: string;
  paidTitle: string;
  creditsAdded: string;
  startCreating: string;
  myCreations: string;
  timeout: string;
  refresh: string;
  signInTitle: string;
  signIn: string;
  errorTitle: string;
  errorText: string;
  viewCredits: string;
  testModeNotice: string;
};

const COPY: Record<"en" | "zh", Copy> = {
  en: {
    notFoundTitle: "We couldn't find this payment",
    backToPricing: "Back to pricing",
    pending: "Confirming your payment…",
    paidTitle: "Payment received",
    creditsAdded: "{credits} credits added to your account",
    startCreating: "Start creating",
    myCreations: "My creations",
    timeout:
      "Your payment is still being confirmed. Credits usually arrive within a minute — refresh this page or check again later.",
    refresh: "Refresh",
    signInTitle: "Please sign in to see your credits",
    signIn: "Sign in",
    errorTitle: "We couldn't confirm your payment yet",
    errorText:
      "If you completed checkout, your credits will appear shortly. Refresh this page or check your credits.",
    viewCredits: "View credits",
    testModeNotice: "Test mode — no real money was charged.",
  },
  zh: {
    notFoundTitle: "我们找不到这笔付款",
    backToPricing: "返回定价页",
    pending: "正在确认你的付款…",
    paidTitle: "支付成功",
    creditsAdded: "已向你的账户添加 {credits} 积分",
    startCreating: "开始创作",
    myCreations: "我的作品",
    timeout:
      "你的付款仍在确认中。积分通常在一分钟内到账——请刷新此页面，或稍后再查看。",
    refresh: "刷新",
    signInTitle: "请登录以查看你的积分",
    signIn: "登录",
    errorTitle: "暂时无法确认你的付款",
    errorText:
      "如果你已完成支付，积分很快会到账。请刷新页面或查看积分。",
    viewCredits: "查看积分",
    testModeNotice: "测试模式——未产生真实扣款。",
  },
};


/** Tolerates either the raw status object or an `{ data: ... }` envelope. */
function parseStatus(body: unknown): CheckoutStatus | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const root = body as Record<string, unknown>;
  const payload =
    root.data && typeof root.data === "object"
      ? (root.data as Record<string, unknown>)
      : root;

  if (payload.status === "pending") {
    return { status: "pending" };
  }
  if (payload.status === "paid" && typeof payload.credits === "number") {
    return { status: "paid", credits: payload.credits };
  }
  return null;
}

export default function CheckoutSuccess({
  lang,
  sessionId,
}: CheckoutSuccessProps) {
  const copy = lang === "zh" ? COPY.zh : COPY.en;
  const [view, setView] = useState<View>({ kind: "pending" });
  const sessionValid = isValidSessionId(sessionId);
  const testMode = isValidSessionId(sessionId) && isTestModeSession(sessionId);

  useEffect(() => {
    if (!isValidSessionId(sessionId)) {
      return;
    }
    const id = sessionId;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/v1/checkout/status?session_id=${encodeURIComponent(id)}`,
          { cache: "no-store", headers: { accept: "application/json" } }
        );
        if (cancelled) {
          return;
        }
        // 401/403 => not signed in; anything else is a transient failure.
        if (!res.ok) {
          setView({
            kind:
              classifyStatusResponse(res.status) === "unauthorized"
                ? "unauthorized"
                : "error",
          });
          return;
        }

        const status = parseStatus(await res.json());
        if (cancelled) {
          return;
        }
        if (!status) {
          setView({ kind: "error" });
          return;
        }
        if (status.status === "paid") {
          setView({ kind: "paid", credits: status.credits });
          return;
        }

        if (shouldKeepPolling(status, Date.now() - startedAt)) {
          setView({ kind: "pending" });
          timer = setTimeout(poll, POLL_INTERVAL_MS);
        } else {
          setView({ kind: "timeout" });
        }
      } catch {
        if (!cancelled) {
          setView({ kind: "error" });
        }
      }
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [sessionId]);

  let content: ReactNode;
  if (!sessionValid) {
    content = (
      <>
        <span className="co-badge co-badge-muted" aria-hidden="true">
          <SearchX />
        </span>
        <h1 className="co-title">{copy.notFoundTitle}</h1>
        <p className="co-text">{copy.errorText}</p>
        <div className="co-actions">
          <Link className="co-btn" href={localizedHref(lang, "/credits")}>
            {copy.viewCredits}
          </Link>
          <Link className="co-btn co-btn-ghost" href={localizedHref(lang, "/pricing")}>
            {copy.backToPricing}
          </Link>
        </div>
      </>
    );
  } else if (view.kind === "paid") {
    content = (
      <>
        <span className="co-badge" aria-hidden="true">
          <Check />
        </span>
        <h1 className="co-title">{copy.paidTitle}</h1>
        <p className="co-text">
          {copy.creditsAdded.replace("{credits}", String(view.credits))}
        </p>
        <div className="co-actions">
          <Link className="co-btn" href={localizedHref(lang, "/ai/video")}>
            {copy.startCreating}
          </Link>
          <Link className="co-link" href={localizedHref(lang, "/my-creations")}>
            {copy.myCreations}
          </Link>
        </div>
      </>
    );
  } else if (view.kind === "timeout") {
    content = (
      <>
        <span className="co-badge co-badge-muted" aria-hidden="true">
          <Clock />
        </span>
        <p className="co-text">{copy.timeout}</p>
        <div className="co-actions">
          <button
            type="button"
            className="co-btn"
            onClick={() => window.location.reload()}
          >
            {copy.refresh}
          </button>
        </div>
      </>
    );
  } else if (view.kind === "unauthorized") {
    content = (
      <>
        <span className="co-badge co-badge-muted" aria-hidden="true">
          <LogIn />
        </span>
        <h1 className="co-title">{copy.signInTitle}</h1>
        <div className="co-actions">
          <Link className="co-btn" href={localizedHref(lang, "/login")}>
            {copy.signIn}
          </Link>
        </div>
      </>
    );
  } else if (view.kind === "error") {
    content = (
      <>
        <span className="co-badge co-badge-error" aria-hidden="true">
          <TriangleAlert />
        </span>
        <h1 className="co-title">{copy.errorTitle}</h1>
        <p className="co-text">{copy.errorText}</p>
        <div className="co-actions">
          <button
            type="button"
            className="co-btn"
            onClick={() => window.location.reload()}
          >
            {copy.refresh}
          </button>
          <Link className="co-link" href={localizedHref(lang, "/credits")}>
            {copy.viewCredits}
          </Link>
        </div>
      </>
    );
  } else {
    content = (
      <>
        <span className="co-spinner" aria-hidden="true" />
        <h1 className="co-title">{copy.pending}</h1>
      </>
    );
  }

  return (
    <main className="co-page">
      <section className="co-card" aria-live="polite">
        {sessionValid && testMode ? (
          <p className="co-notice">{copy.testModeNotice}</p>
        ) : null}
        {content}
      </section>
    </main>
  );
}
