"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  GALLERY_DESCRIPTION_MAX,
  GALLERY_FALLBACK_TITLE_LENGTH,
  GALLERY_PUBLIC_PROMPT_MAX,
  GALLERY_TITLE_MAX,
  publishInputSchema,
  type PublishInput,
} from "@/lib/gallery";

/**
 * Minimal structural shape the dialog needs. Keeping it structural lets the
 * dialog be driven from both a raw `videos` row and the dashboard `Video`.
 */
export interface PublishableVideo {
  uuid: string;
  prompt?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  startImageUrl?: string | null;
}

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  video: PublishableVideo | null;
  /** Super accounts may protect the prompt and edit the public one. */
  isSuperAccount?: boolean;
  onPublished?: (uuid: string) => void;
}

/** Minimal on-theme textarea (mirrors the shared Input styling). */
function GalleryTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={`flex w-full rounded-[var(--du-glass-radius-btn)] border border-[var(--du-border)] bg-[var(--du-bg-elev)] px-3 py-2 text-sm text-[var(--du-text)] placeholder:text-[var(--du-text-dim)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--du-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${className ?? ""}`}
      {...rest}
    />
  );
}

/** Pull a machine-readable code/message out of an unknown API error body. */
function pickErrorCode(body: unknown): string | null {
  if (typeof body === "string") return body;
  if (!body || typeof body !== "object") return null;

  const record = body as Record<string, unknown>;
  for (const key of ["code", "error", "message"] as const) {
    const value = record[key];
    if (typeof value === "string") return value;
    if (value && typeof value === "object") {
      const nested = value as Record<string, unknown>;
      if (typeof nested.code === "string") return nested.code;
      if (typeof nested.message === "string") return nested.message;
    }
  }

  return null;
}

