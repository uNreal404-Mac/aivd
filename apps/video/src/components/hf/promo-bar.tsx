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
    <div className="relative flex h-[45px] items-center justify-center bg-[image:var(--du-gradient)] px-4 text-[var(--du-on-accent)]">
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden sm:inline">
          Seedance 2.0 mini is next · 1.5 Pro sunsets Nov 11, 2026
        </span>
        <span className="sm:hidden">Seedance 2.0 mini is next</span>
        <Link
          href={`/${lang}/seedance-2-0-mini`}
          className="inline-flex h-7 items-center rounded-md bg-[var(--du-bg)] px-2 text-xs font-medium text-[var(--du-text)]"
        >
          Learn more
        </Link>
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setVisible(false)}
        className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-md text-[var(--du-on-accent)] hover:bg-white/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
