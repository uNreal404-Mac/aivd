"use client";

import { useCallback, useState } from "react";

import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import "./credits-upgrade-modal.css";

/**
 * For a studio whose generation was refused for lack of credits: `report`
 * opens the upgrade dialog and remembers which notice that was, and `action`
 * gives a "Get credits" button to show beside that notice (nothing beside any
 * other notice), which opens the dialog again.
 */
export function useCreditsShortfall(zh: boolean) {
  const openModal = useUpgradeModal((state) => state.openModal);
  const [shortfall, setShortfall] = useState<{ notice: string; requiredCredits?: number } | null>(null);

  const report = useCallback(
    (notice: string, requiredCredits?: number) => {
      setShortfall({ notice, requiredCredits });
      openModal({ reason: "insufficient_credits", requiredCredits });
    },
    [openModal],
  );

  const action = (notice: string | null) =>
    notice && shortfall?.notice === notice ? (
      <button
        type="button"
        className="cu-get"
        onClick={() => openModal({ reason: "insufficient_credits", requiredCredits: shortfall.requiredCredits })}
      >
        {zh ? "获取积分" : "Get credits"}
      </button>
    ) : null;

  return { report, action };
}
