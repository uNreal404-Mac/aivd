"use client";

import { useEffect, useRef } from "react";

/** Save a generator's complete state only for the detour through pricing. */
export function useCreditReturnDraft<T>(kind: string, snapshot: () => T, restore: (draft: T) => void): void {
  const callbacks = useRef({ snapshot, restore });
  callbacks.current = { snapshot, restore };

  useEffect(() => {
    const key = `aivd:credit-draft:${kind}`;
    const path = window.location.pathname;
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null") as { path?: string; draft?: T } | null;
      if (saved?.path === path && saved.draft) {
        callbacks.current.restore(saved.draft);
        sessionStorage.removeItem(key);
      }
    } catch { sessionStorage.removeItem(key); }

    const save = () => {
      try { sessionStorage.setItem(key, JSON.stringify({ path, draft: callbacks.current.snapshot() })); }
      catch { /* A blocked storage quota should not prevent the pricing page opening. */ }
    };
    window.addEventListener("aivd:save-credit-draft", save);
    return () => window.removeEventListener("aivd:save-credit-draft", save);
  }, [kind]);
}
