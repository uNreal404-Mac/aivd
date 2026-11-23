"use client";

import { useCallback, useState } from "react";

import { goToPricingForCredits } from "@/lib/credit-return";
import "./credits-upgrade-modal.css";

/**
 * A credit shortfall saves the current generator draft and opens pricing.
 * After checkout, the customer returns to the same generator.
 */
export function useCreditsShortfall(zh: boolean) {
  const [shortfall, setShortfall] = useState<{ notice: string; requiredCredits?: number } | null>(null);

  const report = useCallback(
    (notice: string, requiredCredits?: number) => {
      setShortfall({ notice, requiredCredits });
      goToPricingForCredits();
    },
    [],
  );

  const note = useCallback((notice: string, requiredCredits?: number) => { setShortfall({ notice, requiredCredits }); goToPricingForCredits(); }, []);

  const isShortfall = (notice: string | null) => Boolean(notice && shortfall?.notice === notice);

  const action = (notice: string | null) =>
    notice && shortfall?.notice === notice ? (
      <button
        type="button"
        className="cu-get"
        onClick={goToPricingForCredits}
      >
        {zh ? "获取积分" : "Get credits"}
      </button>
    ) : null;

  return { report, note, isShortfall, action };
}
