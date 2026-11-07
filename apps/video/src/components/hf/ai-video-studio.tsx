"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Film,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import {
  RIGHT_TABS,
  STUDIO_MODELS,
  UNAVAILABLE_LABEL,
  canGenerate,
  defaultSettings,
  selectModel,
  submitGeneration,
} from "@/lib/ai-video-studio";
import type { StudioSettings } from "@/lib/ai-video-studio";
import { uploadImage, validateImageFile } from "@/lib/image-to-video";
import { GallerySection } from "@/components/gallery/gallery-section";

const MODES = ["Create", "Edit"] as const;

const TAB_ICONS = {
  History: Clock,
  Library: Film,
  "How it works": BookOpen,
} as const;

const PROMPT_MAX_LENGTH = 1500;
const EDIT_TOOLS = [
  { zh: "编辑视频", en: "Edit video", descZh: "精确修改视频中的区域", descEn: "Refine a selected part of a video" },
  { zh: "延长视频", en: "Extend video", descZh: "为片段生成后续画面", descEn: "Continue a clip with new footage" },
  { zh: "重构画幅", en: "Reframe", descZh: "调整尺寸与画面位置", descEn: "Adapt a clip to another aspect ratio" },
  { zh: "高清放大", en: "Upscale", descZh: "提高输出分辨率", descEn: "Increase output resolution" },
  { zh: "移除背景", en: "Remove background", descZh: "分离主体与背景", descEn: "Separate subject from background" },
  { zh: "帧率增强", en: "FPS boost", descZh: "提升播放流畅度", descEn: "Increase playback smoothness" },
];

const HOW_IT_WORKS = [
  {
    title: "Choose a model",
    body: "Each model trades speed, detail and sound differently. Pick the one that fits the shot.",
  },
  {
    title: "Describe the shot",
    body: "Write the subject, the motion, the camera move and the light. Add a start frame if you have one.",
  },
  {
    title: "Tune and generate",
    body: "Set length, ratio, resolution and audio, then generate. Clips collect on this page.",
  },
];

type ResultItem = {
  id: string;
  status: "queued" | "failed";
  videoUuid?: string | null;
  message?: string;
};

function chipClass(active: boolean, disabled = false): string {
  return [
    "rounded-[var(--hfv-radius-chip)] border px-3 py-1.5 text-xs transition-colors",
    active
      ? "border-[var(--hfv-chip-active-bg)] bg-[var(--hfv-chip-active-bg)] text-[var(--hfv-chip-active-text)]"
      : "border-[var(--hfv-border-strong)] bg-[var(--hfv-chip)] text-[var(--hfv-text)]",
    disabled ? "cursor-not-allowed opacity-60" : "hover:opacity-80",
  ].join(" ");
}

function ChipGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function AiVideoStudio({
  generationEnabled,
  initialSettings,
  locale,
  availableModelIds,
}: {
  generationEnabled: boolean;
  initialSettings?: StudioSettings;
  locale: string;
  availableModelIds: string[];
}) {
  const isChinese = locale.toLowerCase().startsWith("zh");
  const copy = isChinese
    ? {
        modes: { Create: "创建视频", Edit: "编辑视频" } as Record<string, string>,
        tabs: { History: "历史记录", Library: "灵感库", "How it works": "使用方法" } as Record<string, string>,
        soon: "即将开放",
        top: "热门",
        new: "新品",
        change: "更换",
        startFrame: "添加起始帧（可选）",
        fileTypes: "PNG、JPG 或 WebP",
        prompt: "提示词",
        promptPlaceholder: "描述镜头：主体、动作、镜头运动、光线……",
        preset: "预设",
        clearPreset: "清除预设",
        model: "模型",
        chooseModel: "选择模型",
        closePicker: "关闭模型选择器",
        unavailable: "暂不可用",
        duration: "时长",
        aspect: "画面比例",
        resolution: "分辨率",
        audio: "声音",
        on: "开启",
        off: "关闭",
        submit: "提交中…",
        generate: "生成",
        credits: "积分",
        settings: "视频设置",
        results: "生成结果",
        heroTitle: "掌控每一帧",
        heroBody: "选择模型、描述镜头，并调整时长、比例与声音。生成结果会显示在这里。",
        steps: [
          { title: "选择模型", body: "每个模型在速度、细节和声音上各有特点，请选择适合镜头的模型。" },
          { title: "描述镜头", body: "写清主体、动作、镜头运动和光线，也可以添加起始帧。" },
          { title: "调整并生成", body: "设置时长、比例、分辨率和声音，然后生成。视频会集中显示在此页面。" },
        ],
        empty: "还没有视频，你生成的内容会显示在这里。",
        queued: "排队中",
        paused: "生成功能正在完成配置，当前设置已保留在此页面。",
        modelTaglines: {
          "seedance-1.5-pro": "适合日常短片的快速、自然运动。",
          "wan2.6": "轻量高效，兼顾生成成本。",
          "veo-3.1": "丰富场景、同步声音与空间层次。",
          "sora-2": "富有想象力，适合醒目的创意画面。",
          "kling-3": "电影感细节与稳定自然的运动。",
        } as Record<string, string>,
      }
    : {
        modes: Object.fromEntries(MODES.map((item) => [item, item])) as Record<string, string>,
        tabs: Object.fromEntries(RIGHT_TABS.map((item) => [item, item])) as Record<string, string>,
        soon: "Soon",
        top: "Top",
        new: "New",
        change: "Change",
        startFrame: "Add a start frame (optional)",
        fileTypes: "PNG, JPG or WebP",
        prompt: "Prompt",
        promptPlaceholder: "Describe the shot: subject, motion, camera, light…",
        preset: "Preset",
        clearPreset: "Clear preset",
        model: "Model",
        chooseModel: "Choose a model",
        closePicker: "Close model picker",
        unavailable: "Unavailable",
        duration: "Duration",
        aspect: "Aspect",
        resolution: "Resolution",
        audio: "Audio",
        on: "On",
        off: "Off",
        submit: "Submitting…",
        generate: "Generate",
        credits: "credits",
        settings: "Video settings",
        results: "Results",
        heroTitle: "Direct every frame",
        heroBody: "Pick a model, write the shot, and tune length, ratio and sound. Your clips land here.",
        steps: HOW_IT_WORKS,
        empty: "No clips yet. Your generations will show up here.",
        queued: "queued",
        paused: "Generation is paused while we finish setup. Your settings are saved on this page.",
        modelTaglines: {} as Record<string, string>,
      };
  const availableModels = STUDIO_MODELS.filter((item) => item.available && availableModelIds.includes(item.id));
  const [settings, setSettings] = useState<StudioSettings>(() => {
    const initial = initialSettings ?? defaultSettings();
    return availableModelIds.includes(initial.modelId)
      ? initial
      : defaultSettings(availableModels[0]);
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<ResultItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(RIGHT_TABS[1]);
  const [mode, setMode] = useState<(typeof MODES)[number]>("Create");
  const [editTool, setEditTool] = useState(0);

  const model =
    STUDIO_MODELS.find((item) => item.id === settings.modelId) ??
    STUDIO_MODELS[0];

  const check = canGenerate(settings, generationEnabled);
  const promptEmpty = !check.ok && check.reason === "empty-prompt";

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickerOpen]);

  async function handleGenerate() {
    if (promptEmpty || submitting) {
      return;
    }

    if (!generationEnabled) {
      setNotice(
        copy.paused,
      );
      return;
    }

    setSubmitting(true);
    setNotice(null);

    const idempotencyKey =
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now());

    try {
      const result = await submitGeneration(settings, idempotencyKey, fetch, imageKey);

      if (!result.ok) {
        setNotice(result.message);
        return;
      }

      setResults((previous) => [
        {
          id: result.videoUuid ?? result.taskId ?? `clip-${previous.length + 1}`,
          status: "queued",
          videoUuid: result.videoUuid,
        },
        ...previous,
      ]);
      setNotice(null);
      setActiveTab(RIGHT_TABS[0]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-3 lg:h-[calc(100svh-52px)] lg:flex-row bg-[var(--hfv-bg)] text-[var(--hfv-text)]">
      <aside
        aria-label={copy.settings}
        className="flex flex-col gap-3 rounded-[var(--hfv-radius-panel)] border border-[var(--hfv-border)] bg-[var(--hfv-panel)] p-3 lg:w-[340px] lg:overflow-y-auto"
      >
        <div className="flex items-center gap-1">
          {MODES.map((option) => {
            const active = option === mode;

            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                onClick={() => setMode(option)}
                className={[
                  "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-[var(--hfv-text)] text-[var(--hfv-text)]"
                    : "border-[var(--hfv-border)] text-[var(--hfv-muted)]",
                ].join(" ")}
              >
                {copy.modes[option] ?? option}
              </button>
            );
          })}
        </div>

        {mode === "Create" ? <>
        <div className="relative h-[112px] overflow-hidden rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-3)] p-4">
          <img src="/home/hero-marina-poster.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent" />
          <div className="relative">
          <p className="font-display text-lg font-bold uppercase text-[var(--hfv-accent)]">
            {model.name}
          </p>
          <p className="mt-1 max-w-[72%] text-xs text-[var(--hfv-muted)]">
            {copy.modelTaglines[model.id] ?? model.tagline}
          </p>
          </div>
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="absolute right-3 top-3 rounded-[var(--hfv-radius-chip)] border border-[var(--hfv-border)] bg-[var(--hfv-panel)] px-2.5 py-1 text-[10px] uppercase tracking-wide text-[var(--hfv-text)]"
          >
            {copy.change}
          </button>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-[var(--hfv-radius-card)] border border-dashed border-[var(--hfv-border-strong)] bg-[var(--hfv-panel-2)] px-4 py-5 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--hfv-chip-bg)] text-[var(--hfv-muted)]">
            <Upload className="h-4 w-4" aria-hidden="true" />
          </span>
          <span className="max-w-[11rem] text-sm font-bold leading-tight">
            {copy.startFrame}
          </span>
          <span className="text-xs text-[var(--hfv-muted)]">
            {copy.fileTypes}
          </span>
          {fileName ? (
            <span className="max-w-full truncate text-xs text-[var(--hfv-accent)]">
              {fileName}
            </span>
          ) : null}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const error = validateImageFile(file);
              if (error) { setNotice(error); return; }
              setUploading(true);
              setNotice(null);
              const result = await uploadImage(file);
              setUploading(false);
              if (result.ok) {
                setFileName(file.name);
                setImageKey(result.key);
              } else {
                setNotice(result.message);
              }
            }}
          />
        </label>
        {uploading ? <span className="text-xs text-[var(--hfv-muted)]">{isChinese ? "上传中…" : "Uploading…"}</span> : null}
        {imageKey ? <button type="button" onClick={() => { setImageKey(null); setFileName(null); }} className="text-left text-xs text-[var(--hfv-accent)]">{isChinese ? "移除起始帧" : "Remove start frame"}</button> : null}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="studio-prompt"
            className="text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]"
          >
            {copy.prompt}
          </label>
          <div className="relative">
            <textarea
              id="studio-prompt"
              value={settings.prompt}
              maxLength={PROMPT_MAX_LENGTH}
              placeholder={copy.promptPlaceholder}
              onChange={(event) =>
                setSettings((previous) => ({
                  ...previous,
                  prompt: event.target.value,
                }))
              }
              className="min-h-[112px] w-full resize-none rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-field)] px-3 py-3 pb-7 text-sm text-[var(--hfv-text)] outline-none placeholder:text-[var(--hfv-muted)]"
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-[var(--hfv-muted)]">
              {settings.prompt.length}/{PROMPT_MAX_LENGTH}
            </span>
          </div>
        </div>

        {settings.preset ? (
          <span className="flex w-fit items-center gap-1.5 rounded-[var(--hfv-radius-chip)] border border-[var(--hfv-border-strong)] bg-[var(--hfv-chip)] px-2.5 py-1 text-xs text-[var(--hfv-text)]">
            {copy.preset}: {settings.preset}
            <button
              type="button"
              aria-label={copy.clearPreset}
              onClick={() =>
                setSettings((previous) => ({
                  ...previous,
                  preset: undefined,
                }))
              }
              className="text-[var(--hfv-muted)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ) : null}

        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="flex flex-col gap-1.5 rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] px-3 py-2.5 text-left"
        >
          <span className="text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
            {copy.model}
          </span>
          <span className="flex w-full items-center gap-2">
            <span className="text-sm font-semibold">{model.name}</span>
            {model.badge ? (
              <span className="rounded-[var(--hfv-radius-chip)] bg-[var(--hfv-accent)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--hfv-accent-text)]">
                {model.badge}
              </span>
            ) : null}
            <ChevronRight
              className="ml-auto h-4 w-4 text-[var(--hfv-muted)]"
              aria-hidden="true"
            />
          </span>
        </button>

        {pickerOpen ? (
          <section
            aria-label={copy.chooseModel}
            className="rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] p-2"
          >
            <div className="flex items-center justify-between gap-2 px-1 pb-1.5">
              <span className="text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
                {copy.chooseModel}
              </span>
              <button
                type="button"
                aria-label={copy.closePicker}
                onClick={() => setPickerOpen(false)}
                className="rounded-[var(--hfv-radius-chip)] p-1 text-[var(--hfv-muted)]"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {availableModels.map((option) => {
                const selected = option.id === settings.modelId;
                const unavailable = !option.available;

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    aria-disabled={unavailable}
                    disabled={unavailable}
                    onClick={() => {
                      setSettings((previous) => selectModel(previous, option.id));
                      setPickerOpen(false);
                    }}
                    className={[
                      "flex items-start gap-2 rounded-[var(--hfv-radius-chip)] px-2.5 py-2 text-left transition-colors",
                      unavailable
                        ? "cursor-not-allowed opacity-50"
                        : selected
                          ? "bg-[var(--hfv-chip-active-bg)] text-[var(--hfv-chip-active-text)]"
                          : "text-[var(--hfv-text)] hover:bg-[var(--hfv-panel-3)]",
                    ].join(" ")}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold">
                          {option.name}
                        </span>
                        {unavailable ? (
                          <span className="rounded-[var(--hfv-radius-chip)] bg-[var(--hfv-chip-bg)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--hfv-muted)]">
                            {isChinese ? UNAVAILABLE_LABEL : copy.unavailable}
                          </span>
                        ) : option.badge ? (
                          <span className="rounded-[var(--hfv-radius-chip)] bg-[var(--hfv-accent)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--hfv-accent-text)]">
                            {option.badge === "Top" ? copy.top : copy.new}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={[
                          "text-xs",
                          selected
                            ? "text-[var(--hfv-chip-active-text)] opacity-80"
                            : "text-[var(--hfv-muted)]",
                        ].join(" ")}
                      >
                        {copy.modelTaglines[option.id] ?? option.tagline}
                      </span>
                    </span>
                    {selected ? (
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <ChipGroup label={copy.duration}>
          {model.durations.map((duration) => {
            const active = duration === settings.duration;

            return (
              <button
                key={duration}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, duration }))
                }
                className={chipClass(active)}
              >
                {duration}s
              </button>
            );
          })}
        </ChipGroup>

        <ChipGroup label={copy.aspect}>
          {model.aspects.map((aspect) => {
            const active = aspect === settings.aspect;

            return (
              <button
                key={aspect}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, aspect }))
                }
                className={chipClass(active)}
              >
                {aspect}
              </button>
            );
          })}
        </ChipGroup>

        <ChipGroup label={copy.resolution}>
          {model.resolutions.map((resolution) => {
            const active = resolution === settings.resolution;

            return (
              <button
                key={resolution}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, resolution }))
                }
                className={chipClass(active)}
              >
                {resolution}
              </button>
            );
          })}
        </ChipGroup>

        <ChipGroup label={copy.audio}>
          {(["On", "Off"] as const).map((option) => {
            const value = option === "On";
            const disabled = !model.audio;
            const active = disabled ? false : settings.audio === value;

            return (
              <button
                key={option}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() =>
                  setSettings((previous) => ({ ...previous, audio: value }))
                }
                className={chipClass(active, disabled)}
              >
                {option === "On" ? copy.on : copy.off}
              </button>
            );
          })}
        </ChipGroup>

        <button
          type="button"
          disabled={promptEmpty || submitting || uploading || availableModels.length === 0}
          onClick={handleGenerate}
          className={[
            "flex h-12 w-full items-center justify-between rounded-[var(--hfv-radius-btn)] bg-[var(--hfv-accent)] px-4 text-[var(--hfv-accent-text)]",
            promptEmpty || submitting || uploading || availableModels.length === 0 ? "cursor-not-allowed opacity-50" : "",
          ].join(" ")}
        >
          <span className="font-semibold">
            {submitting ? copy.submit : copy.generate}
          </span>
          <Sparkles className="h-4 w-4" aria-hidden="true" />
        </button>

        {notice ? (
          <output
            aria-live="polite"
            className="rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] px-3 py-2 text-xs text-[var(--hfv-muted)]"
          >
            {notice}
          </output>
        ) : null}
        </> : <div className="flex flex-col gap-3">
          <div className="relative h-[126px] overflow-hidden rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)]">
            <img src="/home/hero-marina-poster.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-55" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-3 left-4"><p className="font-display text-lg font-bold uppercase text-[var(--hfv-accent)]">{isChinese ? "编辑工具" : "Edit tools"}</p><p className="text-xs text-white/80">{isChinese ? "修饰、扩展并重新构想视频" : "Refine, extend and reshape your video"}</p></div>
          </div>
          <p className="text-xs text-[var(--hfv-muted)]">{isChinese ? "选择一个编辑工具，查看其用途。编辑生成接口尚未接入。" : "Choose an edit tool to see what it does. The editing API is not connected yet."}</p>
          {EDIT_TOOLS.map((tool, index) => <button key={tool.en} type="button" aria-pressed={editTool === index} onClick={() => setEditTool(index)} className={`flex items-center gap-3 rounded-[var(--hfv-radius-card)] border px-4 py-3 text-left ${editTool === index ? "border-[var(--hfv-accent)] bg-[var(--hfv-panel-3)]" : "border-[var(--hfv-border)] bg-[var(--hfv-panel-2)]"}`}>
            <Film size={18} className="shrink-0 text-[var(--hfv-muted)]" /><span className="flex-1"><span className="block text-sm font-medium">{isChinese ? tool.zh : tool.en}</span><span className="block text-xs text-[var(--hfv-muted)]">{isChinese ? tool.descZh : tool.descEn}</span></span><ChevronRight size={16} className="text-[var(--hfv-muted)]" />
          </button>)}
          <div className="rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] p-4 text-sm text-[var(--hfv-muted)]">{isChinese ? "视频编辑功能待接入模型接口。创建视频仍可在“创建视频”中使用。" : "Video editing awaits a model API. You can still generate clips in Create video."}</div>
        </div>}
      </aside>

      <section
        aria-label={copy.results}
        className="flex-1 overflow-y-auto rounded-[var(--hfv-radius-panel)] border border-[var(--hfv-border)] bg-[var(--hfv-panel)] p-4"
      >
        {mode === "Edit" ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-5 py-6 text-center">
            <div className="w-full max-w-[850px] overflow-hidden rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-3)]">
              <video src="/home/hero-marina-loop.mp4" poster="/home/hero-marina-poster.png" autoPlay muted loop playsInline preload="metadata" className="aspect-video w-full object-cover" />
            </div>
            <h2 className="font-display text-3xl font-bold uppercase text-[var(--hfv-text)] md:text-5xl">
              {isChinese ? EDIT_TOOLS[editTool].zh : EDIT_TOOLS[editTool].en}
            </h2>
            <p className="max-w-lg text-sm text-[var(--hfv-muted)]">
              {isChinese ? EDIT_TOOLS[editTool].descZh : EDIT_TOOLS[editTool].descEn}
              {isChinese ? "。编辑模型接口待接入。" : ". The editing model API is coming soon."}
            </p>
          </div>
        ) : <>
        <div className="flex flex-wrap items-center gap-1.5">
          {RIGHT_TABS.map((tab) => {
            const active = tab === activeTab;
            const Icon = TAB_ICONS[tab];

            return (
              <button
                key={tab}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveTab(tab)}
                className={[
                  "flex items-center gap-1.5 rounded-[var(--hfv-radius-chip)] px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "bg-[var(--hfv-chip-bg)] text-[var(--hfv-text)]"
                    : "text-[var(--hfv-muted)]",
                ].join(" ")}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.tabs[tab] ?? tab}
              </button>
            );
          })}
        </div>

        <div className="grid items-center gap-6 py-8 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[40px] font-bold uppercase leading-none text-[var(--hfv-text)]">
              {copy.heroTitle}
            </h2>
            <p className="text-sm text-[var(--hfv-muted)]">
              {copy.heroBody}
            </p>
          </div>
          <div className="aspect-video overflow-hidden rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-3)]">
            <video src="/home/hero-marina-loop.mp4" poster="/home/hero-marina-poster.png" autoPlay muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
          </div>
        </div>

        <div className="pt-4">
          {activeTab === "Library" ? (
            <GallerySection />
          ) : null}

          {activeTab === "How it works" ? (
            <div className="grid gap-3 md:grid-cols-3">
              {copy.steps.map((step, index) => (
                <div
                  key={step.title}
                  className="flex flex-col gap-2 rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)] p-4"
                >
                  <span className="font-display text-2xl font-bold uppercase text-[var(--hfv-accent)]">
                    {index + 1}
                  </span>
                  <span className="text-sm font-semibold">{step.title}</span>
                  <span className="text-xs text-[var(--hfv-muted)]">
                    {step.body}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "History" ? (
            results.length === 0 ? (
              <p className="py-10 text-center text-sm text-[var(--hfv-muted)]">
                {copy.empty}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="flex aspect-video flex-col items-center justify-center gap-2 rounded-[var(--hfv-radius-card)] border border-[var(--hfv-border)] bg-[var(--hfv-panel-2)]"
                  >
                    <Clock
                      className="h-5 w-5 text-[var(--hfv-muted)]"
                      aria-hidden="true"
                    />
                    <span className="text-xs uppercase tracking-wide text-[var(--hfv-muted)]">
                      {result.status === "queued" ? copy.queued : result.status}
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : null}
        </div>
        </>}
      </section>
    </div>
  );
}
