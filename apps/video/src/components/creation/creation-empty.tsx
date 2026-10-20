"use client";

// ============================================
// Creation Empty State Component
// ============================================

import { useTranslations } from "next-intl";
import { Film, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/components/ui";

interface CreationEmptyProps {
  className?: string;
}

export function CreationEmpty({ className }: CreationEmptyProps) {
  const t = useTranslations("dashboard.myCreations.empty");

  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center px-4 py-24 text-center",
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface-2)]">
        <Film className="h-6 w-6 text-[var(--du-accent-text)]" />
      </div>

      <h3 className="mt-5 text-lg font-semibold text-[var(--du-text)]">{t("title")}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-[var(--du-text-muted)]">
        {t("description")}
      </p>

      <Link
        href="/text-to-video"
        className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--du-accent)] px-3.5 text-sm font-medium text-[var(--du-on-accent)] hover:bg-[var(--du-accent-hover)]"
      >
        <Sparkles className="h-4 w-4" />
        {t("cta")}
      </Link>
    </div>
  );
}
