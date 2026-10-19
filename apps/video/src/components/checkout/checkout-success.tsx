"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

import { LegalLinks } from "@/components/legal/legal-links";
import {
  POLL_INTERVAL_MS,
  classifyStatusResponse,
  isValidSessionId,
  isTestModeSession,
  shouldKeepPolling,
  type CheckoutStatus,
} from "@/lib/checkout-status";

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

const STYLES = `
  .co-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    background: var(--co-bg);
    color: var(--co-text);
  }
  .co-card {
    width: 100%;
    max-width: 460px;
    box-sizing: border-box;
    padding: 40px 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
    background: var(--co-surface);
    border: 1px solid var(--co-border);
    border-radius: var(--co-radius);
  }
  .co-notice {
    margin: 0;
    padding: 4px 12px;
    border: 1px dashed var(--co-border);
    border-radius: 999px;
    color: var(--co-muted);
    font-size: 13px;
    line-height: 1.4;
  }
  .co-title {
    margin: 0;
    font-size: 24px;
    line-height: 1.3;
    font-weight: 600;
    color: var(--co-text);
  }
  .co-text {
    margin: 0;
    font-size: 15px;
    line-height: 1.6;
    color: var(--co-muted);
  }
  .co-actions {
    width: 100%;
    margin-top: 4px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .co-btn {
    display: inline-block;
    padding: 12px 24px;
    border: none;
    border-radius: 999px;
    background: var(--co-accent);
    color: var(--co-on-accent);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
  }
  .co-btn:hover {
    background: var(--co-accent-hover);
  }
  .co-link {
    font-size: 14px;
    color: var(--co-muted);
    text-decoration: none;
  }
  .co-link:hover {
    color: var(--co-text);
  }
  .co-legal {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 14px;
    margin-top: 8px;
    font-size: 13px;
  }
  .co-legal a {
    color: var(--co-muted);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .co-legal a:hover {
    color: var(--co-text);
  }
  .co-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--co-border);
    border-top-color: var(--co-accent);
    border-radius: 50%;
    animation: co-spin 900ms linear infinite;
  }
  .co-badge {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--co-border);
    border-radius: 50%;
    color: var(--co-success);
    font-size: 22px;
  }
  @keyframes co-spin {
    to {
      transform: rotate(360deg);
    }
  }
`;

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
        <h1 className="co-title">{copy.notFoundTitle}</h1>
        <div className="co-actions">
          <Link className="co-btn" href={`/${lang}/pricing`}>
            {copy.backToPricing}
          </Link>
        </div>
      </>
    );
  } else if (view.kind === "paid") {
    content = (
      <>
        <span className="co-badge" aria-hidden="true">
          ✓
        </span>
        <h1 className="co-title">{copy.paidTitle}</h1>
        <p className="co-text">
          {copy.creditsAdded.replace("{credits}", String(view.credits))}
        </p>
        <div className="co-actions">
          <Link className="co-btn" href={`/${lang}/ai/video`}>
            {copy.startCreating}
          </Link>
          <Link className="co-link" href={`/${lang}/my-creations`}>
            {copy.myCreations}
          </Link>
        </div>
      </>
    );
  } else if (view.kind === "timeout") {
    content = (
      <>
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
        <h1 className="co-title">{copy.signInTitle}</h1>
        <div className="co-actions">
          <Link className="co-btn" href={`/${lang}/login`}>
            {copy.signIn}
          </Link>
        </div>
      </>
    );
  } else if (view.kind === "error") {
    content = (
      <>
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
          <Link className="co-link" href={`/${lang}/credits`}>
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
      <style>{STYLES}</style>
      <section className="co-card" aria-live="polite">
        {sessionValid && testMode ? (
          <p className="co-notice">{copy.testModeNotice}</p>
        ) : null}
        {content}
        <LegalLinks locale={lang} className="co-legal" />
      </section>
    </main>
  );
}
