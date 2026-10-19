"use client";

import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import type { EnhanceLanguage } from "@/lib/prompt-enhance/config";

interface EnhanceConfig {
  enabled: boolean;
  maxInputChars: number;
}

const UNKNOWN_CONFIG: EnhanceConfig = { enabled: false, maxInputChars: 0 };

/** Module-level cache so every button instance shares a single probe. */
let configPromise: Promise<EnhanceConfig> | null = null;

function loadEnhanceConfig(): Promise<EnhanceConfig> {
  if (!configPromise) {
    configPromise = fetch("/api/v1/prompt/enhance", {
      method: "GET",
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) {
          return UNKNOWN_CONFIG;
        }
        const payload = (await response.json()) as {
          data?: { enabled?: unknown; maxInputChars?: unknown };
        };
        const data = payload?.data ?? {};
        return {
          enabled: data.enabled === true,
          maxInputChars:
            typeof data.maxInputChars === "number" ? data.maxInputChars : 0,
        };
      })
      .catch(() => UNKNOWN_CONFIG);
  }
  return configPromise;
}

/** Test helper: drops the cached capability probe. */
export function __resetEnhanceConfigCache(): void {
  configPromise = null;
}

const MESSAGES = {
  en: {
    button: "Enhance",
    busy: "Enhancing…",
    undo: "Undo",
    ariaLabel: "Enhance prompt with AI",
    signIn: "Sign in to use Enhance",
    rateLimited: "Too many requests, try again later",
    blocked: "This request can't be enhanced",
    failed: "Enhance failed, try again",
  },
  zh: {
    button: "优化",
    busy: "优化中…",
    undo: "撤销",
    ariaLabel: "使用 AI 优化提示词",
    signIn: "登录后可使用优化",
    rateLimited: "请求太频繁，请稍后再试",
    blocked: "该内容无法优化",
    failed: "优化失败，请重试",
  },
} as const;

export interface EnhancePromptButtonProps {
  prompt: string;
  onEnhanced: (next: string) => void;
  language?: EnhanceLanguage;
  locale?: "en" | "zh";
  disabled?: boolean;
  className?: string;
}

export function EnhancePromptButton({
  prompt,
  onEnhanced,
  language = "auto",
  locale = "en",
  disabled = false,
  className,
}: EnhancePromptButtonProps) {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [maxInputChars, setMaxInputChars] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previous, setPrevious] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadEnhanceConfig().then((config) => {
      if (cancelled) {
        return;
      }
      setEnabled(config.enabled);
      setMaxInputChars(config.maxInputChars);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const labels = MESSAGES[locale];

  const handleEnhance = useCallback(async () => {
    const current = prompt;
    if (busy || current.trim().length === 0) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/v1/prompt/enhance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: current, language }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          setMessage(MESSAGES[locale].signIn);
        } else if (response.status === 429) {
          setMessage(MESSAGES[locale].rateLimited);
        } else if (response.status === 422) {
          setMessage(MESSAGES[locale].blocked);
        } else {
          setMessage(MESSAGES[locale].failed);
        }
        return;
      }

      const payload = (await response.json()) as {
        data?: { prompt?: unknown };
      };
      const next = payload?.data?.prompt;
      if (typeof next !== "string" || next.trim().length === 0) {
        setMessage(MESSAGES[locale].failed);
        return;
      }

      setPrevious(current);
      onEnhanced(next);
    } catch {
      setMessage(MESSAGES[locale].failed);
    } finally {
      setBusy(false);
    }
  }, [busy, language, locale, onEnhanced, prompt]);

  const handleUndo = useCallback(() => {
    if (previous === null) {
      return;
    }
    onEnhanced(previous);
    setPrevious(null);
  }, [onEnhanced, previous]);

  // Unknown capability or feature disabled: render nothing at all.
  if (enabled !== true) {
    return null;
  }

  const trimmed = prompt.trim();
  const tooLong = maxInputChars > 0 && trimmed.length > maxInputChars;
  const isDisabled = disabled || busy || trimmed.length === 0 || tooLong;

  return (
    <div
      className={className ? `flex flex-col gap-1 ${className}` : "flex flex-col gap-1"}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleEnhance}
          disabled={isDisabled}
          aria-label={labels.ariaLabel}
          aria-busy={busy}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-1 text-xs font-medium text-foreground transition hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-3 w-3" aria-hidden="true" />
          <span>{busy ? labels.busy : labels.button}</span>
        </button>
        {previous !== null && !busy ? (
          <button
            type="button"
            onClick={handleUndo}
            className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {labels.undo}
          </button>
        ) : null}
      </div>
      {message ? (
        <output aria-live="polite" className="block text-xs text-destructive">
          {message}
        </output>
      ) : null}
    </div>
  );
}
