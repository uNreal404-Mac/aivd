"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

interface HfPromoBarProps {
  lang: string;
}

export function HfPromoBar({ lang }: HfPromoBarProps) {
  const [visible, setVisible] = useState(true);
  const isChinese = lang.toLowerCase().startsWith("zh");

  if (!visible) {
    return null;
  }

  return (
    <div className="relative flex h-[45px] items-center justify-center bg-[var(--du-accent)] px-4 text-[var(--du-on-accent)]">
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden sm:inline">
          {isChinese
            ? "首次使用？创建账户即可获得入门积分"
            : "New here? Get starter credits when you create an account"}
        </span>
        <span className="sm:hidden">
          {isChinese ? "注册即可获得入门积分" : "Get starter credits on sign up"}
        </span>
        <Link
          href={`/${lang}/pricing`}
          className="inline-flex h-7 items-center rounded-md bg-[var(--du-bg)] px-2 text-xs font-medium text-[var(--du-text)]"
        >
          {isChinese ? "查看套餐" : "See plans"}
        </Link>
      </div>
      <button
        type="button"
        aria-label={isChinese ? "关闭" : "Dismiss"}
        onClick={() => setVisible(false)}
        className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-md text-[var(--du-on-accent)] hover:bg-[var(--du-accent-hover)]"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
