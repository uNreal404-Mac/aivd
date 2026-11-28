"use client";

import { useEffect, useState } from "react";

/**
 * Keeps an unsent prompt in localStorage so a refresh or a detour through
 * another page does not lose it. The saved text comes back on the next visit
 * unless the page was opened with a prompt of its own (`skip`).
 */
export function usePromptDraft(key: string, value: string, setValue: (text: string) => void, skip: boolean) {
  const storageKey = `aivd:draft:${key}`;
  const [restored, setRestored] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!skip) {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved?.trim()) {
          setValue(saved);
          setRestored(saved);
        }
      } catch {
        // Storage can be blocked; the page works without drafts.
      }
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      // Persist the latest keystroke before a route change unmounts the editor.
      if (value.trim()) localStorage.setItem(storageKey, value);
      else localStorage.removeItem(storageKey);
    } catch {
      // Ignore: see above.
    }
  }, [ready, storageKey, value]);

  return {
    /** True while the field still shows the text that was brought back. */
    restored: restored !== null && restored === value,
    discard: () => {
      setValue("");
      setRestored(null);
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // Ignore: see above.
      }
    },
  };
}
