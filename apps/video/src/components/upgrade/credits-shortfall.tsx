"use client";

import { useCallback, useState } from "react";

import { goToPricingForCredits } from "@/lib/credit-return";
import "./credits-upgrade-modal.css";

/**
 * A credit shortfall is shown where it happened: the notice says what the
 * clip costs and what is left, the studio can offer a model the balance does
 * cover, and "Buy credits" saves the draft and opens pricing, from where the
 * customer returns to the same generator. Nothing navigates away on its own:
 * the person decides whether to switch model or buy.
 */
export function useCreditsShortfall(zh: boolean) {
  const [shortfall, setShortfall] = useState<{ notice: string; requiredCredits?: number } | null>(null);

  const report = useCallback((notice: string, requiredCredits?: number) => {
    setShortfall({ notice, requiredCredits });
  }, []);

  const note = useCallback((notice: string, requiredCredits?: number) => {
    setShortfall({ notice, requiredCredits });
  }, []);

  const isShortfall = (notice: string | null) => Boolean(notice && shortfall?.notice === notice);

  const action = (notice: string | null) =>
    notice && shortfall?.notice === notice ? (
      <button
        type="button"
        className="cu-get"
        onClick={goToPricingForCredits}
      >
        {zh ? "购买积分" : "Buy credits"}
      </button>
    ) : null;

  return { report, note, isShortfall, action };
}
