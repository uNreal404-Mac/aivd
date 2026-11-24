"use client";

import { useMemo, useRef, useState } from "react";
import { AudioLines, BookOpen, Check, ChevronRight, Folder, LayoutGrid, ListFilter, Music, Paintbrush, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { getMarketModel } from "@/ai/kie-market";
import type { MediaJob } from "@/lib/media-studio";
import { localizedHref } from "@/lib/locale-path";
import { useSegmentIndicator } from "@/hooks/use-segment-indicator";
import { CopyPromptButton, DownloadLink, PendingCard, WaveformPlayer } from "@/components/hf/studio-results";
import { AUDIO_SHOWCASE, type AudioKind, type AudioShowcaseItem, audioKindOf, type Mode } from "./audio-data";
import { AudioPopover } from "./audio-popover";

export type StageTab = "history" | "how";
type Filter = "all" | AudioKind;

/** A row in the first how-it-works card: a voice to hear and pick, or a style to apply. */
export type HowPick = { key: string; title: string; sub: string; voiceName?: string; on: boolean; onPick: () => void };

export function AudioStage({
  zh,
  locale,
  mode,
  tab,
  onTab,
  jobs,
  signedOut,
  onSignIn,
  onReuse,
  playingDemoId,
  onPreviewShowcase,
  onRecreate,
  how,
  previewingVoice,
  onPreviewVoice,
}: {
  zh: boolean;
  locale: string;
  mode: Mode;
  tab: StageTab;
  onTab: (tab: StageTab) => void;
  jobs: MediaJob[];
  signedOut: boolean;
  onSignIn: () => void;
  onReuse: (text: string) => void;
  playingDemoId: string | null;
  onPreviewShowcase: (item: AudioShowcaseItem) => void;
  onRecreate: (item: AudioShowcaseItem) => void;
  how: {
    title: string;
    sub: string;
    card1: string;
    card1Sub: string;
    picks: HowPick[];
    card2: string;
    card2Sub: string;
    demo: string;
  };
  previewingVoice: string | null;
  onPreviewVoice: (name: string) => void;
}) {
  const tabsRef = useSegmentIndicator<HTMLDivElement>(tab);
  const [filter, setFilter] = useState<Filter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLButtonElement>(null);
  const shown = useMemo(() => (filter === "all" ? jobs : jobs.filter((job) => audioKindOf(job.model) === filter)), [jobs, filter]);
  const filters: { id: Filter; label: string; icon: typeof AudioLines }[] = [
    { id: "all", label: zh ? "全部" : "All", icon: LayoutGrid },
    { id: "speech", label: zh ? "语音" : "Speech", icon: AudioLines },
    { id: "music", label: zh ? "音乐" : "Music", icon: Music },
    { id: "sfx", label: zh ? "音效" : "Sound effects", icon: Sparkles },
  ];
  const showFilter = tab === "history" && jobs.length > 0;

  return (
    <section aria-label={zh ? "历史记录与工作原理" : "History and how it works"} className="au-stage">
      <div className="au-stage-bar">
        <div ref={tabsRef} role="tablist" aria-label={zh ? "视图" : "View"} className="au-stage-tabs du-seg">
          <button type="button" role="tab" aria-selected={tab === "history"} className="au-stage-tab" onClick={() => onTab("history")}>
            <Folder className="h-3.5 w-3.5" aria-hidden="true" />
            {zh ? "历史记录" : "History"}
            {jobs.length > 0 ? (
              <span className="au-stage-count" data-num="">
                {jobs.length}
              </span>
            ) : null}
          </button>
          <button type="button" role="tab" aria-selected={tab === "how"} className="au-stage-tab" onClick={() => onTab("how")}>
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {zh ? "工作原理" : "How it works"}
          </button>
        </div>
        {showFilter ? (
          <>
            <button
              ref={filterRef}
              type="button"
              className={filter === "all" ? "au-filter" : "au-filter au-filter-on"}
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <ListFilter className="h-3.5 w-3.5" aria-hidden="true" />
              {filter === "all" ? (zh ? "筛选" : "Filter") : filters.find((item) => item.id === filter)?.label}
            </button>
            <AudioPopover
              open={filterOpen}
              onClose={() => setFilterOpen(false)}
              anchorRef={filterRef}
              label={zh ? "筛选历史记录" : "Filter history"}
              placement="below-end"
              width={250}
              className="au-pop-menu"
            >
              <p className="au-pop-head">{zh ? "类型" : "Type"}</p>
              <div className="au-pop-list">
                {filters.map((item) => {
                  const Icon = item.icon;
                  const on = filter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={on}
                      className="au-menu-row"
                      onClick={() => {
                        setFilter(item.id);
                        setFilterOpen(false);
                        filterRef.current?.focus();
                      }}
                    >
                      <Icon className="h-4 w-4 text-[var(--ds-text-3)]" aria-hidden="true" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {on ? <Check className="h-4 w-4 du-check-pop" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            </AudioPopover>
          </>
        ) : null}
      </div>

      <div className="au-stage-body">
        {tab === "how" ? (
          <HowItWorks zh={zh} mode={mode} how={how} previewingVoice={previewingVoice} onPreviewVoice={onPreviewVoice} onReuse={onReuse} />
        ) : jobs.length === 0 ? (
          <div className="au-empty">
            <div className="au-empty-head">
              <span className="au-empty-icon" aria-hidden="true">
                <AudioLines className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="au-empty-title">
                  {signedOut
                    ? zh ? "登录后，生成的音频会保存在这里" : "Sign in and your audio is kept here"
                    : zh ? "还没有生成过音频" : "No audio yet"}
                </h2>
                <p className="au-empty-sub">
                  {zh
                    ? "先听听下面的示例：点封面试听，点「做同款」把模型、音色和文案填到左侧。"
                    : "Start from a sample: play a cover to hear it, or Recreate to load its model, voice and script on the left."}
                </p>
              </div>
              {signedOut ? (
                <button type="button" className="au-empty-signin" onClick={onSignIn}>
                  {zh ? "登录" : "Sign in"}
                </button>
              ) : null}
            </div>

            <div className="au-show-grid" aria-label={zh ? "可试听的示例" : "Samples you can play"}>
              {AUDIO_SHOWCASE.map((item) => {
                const playing = playingDemoId === item.id;
                return (
                  <article key={item.id} className={playing ? "au-show au-show-on" : "au-show"}>
                    <button
                      type="button"
                      className="au-show-cover"
                      aria-label={playing ? (zh ? `停止试听 ${item.titleZh}` : `Stop ${item.titleEn}`) : zh ? `试听 ${item.titleZh}` : `Play ${item.titleEn}`}
                      onClick={() => onPreviewShowcase(item)}
                    >
                      <img src={item.cover} alt="" loading="lazy" />
                      <span className="au-show-play">
                        {playing ? <Square key="stop" data-swap="" className="h-3.5 w-3.5" /> : <Play key="play" data-swap="" className="h-3.5 w-3.5" />}
                      </span>
                    </button>
                    <div className="au-show-body">
                      <span className="au-show-tag">{zh ? item.tagZh : item.tagEn}</span>
                      <h3 className="au-show-title">{zh ? item.titleZh : item.titleEn}</h3>
                      <p className="au-show-script">{zh ? item.scriptZh : item.scriptEn}</p>
                      <div className="au-show-foot">
                        <button type="button" className="au-pill" onClick={() => onPreviewShowcase(item)}>
                          {playing ? <Square className="h-3 w-3" aria-hidden="true" /> : <Play className="h-3 w-3" aria-hidden="true" />}
                          {playing ? (zh ? "停止" : "Stop") : zh ? "试听" : "Play"}
                        </button>
                        <button type="button" className="au-pill" onClick={() => onRecreate(item)}>
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          {zh ? "做同款" : "Recreate"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <a href={localizedHref(locale, "/creative-space/canvas")} className="au-canvas-link">
              <span className="min-w-0 flex-1">
                <strong>{zh ? "要给视频镜头配音或加背景音乐？" : "Adding voiceover or music to video shots?"}</strong>
                <span>{zh ? "去无限画布，把图片、视频镜头和音频连在一起编排" : "Open Infinite Canvas to line up images, video clips and audio"}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        ) : shown.length === 0 ? (
          <div className="au-none">
            <p>{zh ? "这一类还没有作品" : "Nothing of this kind yet"}</p>
            <button type="button" className="au-pill" onClick={() => setFilter("all")}>
              {zh ? "显示全部" : "Show all"}
            </button>
          </div>
        ) : (
          <div className="au-list">
            {shown.map((job) => {
              const done = job.status === "completed" && job.urls.length > 0;
              const modelLabel = getMarketModel(job.model)?.name ?? job.model;
              return (
                <div key={job.uuid} className="au-item">
                  <div className="au-item-head">
                    <span className="au-item-model">{modelLabel}</span>
                    <span className="au-item-prompt" title={job.prompt}>
                      {job.prompt}
                    </span>
                    {done ? (
                      <span className="au-item-tools">
                        <CopyPromptButton prompt={job.prompt} zh={zh} />
                        <button type="button" className="sr-icon" title={zh ? "复用文本" : "Reuse text"} aria-label={zh ? "复用文本" : "Reuse text"} onClick={() => onReuse(job.prompt)}>
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="sr-icon"
                          title={zh ? "发送到无限画布编排" : "Send to Infinite Canvas"}
                          aria-label={zh ? "发送到无限画布" : "Send to Infinite Canvas"}
                          onClick={() => {
                            try {
                              sessionStorage.setItem("aivd:canvas-handoff", JSON.stringify({ kind: "audio", url: job.urls[0], prompt: job.prompt, model: modelLabel }));
                            } catch {
                              // Ignore storage errors.
                            }
                            window.location.assign(localizedHref(locale, "/creative-space/canvas"));
                          }}
                        >
                          <Paintbrush className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                  </div>
                  {done ? (
                    job.urls.map((url, index) => (
                      <div key={`${job.uuid}-${index}`} className="au-item-player">
                        <WaveformPlayer url={url} zh={zh} />
                        <DownloadLink url={url} zh={zh} className="au-item-dl" />
                      </div>
                    ))
                  ) : (
                    <PendingCard
                      className="au-pending"
                      status={job.status === "completed" ? "failed" : job.status}
                      since={job.createdAt}
                      message={job.status === "completed" ? (zh ? "没有返回音频" : "No audio came back") : job.message}
                      zh={zh}
                      onReuse={() => onReuse(job.prompt)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function HowItWorks({
  zh,
  mode,
  how,
  previewingVoice,
  onPreviewVoice,
  onReuse,
}: {
  zh: boolean;
  mode: Mode;
  how: { title: string; sub: string; card1: string; card1Sub: string; picks: HowPick[]; card2: string; card2Sub: string; demo: string };
  previewingVoice: string | null;
  onPreviewVoice: (name: string) => void;
  onReuse: (text: string) => void;
}) {
  return (
    <div className="au-how">
      <h2 className="au-how-title">{how.title}</h2>
      <p className="au-how-sub">{how.sub}</p>
      <div className="au-how-cards">
        <div className="au-how-card">
          <h3 className="au-how-card-title">{how.card1}</h3>
          <p className="au-how-card-sub">{how.card1Sub}</p>
          <div className="au-how-media">
            <img src={mode === "music" ? "/home/samples/rain-couple.webp" : "/home/samples/studio-room.webp"} alt="" loading="lazy" />
            <div className="au-how-float au-how-picks">
              {how.picks.map((pick) => {
                const playing = pick.voiceName !== undefined && previewingVoice === pick.voiceName;
                return (
                  <div key={pick.key} className="au-opt-wrap">
                    <button type="button" aria-pressed={pick.on} className="au-opt au-opt-voice" onClick={pick.onPick}>
                      <span className="au-opt-tile au-opt-avatar" aria-hidden="true">
                        {pick.voiceName ? pick.voiceName.slice(0, 1) : <Music className="h-4 w-4" />}
                      </span>
                      <span className="au-opt-text">
                        <span className="au-opt-name">{pick.title}</span>
                        <span className="au-opt-sub">{pick.sub}</span>
                      </span>
                      {pick.on ? <Check className="au-opt-check du-check-pop" aria-hidden="true" /> : null}
                    </button>
                    {pick.voiceName ? (
                      <button
                        type="button"
                        className={playing ? "au-play au-play-on" : "au-play"}
                        aria-label={playing ? (zh ? `停止试听 ${pick.voiceName}` : `Stop ${pick.voiceName}`) : zh ? `试听 ${pick.voiceName}` : `Preview ${pick.voiceName}`}
                        onClick={() => onPreviewVoice(pick.voiceName as string)}
                      >
                        {playing ? <Square key="stop" data-swap="" className="h-3 w-3" aria-hidden="true" /> : <Play key="play" data-swap="" className="h-3 w-3" aria-hidden="true" />}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="au-how-card">
          <h3 className="au-how-card-title">{how.card2}</h3>
          <p className="au-how-card-sub">{how.card2Sub}</p>
          <div className="au-how-media">
            <img src={mode === "music" ? "/home/samples/cosmic-bloom.webp" : "/home/samples/mountain-valley.webp"} alt="" loading="lazy" />
            <div className="au-how-float au-how-compose">
              <span className="au-how-compose-label">{mode === "music" ? (zh ? "描述" : "Description") : zh ? "脚本" : "Script"}</span>
              <p className="au-how-compose-text">{how.demo}</p>
              <span className="au-how-wave" aria-hidden="true">
                {WAVE.map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </span>
              <button type="button" className="au-how-try" onClick={() => onReuse(how.demo)}>
                {zh ? "填入这段示例" : "Use this sample"}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const WAVE = [28, 46, 64, 38, 72, 90, 58, 34, 52, 80, 66, 40, 24, 48, 70, 86, 62, 36, 54, 78, 44, 30, 56, 74, 50, 32, 42, 60, 36, 22];

