"use client";

import { Coins, FastForward, Film, Loader2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSegmentIndicator } from "@/hooks/use-segment-indicator";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import {
  type ExtendChoice,
  EXTEND_MAX_PROMPT,
  EXTEND_MAX_SECONDS,
  EXTEND_MIN_PROMPT,
  EXTEND_MIN_SECONDS,
  EXTEND_RESOLUTIONS,
  canSubmitExtend,
  defaultExtendResolution,
  extendPrice,
  submitExtend,
} from "@/lib/video-extend";
import { useCreditsStore } from "@/stores/credits-store";
import "./extend-dialog.css";

/** A finished video of the visitor's that can be extended. */
export type ExtendSource = {
  videoUuid: string;
  sourceVideoKey?: string;
  /** Signed URL, for the preview of the last frame. */
  videoUrl: string;
  prompt?: string | null;
  resolution?: string | null;
  audio?: boolean | null;
  repeat?: ExtendChoice;
};

export type ExtendStarted = { uuid: string; prompt: string; duration: number; credits: number };

/**
 * 续写: adds seconds to the end of one of the visitor's own videos. The price
 * shown is the one the server freezes (lib/video-extend), billed only for the
 * added seconds and returned automatically when the run fails.
 */
export function ExtendDialog({
  source,
  zh,
  onClose,
  onStarted,
  onPending,
  inline,
  freeGeneration,
}: {
  freeGeneration?: boolean;
  inline?: { chooseSource: () => void; generationEnabled: boolean };
  source: ExtendSource | null;
  zh: boolean;
  onClose: () => void;
  onStarted: (job: ExtendStarted) => void;
  onPending?: (id: string, prompt?: string) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(5);
  const [resolution, setResolution] = useState("720p");
  const [audio, setAudio] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // One request per press, even for a double click before the next render.
  const inFlight = useRef(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const { data: session } = useSession();
  const signIn = useSigninModal();
  const shortfall = useCreditsShortfall(zh);
  const balance = useCreditsStore((state) => state.balance);
  const invalidate = useCreditsStore((state) => state.invalidate);
  const refetch = useCreditsStore((state) => state.fetchBalance);
  useEffect(() => {
    if (session?.user?.id) void refetch();
  }, [session?.user?.id, refetch]);
  const slot = inline
    ? `aivd:extend-draft:${session?.user?.id ?? "guest"}:${source?.sourceVideoKey || source?.videoUuid || "pending"}`
    : "";
  const [readySlot, setReadySlot] = useState<string | null>(null);
  useEffect(() => {
    let saved: Partial<ExtendChoice> | undefined;
    if (slot) {
      try {
        saved = JSON.parse(sessionStorage.getItem(slot) ?? "null") ?? undefined;
      } catch {
        /* Keep the current form. */
      }
    }
    const choice = source?.repeat ?? saved;
    if (!inline || !source || choice) {
      setPrompt(typeof choice?.prompt === "string" ? choice.prompt : "");
      setDuration(
        typeof choice?.duration === "number" &&
          choice.duration >= EXTEND_MIN_SECONDS &&
          choice.duration <= EXTEND_MAX_SECONDS
          ? choice.duration
          : 5,
      );
    }
    setResolution(defaultExtendResolution(choice?.resolution ?? source?.resolution));
    setAudio(typeof choice?.audio === "boolean" ? choice.audio : Boolean(source?.audio));
    setNotice(null);
    setReadySlot(slot);
  }, [slot, source?.videoUuid, source?.sourceVideoKey]);

  useEffect(() => {
    if (slot && readySlot === slot) {
      try {
        sessionStorage.setItem(slot, JSON.stringify({ prompt, duration, resolution, audio }));
      } catch {
        /* Keep the current form. */
      }
    }
  }, [slot, readySlot, prompt, duration, resolution, audio]);

  const choice = { prompt, duration, resolution, audio };
  const latestPrompt = useRef(prompt);
  latestPrompt.current = prompt;
  const free = freeGeneration ?? (process.env.NEXT_PUBLIC_IS_PREVIEW === "true" && session?.user?.isAdmin === true && session.user.isSuperAccount === true);
  const credits = free ? 0 : extendPrice({ duration, resolution, audio });
  const available = session && balance ? balance.availableCredits : null;
  const shortBy = available !== null && available < credits ? credits - available : 0;
  const ready = canSubmitExtend(choice);

  const submit = async () => {
    if (inFlight.current) return;
    if (!source) { inline?.chooseSource(); return; }
    if (inline && !inline.generationEnabled && session) {
      setNotice(zh ? "当前预览未开启生成。" : "Generation is unavailable in this preview.");
      return;
    }
    if (!ready) {
      setNotice(zh ? `说说接下来发生什么（至少 ${EXTEND_MIN_PROMPT} 个字）。` : `Say what happens next (at least ${EXTEND_MIN_PROMPT} characters).`);
      promptRef.current?.focus();
      return;
    }
    if (!session) {
      signIn.onOpen();
      return;
    }
    const submittedPrompt = prompt;
    const submittedDuration = duration;
    const pendingId = crypto.randomUUID();
    inFlight.current = true;
    onPending?.(pendingId, submittedPrompt.trim());
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await submitExtend(source.sourceVideoKey ? { sourceVideoKey:source.sourceVideoKey } : source.videoUuid, choice, zh, session.user.id);
      if (!result.ok) {
        setNotice(result.message);
        if (result.needsLogin) signIn.onOpen();
        if (result.code === "INSUFFICIENT_CREDITS") shortfall.report(result.message, result.requiredCredits);
        return;
      }
      invalidate();
      void refetch();
      onStarted({ uuid: result.uuid, prompt: submittedPrompt.trim(), duration: submittedDuration, credits });
      const promptUnchanged = latestPrompt.current === submittedPrompt;
      if (slot && promptUnchanged) {
        try {
          sessionStorage.removeItem(slot);
          sessionStorage.removeItem(`aivd:extend-draft:${session.user.id}:pending`);
        } catch {
          /* Done in memory below. */
        }
        setPrompt("");
        setDuration(5);
        setReadySlot(null);
      }
      if (!inline || promptUnchanged) onClose();
    } finally {
      onPending?.(pendingId);
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const fields = (
    <>
        {source ? (
          <div className="xd-source">
            {source.videoUrl ? (
              <video
                src={source.videoUrl}
                muted
                playsInline
                preload="metadata"
                // Show where it will continue from: the last frame.
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  if (Number.isFinite(video.duration) && video.duration > 0.2) video.currentTime = video.duration - 0.05;
                }}
              />
            ) : (
              <div className="xd-source-fallback">
                <Film aria-hidden="true" />
                <span>{source.prompt || (zh ? "原视频已保留，预览暂时不可用" : "Original clip attached (preview temporarily unavailable)")}</span>
              </div>
            )}
            <span className="xd-source-tag">
              <FastForward aria-hidden="true" />
              {zh ? "从这里接着往下" : "Continues from here"}
            </span>
            {inline ? <button type="button" className="xd-replace" disabled={submitting} onClick={inline.chooseSource}>{zh ? "更换视频" : "Change video"}</button> : null}
          </div>
        ) : inline ? (
          <button type="button" className="xd-pick" onClick={inline.chooseSource}>
            <Film aria-hidden="true" />
            <strong>{zh ? "添加要延长的视频" : "Add a video to extend"}</strong>
            <span>{zh ? "上传视频或从已完成的作品中选择" : "Upload a video or choose a finished creation"}</span>
          </button>
        ) : null}

        <label className="xd-field">
          <span className="xd-label">{zh ? "接下来发生什么" : "What happens next"}</span>
          <textarea
            ref={promptRef}
            value={prompt}
            disabled={submitting}
            maxLength={EXTEND_MAX_PROMPT}
            rows={3}
            placeholder={zh ? "例如：镜头慢慢拉远，她转身走进雨里" : "e.g. The camera pulls back as she turns and walks into the rain"}
            onChange={(event) => {
              setPrompt(event.target.value);
              if (notice) setNotice(null);
            }}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void submit();
              }
            }}
          />
        </label>

        <div className="xd-row">
          <label className="xd-field xd-seconds">
            <span className="xd-label">
              {zh ? "续写时长" : "Add"} <strong className="du-num">+{duration}{zh ? " 秒" : "s"}</strong>
            </span>
            <input
              type="range"
              min={EXTEND_MIN_SECONDS}
              max={EXTEND_MAX_SECONDS}
              step={1}
              disabled={submitting}
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              aria-label={zh ? "续写时长（秒）" : "Seconds to add"}
            />
          </label>
          <button
            type="button"
            className="xd-sound"
            disabled={submitting}
            aria-pressed={audio}
            onClick={() => setAudio((value) => !value)}
          >
            {audio ? <Volume2 key="on" data-swap aria-hidden="true" /> : <VolumeX key="off" data-swap aria-hidden="true" />}
            {audio ? (zh ? "生成声音" : "With sound") : (zh ? "不要声音" : "No sound")}
          </button>
        </div>

        <div className="xd-field">
          <span className="xd-label">{zh ? "画质" : "Quality"}</span>
          <QualityPicker zh={zh} value={resolution} disabled={submitting} onChange={setResolution} />
        </div>

        {notice ? (
          <output data-presence="fade" className="xd-notice" aria-live="polite">
            {notice}
            {shortfall.action(notice)}
          </output>
        ) : null}

        <div className="xd-footer">
          <p className="xd-terms">
            {zh ? "只按新增的秒数收费；生成失败自动退回积分。" : "Charged only for the added seconds; refunded automatically if it fails."}
            {available !== null ? (
              <span className={shortBy ? "xd-short" : undefined}>
                {zh ? ` 余额 ${available.toLocaleString()} 积分` : ` Balance ${available.toLocaleString()} credits`}
                {shortBy ? (zh ? `，还差 ${shortBy} 积分` : ` (${shortBy} more needed)`) : ""}
              </span>
            ) : null}
          </p>
          <button type="button" className="xd-go" disabled={submitting} aria-busy={submitting || undefined} onClick={() => void submit()}>
            {submitting ? <Loader2 className="xd-spin" aria-hidden="true" /> : <FastForward aria-hidden="true" />}
            {zh ? "续写" : "Extend"}
            <span className="xd-cost">
              <Coins aria-hidden="true" />
              <span className="du-num">{credits}</span>
              <span className="sr-only">{zh ? " 积分" : " credits"}</span>
            </span>
          </button>
        </div>
    </>
  );

  if (inline) return <div className="xd-inline">{fields}</div>;
  return (
    <Dialog
      open={source !== null}
      onOpenChange={(next) => {
        if (!next && !submitting) onClose();
      }}
    >
      <DialogContent className="xd-dialog md:max-w-[560px]">
        <DialogTitle className="xd-title">{zh ? "续写视频" : "Extend video"}</DialogTitle>
        <DialogDescription className="xd-sub">
          {zh ? "从这段视频的结尾接着往下生成，描述接下来的画面。" : "Continue from the end of this clip, picking up its look and motion."}
        </DialogDescription>

        {fields}
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog's content, so the sliding highlight measures the
 * buttons once they exist (the dialog renders its content only when open). */
function QualityPicker({ zh, value, disabled, onChange }: { zh: boolean; value: string; disabled?: boolean; onChange: (next: string) => void }) {
  const ref = useSegmentIndicator<HTMLDivElement>(value);
  return (
    <div ref={ref} className="xd-seg du-seg" aria-label={zh ? "画质" : "Quality"}>
      {EXTEND_RESOLUTIONS.map((item) => (
        <button
          key={item}
          type="button"
          disabled={disabled}
          aria-pressed={value === item}
          className={value === item ? "xd-seg-on" : undefined}
          onClick={() => onChange(item)}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
