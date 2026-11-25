"use client";

import { Paintbrush, RotateCcw } from "lucide-react";
import type { StudioResult } from "@/lib/ai-video-studio";
import type { HistoryView } from "./history-tools";
import { CopyPromptButton, DownloadLink, PendingCard, markReady, readyRef, type ViewerItem } from "@/components/hf/studio-results";

/** Generated clips, newest first: playing on hover, open full screen on click,
 * with copy, download, reuse and "open in the canvas" on each. Laid out as
 * the View menu says: a grid or masonry, four card sizes, filled or fitted. */
export function ResultsGrid({
  zh,
  results,
  gallery,
  view,
  onView,
  onReuse,
  onCanvas,
}: {
  zh: boolean;
  results: StudioResult[];
  gallery: ViewerItem[];
  view: HistoryView;
  onView: (position: number) => void;
  onReuse: (prompt: string | null | undefined) => void;
  onCanvas: (result: StudioResult) => void;
}) {
  return (
    <div className="vst-results du-fade-swap" data-layout={view.layout} data-size={view.size} data-fit={view.fill ? undefined : true}>
      {results.map((result) => {
        if (result.status === "completed" && result.videoUrl) {
          const position = gallery.findIndex((item) => item.key === result.id);
          return (
            <figure key={result.id} className="sr-card vst-result">
              <video
                ref={readyRef}
                onLoadedMetadata={markReady}
                onError={markReady}
                src={result.videoUrl}
                muted
                loop
                playsInline
                preload="metadata"
                onMouseEnter={(event) => void event.currentTarget.play().catch(() => undefined)}
                onMouseLeave={(event) => {
                  event.currentTarget.pause();
                  event.currentTarget.currentTime = 0;
                }}
              />
              <button type="button" className="sr-card-open" aria-label={zh ? "全屏播放" : "Play full screen"} onClick={() => onView(position)} />
              <span className="sr-card-shade" aria-hidden="true" />
              <span className="sr-card-top">
                {result.prompt ? <CopyPromptButton prompt={result.prompt} zh={zh} /> : null}
                <DownloadLink url={result.videoUrl} zh={zh} />
              </span>
              <span className="sr-card-bottom">
                <span className="sr-card-prompt">{result.prompt}</span>
                <button type="button" className="sr-icon" title={zh ? "复用提示词" : "Reuse prompt"} aria-label={zh ? "复用提示词" : "Reuse prompt"} onClick={() => onReuse(result.prompt)}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="sr-icon"
                  title={zh ? "在无限画布中截帧 / 配音 / 编排" : "Open in Infinite Canvas"}
                  aria-label={zh ? "在无限画布中打开" : "Open in Infinite Canvas"}
                  onClick={() => onCanvas(result)}
                >
                  <Paintbrush className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </figure>
          );
        }
        return (
          <PendingCard
            key={result.id}
            className="vst-result ds-shimmer"
            status={result.status === "completed" ? "failed" : result.status}
            since={result.createdAt}
            prompt={result.prompt}
            message={result.status === "completed" ? (zh ? "没有返回视频" : "No clip came back") : result.message}
            zh={zh}
            onReuse={result.prompt ? () => onReuse(result.prompt) : undefined}
          />
        );
      })}
    </div>
  );
}
