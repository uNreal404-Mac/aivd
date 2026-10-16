"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  RECOMMENDED_PROMPTS,
  hasSeen,
  markSeen,
  onboardingCopy,
  promptHref,
} from "@/lib/onboarding";

const TITLE_ID = "du-onboarding-title";
const PROMPTS_HEADING_ID = "du-onboarding-prompts-heading";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface WelcomeModalProps {
  locale: string;
  userId: string;
  /** Server-computed: account created within the last 24 hours. */
  isNewUser: boolean;
  siteName: string;
  /** Gift info from CREDITS_CONFIG.registerGift, or null when not applicable. */
  gift: { amount: number; expireDays: number } | null;
}

export function WelcomeModal({
  locale,
  userId,
  isNewUser,
  siteName,
  gift,
}: WelcomeModalProps) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement | null>(null);

  const copy = onboardingCopy(locale);
  const prompts = RECOMMENDED_PROMPTS[locale === "zh" ? "zh" : "en"];

  useEffect(() => {
    if (!isNewUser) {
      setOpen(false);
      return;
    }

    if (typeof window === "undefined" || !window.localStorage) {
      // No storage available: treat as seen so we never show repeatedly.
      setOpen(false);
      return;
    }

    if (hasSeen(window.localStorage, userId)) {
      setOpen(false);
      return;
    }

    setOpen(true);
  }, [isNewUser, userId]);

  const dismiss = useCallback(() => {
    setOpen(false);
    if (typeof window !== "undefined" && window.localStorage) {
      markSeen(window.localStorage, userId);
    }
  }, [userId]);

  // Move focus into the dialog when it opens.
  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;
    const first = node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? node).focus();
  }, [open]);

  // Escape closes the dialog.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="ob-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <dialog
        open
        ref={dialogRef}
        className="ob-dialog"
        aria-modal="true"
        aria-labelledby={TITLE_ID}
        tabIndex={-1}
      >
        <button
          type="button"
          className="ob-close"
          onClick={dismiss}
          aria-label={copy.closeLabel}
        >
          ×
        </button>

        <h2 id={TITLE_ID} className="ob-dialog-title">
          {copy.title(siteName)}
        </h2>

        {gift ? (
          <p className="ob-gift">
            {copy.gift(gift.amount)}
            {gift.expireDays > 0 ? (
              <span className="ob-gift-expiry"> {copy.giftExpiry(gift.expireDays)}</span>
            ) : null}
          </p>
        ) : null}

        <h3 id={PROMPTS_HEADING_ID} className="ob-prompts-heading">
          {copy.promptsHeading}
        </h3>

        <ul className="ob-prompts" aria-labelledby={PROMPTS_HEADING_ID}>
          {prompts.map((prompt) => (
            <li key={prompt}>
              <a className="ob-prompt" href={promptHref(locale, prompt)} onClick={dismiss}>
                {prompt}
              </a>
            </li>
          ))}
        </ul>

        <div className="ob-actions">
          <button type="button" className="ob-btn ob-btn-secondary" onClick={dismiss}>
            {copy.exploreCta}
          </button>
        </div>
      </dialog>
    </div>
  );
}

export default WelcomeModal;
