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
    <div className="relative flex h-[42px] items-center justify-center bg-[var(--du-accent)] px-4 text-[var(--du-on-accent)]">
      <div className="flex items-center gap-3 text-[13px]">
        <span className="hidden items-center gap-1.5 rounded-full bg-[var(--du-on-accent)]/10 px-2.5 py-0.5 text-[11px] font-semibold sm:inline-flex">
          {isChinese ? "新用户福利" : "New user offer"}
        </span>
        <span className="font-medium">
          {isChinese ? "注册即送 70 积分，可免费生成第一条视频" : "Sign up and get 70 credits for your first video"}
        </span>
        <Link
          href={`/${lang}/pricing`}
          className="inline-flex h-[26px] items-center rounded-full bg-[var(--du-bg)] px-4 text-xs font-medium text-white"
        >
          {isChinese ? "查看套餐" : "See plans"}
        </Link>
      </div>
      <button
        type="button"
        aria-label={isChinese ? "关闭" : "Dismiss"}
        onClick={() => setVisible(false)}
        className="absolute right-3 flex h-7 w-7 items-center justify-center rounded-full text-[var(--du-on-accent)] hover:bg-black/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
