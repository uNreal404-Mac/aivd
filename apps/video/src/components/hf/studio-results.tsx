"use client";

// Result pieces shared by the video, image and audio studios: the card shown
// while a job runs, the full-screen viewer, the waveform player and the
// drag-and-drop / paste hook for uploads.
import { failureReason } from "@/lib/failure-reason";
import { generationDetails } from "@/lib/generation-details";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronLeft, ChevronRight, Clapperboard, Copy, Download, Pause, Play, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import "./studio-results.css";

/** Result media fades in once it has something to show, instead of popping
 * in over an empty box. `readyRef` covers media already loaded (from cache)
 * before React attached the handler; an error also counts as ready, so a
 * broken file is visible rather than invisible. */
export function markReady(event: { currentTarget: HTMLElement }) {
  event.currentTarget.dataset.ready = "";
}

export function readyRef(element: HTMLImageElement | HTMLVideoElement | null) {
  if (!element) return;
  const ready = element instanceof HTMLImageElement ? element.complete : element.readyState >= 1;
  if (ready) element.dataset.ready = "";
}

/* -------------------------------------------------------------------------- */
/* Elapsed time and the card shown while a job runs                           */
/* -------------------------------------------------------------------------- */

function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Ticks once a second while the job is running. */
function useElapsed(since: number | undefined, running: boolean): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running || !since) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running, since]);
  return since ? formatElapsed(now - since) : null;
}