export function PublishDialog({
  open,
  onOpenChange,
  video,
  isSuperAccount = false,
  onPublished,
}: PublishDialogProps) {
  const t = useTranslations("Gallery.publishDialog");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [protectPrompt, setProtectPrompt] = useState(false);
  const [publicPrompt, setPublicPrompt] = useState("");
  const [allowAssetReuse, setAllowAssetReuse] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyInGallery, setAlreadyInGallery] = useState(false);
  const [error, setError] = useState<"invalid" | "error" | null>(null);

  const videoId = video?.uuid ?? null;
  const originalPrompt = (video?.prompt ?? "").trim();
  const hasStartImage = Boolean(video?.startImageUrl);
  const canProtect = isSuperAccount;

  useEffect(() => {
    if (!open || !videoId) return;

    setTitle(originalPrompt.slice(0, GALLERY_FALLBACK_TITLE_LENGTH));
    setDescription("");
    setProtectPrompt(false);
    setPublicPrompt("");
    setAllowAssetReuse(false);
    setIsSubmitting(false);
    setAlreadyInGallery(false);
    setError(null);
  }, [open, videoId, originalPrompt]);

  const handleSubmit = async () => {
    if (!videoId || isSubmitting || alreadyInGallery) return;

    const draft: PublishInput = { title: title.trim() };
    if (description.trim()) draft.description = description.trim();
    if (canProtect && protectPrompt) {
      draft.protectPrompt = true;
      draft.publicPrompt = publicPrompt.trim();
    }
    if (hasStartImage && allowAssetReuse) draft.allowAssetReuse = true;

    const parsed = publishInputSchema.safeParse(draft);
    if (!parsed.success) {
      setError("invalid");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/video/${videoId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      if (response.ok) {
        onPublished?.(videoId);
        onOpenChange(false);
        return;
      }

      let code: string | null = null;
      try {
        code = pickErrorCode(await response.json());
      } catch {
        code = null;
      }

      if (response.status === 409 && /ALREADY_PUBLISHED/i.test(code ?? "")) {
        setAlreadyInGallery(true);
        onPublished?.(videoId);
        return;
      }

      setError("error");
    } catch {
      setError("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const disabled = isSubmitting || alreadyInGallery;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[var(--du-border)] bg-[var(--du-surface)] text-[var(--du-text)] md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[var(--du-text)]">
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-[var(--du-text-muted)]">
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        {video && (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[var(--du-glass-radius-card)] border border-[var(--du-border)] bg-[var(--du-bg)]">
              <video
                src={video.videoUrl ?? undefined}
                poster={video.thumbnailUrl ?? undefined}
                controls
                preload="none"
                className="aspect-video w-full object-contain"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="gallery-publish-title"
                className="text-xs font-medium text-[var(--du-text-muted)]"
              >
                {t("titleLabel")}
              </label>
              <Input
                id="gallery-publish-title"
                value={title}
                maxLength={GALLERY_TITLE_MAX}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("titlePlaceholder")}
                disabled={disabled}
                className="border-[var(--du-border)] bg-[var(--du-bg-elev)] text-[var(--du-text)] placeholder:text-[var(--du-text-dim)]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="gallery-publish-description"
                className="text-xs font-medium text-[var(--du-text-muted)]"
              >
                {t("descriptionLabel")}
                <span className="ml-1 text-[var(--du-text-dim)]">
                  ({t("descriptionOptional")})
                </span>
              </label>
              <GalleryTextarea
                id="gallery-publish-description"
                value={description}
                maxLength={GALLERY_DESCRIPTION_MAX}
                rows={3}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t("descriptionPlaceholder")}
                disabled={disabled}
              />
            </div>

            <div className="space-y-2 rounded-[var(--du-glass-radius-card)] border border-[var(--du-border)] bg-[var(--du-bg-elev)] p-3">
              <div className="text-xs font-medium text-[var(--du-text-muted)]">
                {t("promptLabel")}
              </div>
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm text-[var(--du-text)]">
                {originalPrompt}
              </p>

              {canProtect ? (
                <>
                  <label className="flex items-center gap-3 text-sm text-[var(--du-text)]">
                    <input
                      type="checkbox"
                      checked={protectPrompt}
                      onChange={(event) =>
                        setProtectPrompt(event.target.checked)
                      }
                      disabled={disabled}
                      className="h-4 w-4 rounded border-[var(--du-border)] accent-[var(--du-accent)]"
                    />
                    {t("protectPrompt")}
                  </label>
                  <p className="text-xs text-[var(--du-text-dim)]">
                    {t("protectPromptHint")}
                  </p>

                  {protectPrompt && (
                    <div className="space-y-1.5">
                      <label
                        htmlFor="gallery-public-prompt"
                        className="text-xs font-medium text-[var(--du-text-muted)]"
                      >
                        {t("publicPromptLabel")}
                      </label>
                      <GalleryTextarea
                        id="gallery-public-prompt"
                        value={publicPrompt}
                        maxLength={GALLERY_PUBLIC_PROMPT_MAX}
                        rows={3}
                        onChange={(event) => setPublicPrompt(event.target.value)}
                        placeholder={t("publicPromptPlaceholder")}
                        disabled={disabled}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-[var(--du-text-dim)]">
                  {t("promptWillBePublic")}
                </p>
              )}
            </div>

            {hasStartImage && (
              <label className="flex items-center gap-3 text-sm text-[var(--du-text)]">
                <input
                  type="checkbox"
                  checked={allowAssetReuse}
                  onChange={(event) => setAllowAssetReuse(event.target.checked)}
                  disabled={disabled}
                  className="h-4 w-4 rounded border-[var(--du-border)] accent-[var(--du-accent)]"
                />
                {t("allowAssetReuse")}
              </label>
            )}

            {alreadyInGallery && (
              <p className="text-sm text-[var(--du-accent-text)]">
                {t("alreadyInGallery")}
              </p>
            )}
            {error && (
              <p className="text-sm text-[var(--du-accent-2)]">{t(error)}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="du-glass-btn px-4 py-2 text-sm font-medium"
          >
            {alreadyInGallery ? t("close") : t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={disabled}
            className="rounded-[var(--du-glass-radius-btn)] bg-[var(--du-gradient)] px-4 py-2 text-sm font-medium text-[var(--du-on-accent)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? t("submitting") : t("submit")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
