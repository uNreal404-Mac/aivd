"use client";

import { useEffect, useState } from "react";

let cached: Promise<boolean> | null = null;

/** Clears the cached answer, for example after a purchase or a sign-in. */
export function resetFirstPurchase() {
  cached = null;
}

/**
 * Whether the visitor can still get first-purchase offers. `null` while the
 * answer is loading; callers should not show an offer until it is `true`.
 */
export function useFirstPurchase(): boolean | null {
  const [value, setValue] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    cached ??= fetch("/api/payments/offers", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { firstPurchase: false }))
      .then((data: { firstPurchase?: boolean }) => data.firstPurchase === true)
      .catch(() => false);
    void cached.then((answer) => {
      if (live) setValue(answer);
    });
    return () => {
      live = false;
    };
  }, []);
  return value;
}
