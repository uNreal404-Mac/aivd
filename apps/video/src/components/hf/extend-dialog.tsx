"use client";

import { Coins, FastForward, Loader2, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSegmentIndicator } from "@/hooks/use-segment-indicator";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import {
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
import { useCreditReturnDraft } from "@/hooks/use-credit-return-draft";
import { useCredits } from "@/stores/credits-store";
import "./extend-dialog.css";

/** A finished video of the visitor's that can be extended. */
export type ExtendSource = {
  videoUuid: string;
  /** Signed URL, for the preview of the last frame. */
  videoUrl: string;
  prompt?: string | null;
  resolution?: string | null;
  audio?: boolean | null;
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
  onRestore,
}: {
  source: ExtendSource | null;
  zh: boolean;
  onClose: () => void;
  onStarted: (job: ExtendStarted) => void;
  /** Back from buying credits: reopen this source with what was filled in. */
  onRestore: (source: ExtendSource) => void;
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
  const { balance, invalidate, refetch } = useCredits();

  // A trip to the pricing page keeps the open extend and what was filled in.
  const restored = useRef<{ uuid: string; prompt: string; duration: number; resolution: string; audio: boolean } | null>(null);
  useCreditReturnDraft(
    "extend",
    () => (source ? { source, prompt, duration, resolution, audio } : null),
    (saved) => {
      if (!saved?.source?.videoUuid) return;
      restored.current = { uuid: saved.source.videoUuid, prompt: saved.prompt ?? "", duration: saved.duration ?? 5, resolution: saved.resolution ?? "720p", audio: Boolean(saved.audio) };
      onRestore(saved.source);
    },
  );

  // Each opened video starts from its own quality and sound (or, back from
  // pricing, from what was filled in before).
  useEffect(() => {
    if (!source) return;
    const back = restored.current?.uuid === source.videoUuid ? restored.current : null;
    restored.current = null;
    setPrompt(back?.prompt ?? "");
    setDuration(back?.duration ?? 5);
    setResolution(back?.resolution ?? defaultExtendResolution(source.resolution));
    setAudio(back ? back.audio : Boolean(source.audio));
    setNotice(null);
  }, [source?.videoUuid]);

  const choice = { prompt, duration, resolution, audio };
  const credits = extendPrice({ duration, resolution, audio });
  const available = session && balance ? balance.availableCredits : null;
  const shortBy = available !== null && available < credits ? credits - available : 0;
  const ready = canSubmitExtend(choice);

  const submit = async () => {
    if (!source || inFlight.current) return;
    if (!ready) {
      setNotice(zh ? `说说接下来发生什么（至少 ${EXTEND_MIN_PROMPT} 个字）。` : `Say what happens next (at least ${EXTEND_MIN_PROMPT} characters).`);
      promptRef.current?.focus();
      return;
    }
    if (!session) {
      signIn.onOpen();
      return;
    }
    inFlight.current = true;
    setSubmitting(true);
    setNotice(null);
    try {
      const result = await submitExtend(source.videoUuid, choice, zh);
      if (!result.ok) {
        setNotice(result.message);
        if (result.needsLogin) signIn.onOpen();
        if (result.code === "INSUFFICIENT_CREDITS") shortfall.report(result.message, result.requiredCredits);
        return;
      }
      invalidate();
      void refetch();
      onStarted({ uuid: result.uuid, prompt: prompt.trim(), duration, credits });
      onClose();
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

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
          {zh ? "从这段视频的结尾接着往下生成，画面和动作自然衔接。" : "Continue from the end of this clip, picking up its look and motion."}
        </DialogDescription>

        {source ? (
          <div className="xd-source">
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
            <span className="xd-source-tag">
              <FastForward aria-hidden="true" />
              {zh ? "从这里接着往下" : "Continues from here"}
            </span>
          </div>
        ) : null}

        <label className="xd-field">
          <span className="xd-label">{zh ? "接下来发生什么" : "What happens next"}</span>
          <textarea
            ref={promptRef}
            value={prompt}
            maxLength={EXTEND_MAX_PROMPT}
            rows={3}
            placeholder={zh ? "例如：镜头慢慢拉远，她转身走进雨里" : "e.g. The camera pulls back as she turns and walks into the rain"}
            onChange={(event) => {
              setPrompt(event.target.value);
              if (notice) setNotice(null);
            }}
            onKeyDown={(event) => {
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
              value={duration}
              onChange={(event) => setDuration(Number(event.target.value))}
              aria-label={zh ? "续写时长（秒）" : "Seconds to add"}
            />
          </label>
          <button
            type="button"
            className="xd-sound"
            aria-pressed={audio}
            onClick={() => setAudio((value) => !value)}
          >
            {audio ? <Volume2 key="on" data-swap aria-hidden="true" /> : <VolumeX key="off" data-swap aria-hidden="true" />}
            {audio ? (zh ? "生成声音" : "With sound") : (zh ? "不要声音" : "No sound")}
          </button>
        </div>

        <div className="xd-field">
          <span className="xd-label">{zh ? "画质" : "Quality"}</span>
          <QualityPicker zh={zh} value={resolution} onChange={setResolution} />
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
      </DialogContent>
    </Dialog>
  );
}

/** Mounted with the dialog's content, so the sliding highlight measures the
 * buttons once they exist (the dialog renders its content only when open). */
function QualityPicker({ zh, value, onChange }: { zh: boolean; value: string; onChange: (next: string) => void }) {
  const ref = useSegmentIndicator<HTMLDivElement>(value);
  return (
    <div ref={ref} className="xd-seg du-seg" aria-label={zh ? "画质" : "Quality"}>
      {EXTEND_RESOLUTIONS.map((item) => (
        <button
          key={item}
          type="button"
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