export function PendingCard({
  status,
  since,
  prompt,
  message,
  zh,
  className = "",
  onReuse,
}: {
  status: "submitting" | "queued" | "generating" | "failed" | "completed";
  since?: number;
  prompt?: string | null;
  message?: string | null;
  zh: boolean;
  className?: string;
  onReuse?: () => void;
}) {
  const failed = status === "failed";
  const elapsed = useElapsed(since, !failed);
  const label = failed
    ? zh
      ? "生成失败，积分已退回"
      : "Failed, credits returned"
    : status === "submitting"
      ? zh
        ? "生成中 · 正在提交"
        : "Generating · Submitting"
    : status === "generating"
      ? zh
        ? "生成中"
        : "Generating"
      : zh
        ? "生成中 · 排队中"
        : "Generating · Queued";
  return (
    <div className={`sr-pending ${failed ? "sr-pending-failed" : ""} ${className}`} title={prompt ?? undefined}>
      {failed ? null : <span className="sr-shimmer" aria-hidden="true" />}
      <span className="sr-pending-body">
        <span className="sr-pending-status">
          {failed ? <X className="h-4 w-4" aria-hidden="true" /> : <span className="sr-dot" aria-hidden="true" />}
          {label}
          {!failed && elapsed ? <span className="sr-elapsed">{elapsed}</span> : null}
        </span>
        {prompt ? <span className="sr-pending-prompt">{prompt}</span> : null}
        {failed && failureReason(message, zh) ? <span className="sr-pending-msg">{failureReason(message, zh)}</span> : null}
        {failed && onReuse ? (
          <button type="button" className="sr-pill" onClick={onReuse}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {zh ? "用这个提示词重试" : "Try this prompt again"}
          </button>
        ) : null}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hover actions on a result card                                             */
/* -------------------------------------------------------------------------- */

export function CopyPromptButton({
  prompt,
  zh,
  className = "sr-icon",
  label,
}: {
  prompt: string;
  zh: boolean;
  className?: string;
  /** Tooltip and accessible name; defaults to "Copy prompt". */
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const name = label ?? (zh ? "复制提示词" : "Copy prompt");
  return (
    <button
      type="button"
      className={className}
      title={copied ? (zh ? "已复制" : "Copied") : name}
      aria-label={name}
      onClick={async (event) => {
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(prompt);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <Check key="done" data-swap className="h-4 w-4" aria-hidden="true" /> : <Copy key="copy" data-swap className="h-4 w-4" aria-hidden="true" />}
      {className.includes("sr-pill") ? (copied ? (zh ? "已复制" : "Copied") : zh ? "复制提示词" : "Copy prompt") : null}
    </button>
  );
}

export function DownloadLink({ url, zh, className = "sr-icon", label = false }: { url: string; zh: boolean; className?: string; label?: boolean }) {
  return (
    <a
      href={url}
      download
      target="_blank"
      rel="noreferrer"
      className={className}
      title={zh ? "下载" : "Download"}
      aria-label={zh ? "下载" : "Download"}
      onClick={(event) => event.stopPropagation()}
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      {label ? (zh ? "下载" : "Download") : null}
    </a>
  );
}

/* -------------------------------------------------------------------------- */
/* Full-screen viewer                                                         */
/* -------------------------------------------------------------------------- */

export type ViewerItem = {
  key: string;
  url: string;
  kind: "image" | "video";
  prompt: string;
  model?: string;
  modelId?: string;
  parameters?: import("@/lib/generation-details").GenerationParameters | null;
};

export function MediaViewer({
  items,
  index,
  zh,
  onIndex,
  onClose,
  onReuse,
  onReuseParameters,
  onToVideo,
}: {
  items: ViewerItem[];
  index: number;
  zh: boolean;
  onIndex: (index: number) => void;
  onClose: () => void;
  onReuse?: (item: ViewerItem) => void;
  onReuseParameters?: (item: ViewerItem) => void;
  onToVideo?: (item: ViewerItem) => void;
}) {
  const item = items[index];
  const closeRef = useRef<HTMLButtonElement>(null);
  const count = items.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && count > 1) onIndex((index + 1) % count);
      if (event.key === "ArrowLeft" && count > 1) onIndex((index - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, count, onClose, onIndex]);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  if (!item || typeof document === "undefined") return null;

  return createPortal(
    <dialog open className="sr-viewer" aria-modal="true" aria-label={zh ? "查看作品" : "View result"}>
      <button type="button" className="sr-viewer-scrim" aria-label={zh ? "关闭" : "Close"} onClick={onClose} tabIndex={-1} />
      <div className="sr-viewer-stage">
        {item.kind === "video" ? (
          <video key={item.key} src={item.url} controls autoPlay loop playsInline className="sr-viewer-media" />
        ) : (
          <img key={item.key} src={item.url} alt={item.prompt} className="sr-viewer-media" />
        )}
        {count > 1 ? (
          <>
            <button type="button" className="sr-viewer-nav sr-viewer-prev" aria-label={zh ? "上一个" : "Previous"} onClick={() => onIndex((index - 1 + count) % count)}>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" className="sr-viewer-nav sr-viewer-next" aria-label={zh ? "下一个" : "Next"} onClick={() => onIndex((index + 1) % count)}>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>
      <aside className="sr-viewer-side">
        <div className="sr-viewer-head">
          <span className="sr-viewer-count">
            {index + 1} / {count}
          </span>
          <button ref={closeRef} type="button" className="sr-icon" aria-label={zh ? "关闭" : "Close"} onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <span className="sr-viewer-label">{zh ? "提示词" : "Prompt"}</span>
        <p className="sr-viewer-prompt">{item.prompt || (zh ? "（无提示词）" : "(no prompt)")}</p>
        {generationDetails(item.kind, item.model, item.parameters, zh).length ? (
          <section className="sr-viewer-settings" aria-label={zh ? "生成参数" : "Generation settings"}>
            <span className="sr-viewer-label">{zh ? "生成参数" : "Generation settings"}</span>
            <dl>
              {generationDetails(item.kind, item.model, item.parameters, zh).map(({ label, value }) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </section>
        ) : null}
        <div className="sr-viewer-actions">
          {onReuse ? (
            <button
              type="button"
              className="sr-pill sr-pill-accent"
              onClick={() => {
                onReuse(item);
                onClose();
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {zh ? "复用提示词" : "Reuse prompt"}
            </button>
          ) : null}
          {onReuseParameters && (item.modelId || (item.parameters && Object.keys(item.parameters).length > 0)) ? (
            <button
              type="button"
              className="sr-pill"
              title={zh ? "复用模型与生成设置" : "Reuse model and generation settings"}
              onClick={() => {
                onReuseParameters(item);
                onClose();
              }}
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
              {zh ? "复用参数" : "Reuse settings"}
            </button>
          ) : null}
          {onToVideo && item.kind === "image" ? (
            <button type="button" className="sr-pill" onClick={() => onToVideo(item)}>
              <Clapperboard className="h-4 w-4" aria-hidden="true" />
              {zh ? "生成视频" : "Make a video"}
            </button>
          ) : null}
          {item.prompt ? <CopyPromptButton prompt={item.prompt} zh={zh} className="sr-pill" /> : null}
          <DownloadLink url={item.url} zh={zh} className="sr-pill" label />
        </div>
        <p className="sr-viewer-keys">{zh ? "← → 切换 · Esc 关闭" : "← → to browse · Esc to close"}</p>
      </aside>
    </dialog>,
    document.body,
  );
}

/* -------------------------------------------------------------------------- */
/* Waveform player for audio results                                          */
/* -------------------------------------------------------------------------- */

const BARS = 64;

/** Placeholder bar heights from the URL, until the real peaks are decoded. */
function seededBars(seed: string): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  return Array.from({ length: BARS }, (_, i) => {
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    const noise = ((hash >>> 0) % 1000) / 1000;
    const envelope = 0.55 + 0.45 * Math.sin((i / BARS) * Math.PI);
    return 0.18 + 0.82 * noise * envelope;
  });
}

/** Peak per bar from the decoded audio; null when it cannot be read. */
async function decodePeaks(url: string): Promise<number[] | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();
    const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Context) return null;
    const context = new Context();
    const audio = await context.decodeAudioData(buffer);
    void context.close();
    const data = audio.getChannelData(0);
    const size = Math.floor(data.length / BARS) || 1;
    const peaks = Array.from({ length: BARS }, (_, bar) => {
      let peak = 0;
      for (let i = bar * size; i < Math.min(data.length, (bar + 1) * size); i += 32) peak = Math.max(peak, Math.abs(data[i]));
      return peak;
    });
    const top = Math.max(...peaks) || 1;
    return peaks.map((value) => 0.12 + 0.88 * (value / top));
  } catch {
    return null;
  }
}

export function WaveformPlayer({ url, zh }: { url: string; zh: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const placeholder = useMemo(() => seededBars(url), [url]);
  const [bars, setBars] = useState<number[] | null>(null);
  const decoded = useRef(false);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play();
      // Read the real waveform once the user starts listening.
      if (!decoded.current) {
        decoded.current = true;
        void decodePeaks(url).then((peaks) => peaks && setBars(peaks));
      }
    } else {
      audio.pause();
    }
  }, [url]);

  const seek = (ratio: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(Math.max(ratio, 0), 1) * audio.duration;
  };

  const shown = bars ?? placeholder;
  return (
    <div className="sr-wave">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
        }}
      />
      <button type="button" className="sr-wave-play" aria-label={playing ? (zh ? "暂停" : "Pause") : zh ? "播放" : "Play"} onClick={toggle}>
        {playing ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
      </button>
      <div
        className="sr-wave-bars"
        role="slider"
        tabIndex={0}
        aria-label={zh ? "播放进度" : "Playback position"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          seek((event.clientX - rect.left) / rect.width);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowRight") seek(progress + 0.05);
          if (event.key === "ArrowLeft") seek(progress - 0.05);
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            toggle();
          }
        }}
      >
        {shown.map((height, index) => (
          <span
            key={index}
            className={index / BARS < progress ? "sr-bar sr-bar-on" : "sr-bar"}
            style={{ transform: `scaleY(${Math.max(0.06, height).toFixed(3)})` }}
          />
        ))}
      </div>
      <span className="sr-wave-time">
        {formatElapsed(progress * duration * 1000)} / {duration ? formatElapsed(duration * 1000) : "--:--"}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Drag and drop / paste for uploads                                          */
/* -------------------------------------------------------------------------- */

/** Accept image files dropped on an element or pasted while it has focus. */
export function useImageDrop(onFiles: (files: File[]) => void, enabled = true, accept = (type: string) => type.startsWith("image/")) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const pick = (list: FileList | DataTransferItemList | null | undefined): File[] => {
    if (!list) return [];
    const files: File[] = [];
    for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
      const file = entry instanceof File ? entry : entry.kind === "file" ? entry.getAsFile() : null;
      if (file && accept(file.type)) files.push(file);
    }
    return files;
  };
  const hasFiles = (event: React.DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

  return {
    over,
    bind: {
      onDragEnter: (event: React.DragEvent) => {
        if (!enabled || !hasFiles(event)) return;
        event.preventDefault();
        depth.current += 1;
        setOver(true);
      },
      onDragOver: (event: React.DragEvent) => {
        if (!enabled || !hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setOver(false);
      },
      onDrop: (event: React.DragEvent) => {
        if (!enabled || !hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setOver(false);
        const files = pick(event.dataTransfer.files);
        if (files.length) onFiles(files);
      },
      onPaste: (event: React.ClipboardEvent) => {
        if (!enabled) return;
        const files = pick(event.clipboardData?.items);
        if (files.length) {
          event.preventDefault();
          onFiles(files);
        }
      },
    },
  };
}

/** Hand an image result to the video studio as its start frame. */
export function sendImageToVideo(url: string, href: string, name: string, userId?: string) {
  if (userId) sessionStorage.setItem("aivd:home-start-image-owner", userId);
  else sessionStorage.removeItem("aivd:home-start-image-owner");
  sessionStorage.setItem("aivd:home-start-image", url);
  sessionStorage.setItem("aivd:home-start-image-name", name);
  sessionStorage.setItem("aivd:home-start-image-preview", url);
  window.location.assign(href);
}
