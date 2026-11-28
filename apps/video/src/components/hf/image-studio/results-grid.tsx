"use client";

// Results above the creation bar: a masonry wall or an even grid of square
// tiles, optionally split by day, at one of four card sizes (view-menu).
import { Clapperboard, Paintbrush, RotateCcw } from "lucide-react";
import type { MediaJob } from "@/lib/media-studio";
import { generationDetails } from "@/lib/generation-details";
import { CopyPromptButton, DownloadLink, PendingCard, markReady, readyRef } from "@/components/hf/studio-results";
import type { ImageView } from "./view-menu";

function dayLabel(at: number | undefined, zh: boolean): string {
  if (!at) return zh ? "更早" : "Earlier";
  const day = new Date(at);
  const today = new Date();
  const start = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((start(today) - start(day)) / 86_400_000);
  if (diff === 0) return zh ? "今天" : "Today";
  if (diff === 1) return zh ? "昨天" : "Yesterday";
  return day.toLocaleDateString(zh ? "zh-CN" : "en-US", {
    month: zh ? "numeric" : "short",
    day: "numeric",
    ...(day.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}

export function ResultsGrid({
  jobs,
  view,
  zh,
  modelName,
  onOpen,
  onReuse,
  onCanvas,
  onVideo,
}: {
  jobs: MediaJob[];
  view: ImageView;
  zh: boolean;
  modelName: (id?: string) => string;
  /** Opens the viewer at this image ("uuid-index"). */
  onOpen: (key: string) => void;
  onReuse: (prompt: string) => void;
  onCanvas: (url: string, prompt: string, model: string, uuid?: string, index?: number) => void;
  onVideo: (url: string) => void;
}) {
  const groups: { label: string; jobs: MediaJob[] }[] = [];
  if (view.byDate) {
    for (const job of jobs) {
      const label = dayLabel(job.createdAt, zh);
      const group = groups.find((item) => item.label === label);
      if (group) group.jobs.push(job);
      else groups.push({ label, jobs: [job] });
    }
  } else {
    groups.push({ label: "", jobs });
  }

  const cards = (list: MediaJob[]) =>
    list.map((job) =>
      job.status === "completed" && job.urls.length > 0 ? (
        job.urls.map((url, index) => {
          const key = `${job.uuid}-${index}`;
          const model = modelName(job.model);
          const details = generationDetails("image", model, job.parameters, zh);
          return (
            <figure key={key} className="sr-card is-result">
              <img ref={readyRef} onLoad={markReady} onError={markReady} src={url} alt={job.prompt} loading="lazy" />
              <button type="button" className="sr-card-open" aria-label={zh ? "查看大图" : "Open image"} onClick={() => onOpen(key)} />
              <span className="sr-card-shade" aria-hidden="true" />
              <span className="sr-card-top">
                <CopyPromptButton prompt={job.prompt} zh={zh} />
                <DownloadLink url={url} zh={zh} />
              </span>
              <span className="sr-card-bottom">
                <span className="sr-card-text">
                  <span className="sr-card-prompt">{job.prompt}</span>
                  <span className="sr-card-settings" title={details.map(({ label, value }) => `${label}: ${value}`).join(" · ")}>
                    {details.map(({ value }) => value).join(" · ")}
                  </span>
                </span>
                <button type="button" className="sr-icon" title={zh ? "复用提示词" : "Reuse prompt"} aria-label={zh ? "复用提示词" : "Reuse prompt"} onClick={() => onReuse(job.prompt)}>
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className="sr-icon" title={zh ? "在无限画布中局部重绘 / 扩图" : "Edit in Infinite Canvas"} aria-label={zh ? "在无限画布中编辑" : "Edit in Infinite Canvas"} onClick={() => onCanvas(url, job.prompt, model, job.uuid, index)}>
                  <Paintbrush className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" className="sr-icon" title={zh ? "用这张图生成视频" : "Make a video from this"} aria-label={zh ? "用这张图生成视频" : "Make a video from this"} onClick={() => onVideo(url)}>
                  <Clapperboard className="h-4 w-4" aria-hidden="true" />
                </button>
              </span>
            </figure>
          );
        })
      ) : (
        <PendingCard
          key={job.uuid}
          className="is-result is-result-wait ds-shimmer"
          status={job.status === "completed" ? "failed" : job.status}
          since={job.createdAt}
          prompt={job.prompt}
          message={job.status === "completed" ? (zh ? "没有返回图片" : "No image came back") : job.message}
          zh={zh}
          onReuse={() => onReuse(job.prompt)}
        />
      ),
    );

  return (
    <section className="is-results" data-layout={view.layout} data-size={view.size} aria-label={zh ? "生成结果" : "Results"}>
      {groups.map((group) => (
        <div key={group.label || "all"} className="is-group">
          {group.label ? <h2 className="is-group-title">{group.label}</h2> : null}
          <div className="is-wall">{cards(group.jobs)}</div>
        </div>
      ))}
    </section>
  );
}
