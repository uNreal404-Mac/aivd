"use client";

import { useState } from "react";

import { type AccountCopy, parsePortalResponse } from "@/lib/account-view";

export interface ManageSubscriptionButtonProps {
  enabled: boolean;
  copy: AccountCopy;
}

export function ManageSubscriptionButton({
  enabled,
  copy,
}: ManageSubscriptionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <button type="button" className="acct-button" disabled>
        {copy.comingSoon}
      </button>
    );
  }

  const handleClick = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/payments/portal", { method: "POST" });
      const json: unknown = await response.json().catch(() => null);
      const result = parsePortalResponse(response.status, json);

      if (result.ok) {
        window.location.assign(result.url);
        return;
      }

      setError(result.message || copy.errorGeneric);
    } catch {
      setError(copy.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="acct-button acct-button-secondary"
        onClick={() => {
          void handleClick();
        }}
        disabled={loading}
      >
        {copy.manageSubscription}
      </button>
      {error ? <p className="acct-error">{error}</p> : null}
    </>
  );
}
