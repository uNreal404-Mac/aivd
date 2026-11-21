"use client";

import { useCallback, useState } from "react";

import { useUpgradeModal } from "@/hooks/use-upgrade-modal";
import "./credits-upgrade-modal.css";

/**
 * For a studio whose generation was refused for lack of credits: `report`
 * opens the upgrade dialog and remembers which notice that was, `note` only
 * remembers it (for a shortfall the studio caught before sending), and
 * `action` gives a "Get credits" button to show beside that notice (nothing
 * beside any other notice), which opens the dialog. `isShortfall` tells the
 * studio whether a notice is that one.
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

  const note = useCallback((notice: string, requiredCredits?: number) => setShortfall({ notice, requiredCredits }), []);

  const isShortfall = (notice: string | null) => Boolean(notice && shortfall?.notice === notice);

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

  return { report, note, isShortfall, action };
}
