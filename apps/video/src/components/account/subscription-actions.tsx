"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { type AccountCopy, parseSubscriptionChangeResponse } from "@/lib/account-view";

export interface SubscriptionActionsProps {
  /** `renewing`: offer cancel. `ending`: offer resume. */
  state: "renewing" | "ending";
  /** End of the paid period, already formatted for the page's locale. */
  periodEnd: string | null;
  copy: AccountCopy;
}

/**
 * Cancel at period end (with a confirm step), or resume, without leaving the
 * site. Calls /api/payments/subscription, then re-renders the page so the
 * plan card shows the new state.
 */
export function SubscriptionActions({ state, periodEnd, copy }: SubscriptionActionsProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (action: "cancel" | "resume") => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/payments/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json: unknown = await response.json().catch(() => null);
      const result = parseSubscriptionChangeResponse(response.status, json);
      if (!result.ok) {
        setError(result.message || copy.errorGeneric);
        return;
      }
      setConfirming(false);
      router.refresh();
    } catch {
      setError(copy.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  if (state === "ending") {
    return (
      <>
        <button type="button" className="db-btn" disabled={loading} onClick={() => void change("resume")}>
          {copy.resumeSubscription}
        </button>
        {error ? <p className="db-error">{error}</p> : null}
      </>
    );
  }

  if (!confirming) {
    return (
      <button type="button" className="db-btn" onClick={() => setConfirming(true)}>
        {copy.cancelSubscription}
      </button>
    );
  }

  return (
    <div className="db-confirm" role="group" aria-label={copy.cancelSubscription} style={{ flexBasis: "100%" }}>
      <p className="db-sub">{copy.cancelHint.replace("{date}", periodEnd ?? "—")}</p>
      <div className="db-actions">
        <button type="button" className="db-btn" disabled={loading} onClick={() => void change("cancel")}>
          {copy.cancelConfirm}
        </button>
        <button type="button" className="db-btn db-btn-accent" disabled={loading} onClick={() => setConfirming(false)}>
          {copy.cancelKeep}
        </button>
      </div>
      {error ? <p className="db-error">{error}</p> : null}
    </div>
  );
}
