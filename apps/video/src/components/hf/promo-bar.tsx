"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

interface HfPromoBarProps {
  lang: string;
}

export function HfPromoBar({ lang }: HfPromoBarProps) {
  const [visible, setVisible] = useState(true);

  if (!visible) {
    return null;
  }

  return (
    <div className="relative flex h-[45px] items-center justify-center bg-[var(--du-accent)] px-4 text-[var(--du-on-accent)]">
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden sm:inline">
          New here? Get starter credits when you create an account
        </span>
        <span className="sm:hidden">Get starter credits on sign up</span>
        <Link
          href={`/${lang}/pricing`}
          className="inline-flex h-7 items-center rounded-md bg-[var(--du-bg)] px-2 text-xs font-medium text-[var(--du-text)]"
        >
          See plans
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
        className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-md text-[var(--du-on-accent)] hover:bg-[var(--du-accent-hover)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
