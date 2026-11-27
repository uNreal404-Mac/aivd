"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Sparkles } from "lucide-react";

import { applyTemplate } from "@/components/gallery/use-template";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GalleryItem } from "@/lib/gallery";
import { localizedHref } from "@/lib/du-home";
import Link from "next/link";

export interface GalleryDetailDialogProps {
  item: GalleryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GalleryDetailDialog({
  item,
  open,
  onOpenChange,
}: GalleryDetailDialogProps) {
  const t = useTranslations("Gallery");
  const tc = useTranslations("Common");
  const locale = useLocale();
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [rating, setRating] = useState<{ ratingAverage: number; ratingCount: number } | null>(null);
  const [ratingStatus, setRatingStatus] = useState<"idle" | "sending" | "login" | "error" | "saved">("idle");

  useEffect(() => {
    if (!open || !item) return;
    let active = true;
    fetch(`/api/v1/gallery/${encodeURIComponent(item.uuid)}/rating`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (active && payload) setRating(payload.data ?? payload); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [open, item]);

  useEffect(() => {
    if (!open) {
      setPending(false);
      setFailed(false);
      setRating(null);
      setRatingStatus("idle");
    }
  }, [open]);

  const handleUseTemplate = useCallback(async () => {
    if (!item || pending) return;
    setPending(true);
    setFailed(false);
    const ok = await applyTemplate(item.uuid, router, locale);
    setPending(false);
    if (!ok) setFailed(true);
  }, [item, locale, pending, router]);

  const handleRate = useCallback(async (score: number) => {
    if (!item || ratingStatus === "sending") return;
    setRatingStatus("sending");
    try {
      const response = await fetch(`/api/v1/gallery/${encodeURIComponent(item.uuid)}/rating`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score }) });
      if (response.status === 401) { setRatingStatus("login"); return; }
      if (!response.ok) { setRatingStatus("error"); return; }
      const payload = await response.json();
      setRating(payload.data ?? payload);
      setRatingStatus("saved");
    } catch { setRatingStatus("error"); }
  }, [item, ratingStatus]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] gap-0 border-[var(--du-border)] bg-[var(--du-surface)] p-0 text-[var(--du-text)]">
        <div className="flex flex-col">
          <div className="relative aspect-video w-full overflow-hidden bg-[var(--du-bg)]">
            {item.videoUrl ? (
              <video
                src={item.videoUrl}
                poster={item.thumbnailUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-contain"
              />
            ) : item.thumbnailUrl ? (
              <img
                src={item.thumbnailUrl}
                alt={item.title}
                loading="lazy"
                className="h-full w-full object-contain"
              />
            ) : null}
          </div>

          <div className="flex flex-col gap-5 p-6">
            <DialogHeader className="text-left">
              <DialogTitle className="text-lg font-semibold text-[var(--du-text)]">
                {item.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--du-text-muted)]">
                {item.authorName} · {item.modelLabel}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--du-text-dim)]">
                {t("publishDialog.promptLabel")}
              </p>
              {item.publicPrompt ? (
                <p className="max-h-56 overflow-y-auto whitespace-pre-wrap text-sm text-[var(--du-text-muted)]">
                  {item.publicPrompt}
                </p>
              ) : (
                <p className="inline-flex items-center gap-2 text-sm text-[var(--du-text-dim)]">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("promptProtected")}
                </p>
              )}
            </div>

            {item.description ? (
              <div className="flex flex-col gap-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--du-text-dim)]">
                  {t("publishDialog.descriptionLabel")}
                </p>
                <p className="whitespace-pre-wrap text-sm text-[var(--du-text-muted)]">
                  {item.description}
                </p>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--du-border)] pt-4">
              <span className="text-xs text-[var(--du-text-muted)]">{locale === "zh" ? "社区评分" : "Community rating"}{rating?.ratingCount ? ` · ${rating.ratingAverage.toFixed(1)} / 5 (${rating.ratingCount})` : ""}</span>
              <div className="flex gap-1" role="group" aria-label={locale === "zh" ? "给作品评分" : "Rate this creation"}>{[1, 2, 3, 4, 5].map((score) => <button key={score} type="button" disabled={ratingStatus === "sending"} onClick={() => void handleRate(score)} aria-label={`${score} / 5`} className="text-lg text-[var(--du-accent)] transition-transform hover:scale-125 disabled:opacity-50">★</button>)}</div>
              {ratingStatus === "login" ? <Link href={localizedHref(locale, "/login")} className="text-xs text-[var(--du-accent-text)] underline">{locale === "zh" ? "登录后评分" : "Sign in to rate"}</Link> : null}
              {ratingStatus === "error" ? <span role="status" className="text-xs text-[var(--du-text-muted)]">{locale === "zh" ? "暂时无法评分，或不能评价自己的作品。" : "Rating unavailable, or you cannot rate your own creation."}</span> : null}
              {ratingStatus === "saved" ? <span role="status" className="text-xs text-[var(--du-text-muted)]">{locale === "zh" ? "已保存评分" : "Rating saved"}</span> : null}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
              {failed ? (
                <p className="text-xs text-[var(--du-text-muted)]">
                  {tc("error")}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void handleUseTemplate()}
                disabled={pending}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--du-accent)] px-5 text-sm font-medium text-[var(--du-on-accent)] shadow-[var(--du-glow)] transition-colors hover:bg-[var(--du-accent-hover)] disabled:opacity-60"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                {t("useTemplate")}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
