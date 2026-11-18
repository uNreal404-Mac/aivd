"use client";

import { useEffect, useRef, useState } from "react";
import {
  AtSign,
  BookOpen,
  ChevronRight,
  Clock,
  Film,
  ImagePlus,
  Pencil,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  RESULT_POLL_INTERVAL_MS,
  RIGHT_TABS,
  STUDIO_MODELS,
  applyResultStatus,
  canGenerate,
  defaultSettings,
  estimateCredits,
  fetchRecentResults,
  fetchResultStatus,
  isResultPending,
  mergeResults,
  selectModel,
  submitGeneration,
} from "@/lib/ai-video-studio";
import type { StudioResult, StudioSettings } from "@/lib/ai-video-studio";
import { uploadImage, validateImageFile } from "@/lib/image-to-video";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import "./ai-video-studio.css";

const MODES = ["Create", "Edit"] as const;

const TAB_ICONS = {
  History: Clock,
  Library: Film,
  "How it works": BookOpen,
} as const;
// The reference shows only history and how-it-works next to the stage.
const STAGE_TABS = RIGHT_TABS.filter((tab) => tab !== "Library");

// Cover art for the model banner at the top of the settings panel.
const MODEL_COVERS: Record<string, string> = {
  "veo-3.1": "/home/samples/mountain-valley.webp",
  "wan2.6": "/home/samples/storm-sea.webp",
};

const STEP_IMAGES = ["/home/samples/boy-and-dog.webp", "/home/samples/dancer.webp", "/home/samples/rain-couple.webp"];

/** A settings card: small label, current value and a chevron. A native select
 *  sits on top so it stays keyboard and screen-reader friendly. */
function SelectCard<T extends string | number>({
  id,
  label,
  value,
  options,
  format,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  format?: (option: T) => string;
  onChange: (option: T) => void;
  disabled?: boolean;
}) {
  const show = format ?? ((option: T) => String(option));
  return (
    <label htmlFor={id} className={`vs-card vs-select ${disabled ? "vs-card-off" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="vs-card-label">{label}</span>
        <span className="vs-card-value">{show(value)}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--hfv-muted)]" aria-hidden="true" />
      <select
        id={id}
        value={String(value)}
        disabled={disabled}
        onChange={(event) => {
          const next = options.find((option) => String(option) === event.target.value);
          if (next !== undefined) onChange(next);
        }}
      >
        {options.map((option) => (
          <option key={String(option)} value={String(option)}>
            {show(option)}
          </option>
        ))}
      </select>
    </label>
  );
}

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


export function AiVideoStudio({
  generationEnabled,
  initialSettings,
  locale,
  availableModelIds,
  initialCatalogModelId,
}: {
  generationEnabled: boolean;
  initialSettings?: StudioSettings;
  locale: string;
  availableModelIds: string[];
  initialCatalogModelId?: string;
}) {
  const isChinese = locale.toLowerCase().startsWith("zh");
  const copy = isChinese
    ? {
        modes: { Create: "创建视频", Edit: "编辑视频" } as Record<string, string>,
        tabs: { History: "历史记录", Library: "灵感库", "How it works": "工作原理" } as Record<string, string>,
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
        creditEstimate: "预计消耗积分 · 示例",
        creditEstimateNote: "示例估算，实际消耗以正式计费规则为准。",
        creditCost: "本次消耗积分",
        creditCostNote: "提交时冻结这些积分，生成失败会退回。",
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
        generating: "生成中",
        failed: "生成失败",
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
        creditEstimate: "Estimated credits · example",
        creditEstimateNote: "Example estimate only. Actual credits follow the published pricing.",
        creditCost: "Credits for this clip",
        creditCostNote: "Held when you submit and returned if generation fails.",
        settings: "Video settings",
        results: "Results",
        heroTitle: "Direct every frame",
        heroBody: "Pick a model, write the shot, and tune length, ratio and sound. Your clips land here.",
        steps: HOW_IT_WORKS,
        empty: "No clips yet. Your generations will show up here.",
        queued: "queued",
        generating: "generating",
        failed: "failed",
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
  // Start on a model that can generate: the one in the URL when it is on sale,
  // otherwise whatever the settings resolved to.
  const [catalogModelId, setCatalogModelId] = useState(() =>
    initialCatalogModelId && availableModelIds.includes(initialCatalogModelId)
      ? initialCatalogModelId
      : settings.modelId,
  );
  const [fileName, setFileName] = useState<string | null>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("How it works");
  const [mode, setMode] = useState<(typeof MODES)[number]>("Create");
  const [editTool, setEditTool] = useState(0);

  const model =
    STUDIO_MODELS.find((item) => item.id === settings.modelId) ??
    STUDIO_MODELS[0];
  const selectedModelConnected = availableModelIds.includes(catalogModelId);
  const durationOptions = selectedModelConnected
    ? model.durations
    : [4, 5, 6, 7, 8, 9, 10, 11, 12];
  const durationIndex = Math.max(0, durationOptions.indexOf(settings.duration));
  const exampleCredits = selectedModelConnected
    ? estimateCredits(settings)
    : Math.ceil(settings.duration * 5 * (settings.resolution === "1080p" ? 1.5 : settings.resolution === "720p" ? 1.25 : 1));

  const check = canGenerate(settings, generationEnabled);
  const promptEmpty = !check.ok && check.reason === "empty-prompt";

  useEffect(() => {
    const key = sessionStorage.getItem("aivd:home-start-image");
    if (!key) return;
    setImageKey(key);
    setFileName(sessionStorage.getItem("aivd:home-start-image-name"));
    sessionStorage.removeItem("aivd:home-start-image");
    sessionStorage.removeItem("aivd:home-start-image-name");
  }, []);

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

  // Show earlier generations so a reload does not lose clips in progress.
  useEffect(() => {
    let cancelled = false;
    fetchRecentResults().then((history) => {
      if (cancelled || history.length === 0) return;
      setResults((previous) => mergeResults(previous, history));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll unfinished clips until they complete or fail. The timer is keyed on
  // the set of pending ids, so it stops by itself once nothing is pending.
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const pendingKey = results
    .filter(isResultPending)
    .map((item) => item.videoUuid)
    .join(",");

  useEffect(() => {
    if (!pendingKey) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (document.visibilityState !== "hidden") {
        const pending = resultsRef.current.filter(isResultPending);
        const updates = await Promise.all(
          pending.map(async (item) => ({
            uuid: item.videoUuid as string,
            update: await fetchResultStatus(item.videoUuid as string),
          })),
        );
        if (cancelled) return;
        setResults((previous) =>
          updates.reduce(
            (list, { uuid, update }) => applyResultStatus(list, uuid, update),
            previous,
          ),
        );
      }
      if (!cancelled) timer = setTimeout(tick, RESULT_POLL_INTERVAL_MS);
    };

    timer = setTimeout(tick, RESULT_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [pendingKey]);

  async function handleGenerate() {
    if (promptEmpty || submitting || !availableModelIds.includes(catalogModelId)) {
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
          prompt: settings.prompt.trim(),
        },
        ...previous,
      ]);
      setNotice(null);
      setActiveTab(RIGHT_TABS[0]);
    } finally {
      setSubmitting(false);
    }
  }

  const coverModelId = availableModelIds.includes(catalogModelId) ? catalogModelId : settings.modelId;
  const cover = MODEL_COVERS[coverModelId] ?? "/home/samples/cosmic-bloom.webp";
  const generateDisabled =
    promptEmpty || submitting || uploading || availableModels.length === 0 || !availableModelIds.includes(catalogModelId);
  const stepCopy = isChinese
    ? [
        { title: "添加图片", body: "上传一张起始帧，或者只写提示词，从零开始生成。" },
        { title: "选择模型", body: "挑一个模型，设置时长、画面比例、画质和声音。" },
        { title: "获取视频", body: "点击生成，完成后在历史记录里播放和下载。" },
      ]
    : [
        { title: "Add an image", body: "Upload a start frame, or just write a prompt and start from scratch." },
        { title: "Pick a model", body: "Choose a model and set length, ratio, quality and sound." },
        { title: "Get the video", body: "Hit generate, then play and download it from history." },
      ];

  return (
    <div className="vs-root">
      <aside aria-label={copy.settings} className="vs-panel">
        <div className="vs-modes" role="tablist">
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={option === mode}
              onClick={() => setMode(option)}
              className={option === mode ? "vs-mode vs-mode-on" : "vs-mode"}
            >
              {copy.modes[option] ?? option}
            </button>
          ))}
        </div>

        {mode === "Create" ? (
          <>
            <button type="button" className="vs-banner" onClick={() => setPickerOpen(true)} aria-label={copy.chooseModel}>
              <img src={cover} alt="" className="vs-banner-img" />
              <span className="vs-banner-shade" aria-hidden="true" />
              <span className="vs-banner-change">
                <Pencil className="h-3 w-3" aria-hidden="true" />
                {copy.change}
              </span>
              <span className="vs-banner-text">
                <span className="vs-banner-title">{model.name}</span>
                <span className="vs-banner-sub">{copy.modelTaglines[model.id] ?? model.tagline}</span>
              </span>
            </button>

            <label className="vs-upload">
              <span className="vs-upload-icons" aria-hidden="true">
                <span><ImagePlus className="h-4 w-4" /></span>
                <span><Film className="h-4 w-4" /></span>
                <span><Sparkles className="h-4 w-4" /></span>
              </span>
              <span className="vs-upload-title">{fileName ?? (isChinese ? "上传起始帧" : "Upload a start frame")}</span>
              <span className="vs-upload-sub">
                {uploading ? (isChinese ? "上传中…" : "Uploading…") : `${copy.fileTypes} · ${isChinese ? "可选" : "optional"}`}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const error = validateImageFile(file);
                  if (error) {
                    setNotice(error);
                    return;
                  }
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
            {imageKey ? (
              <button type="button" onClick={() => { setImageKey(null); setFileName(null); }} className="vs-link">
                {isChinese ? "移除起始帧" : "Remove start frame"}
              </button>
            ) : null}

            <div className="vs-card vs-prompt">
              <label htmlFor="studio-prompt" className="vs-prompt-label">{copy.prompt}</label>
              <textarea
                id="studio-prompt"
                value={settings.prompt}
                maxLength={PROMPT_MAX_LENGTH}
                placeholder={copy.promptPlaceholder}
                onChange={(event) => setSettings((previous) => ({ ...previous, prompt: event.target.value }))}
              />
              <div className="vs-prompt-foot">
                <span className="vs-chip vs-chip-static">
                  <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
                  {isChinese ? "元素" : "Elements"}
                </span>
                <button
                  type="button"
                  className="vs-chip"
                  disabled={!model.audio}
                  aria-pressed={model.audio && settings.audio}
                  onClick={() => setSettings((previous) => ({ ...previous, audio: !previous.audio }))}
                >
                  {model.audio && settings.audio ? <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> : <VolumeX className="h-3.5 w-3.5" aria-hidden="true" />}
                  {model.audio && settings.audio ? copy.on : copy.off}
                </button>
                <span className="vs-count">{settings.prompt.length}/{PROMPT_MAX_LENGTH}</span>
              </div>
            </div>

            {settings.preset ? (
              <span className="vs-chip w-fit">
                {copy.preset}: {settings.preset}
                <button type="button" aria-label={copy.clearPreset} onClick={() => setSettings((previous) => ({ ...previous, preset: undefined }))}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ) : null}

            <KieModelPicker
              kind="video"
              locale={locale}
              value={catalogModelId}
              connectedIds={availableModelIds}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              placement="card"
              label={copy.model}
              onChange={(id) => {
                setCatalogModelId(id);
                // The picker only offers models that can generate.
                setSettings((previous) => selectModel(previous, id));
              }}
            />

            <div className="vs-grid">
              <SelectCard
                id="studio-duration"
                label={copy.duration}
                value={settings.duration}
                options={durationOptions}
                format={(option) => `${option}s`}
                onChange={(duration) => setSettings((previous) => ({ ...previous, duration }))}
              />
              <SelectCard
                id="studio-aspect"
                label={copy.aspect}
                value={settings.aspect}
                options={model.aspects}
                onChange={(aspect) => setSettings((previous) => ({ ...previous, aspect }))}
              />
              <SelectCard
                id="studio-resolution"
                label={isChinese ? "画质" : "Quality"}
                value={settings.resolution}
                options={model.resolutions}
                onChange={(resolution) => setSettings((previous) => ({ ...previous, resolution }))}
              />
              <SelectCard
                id="studio-audio"
                label={copy.audio}
                value={model.audio && settings.audio ? "on" : "off"}
                options={["on", "off"] as const}
                format={(option) => (option === "on" ? copy.on : copy.off)}
                disabled={!model.audio}
                onChange={(option) => setSettings((previous) => ({ ...previous, audio: option === "on" }))}
              />
            </div>

            <button
              type="button"
              disabled={generateDisabled}
              onClick={handleGenerate}
              className="vs-generate"
              title={selectedModelConnected ? copy.creditCostNote : copy.creditEstimateNote}
            >
              {submitting ? copy.submit : copy.generate}
              <span className="vs-generate-cost">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {selectedModelConnected ? "" : "≈"}
                {exampleCredits}
              </span>
            </button>

            {notice ? <output aria-live="polite" className="vs-notice">{notice}</output> : null}
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="vs-hint">
              {isChinese ? "选择一个编辑工具查看用途。视频编辑接口尚未接入。" : "Pick an edit tool to see what it does. The editing API is not connected yet."}
            </p>
            {EDIT_TOOLS.map((tool, index) => (
              <button
                key={tool.en}
                type="button"
                aria-pressed={editTool === index}
                onClick={() => setEditTool(index)}
                className={editTool === index ? "vs-card vs-tool vs-tool-on" : "vs-card vs-tool"}
              >
                <span className="min-w-0 flex-1">
                  <span className="vs-card-value">{isChinese ? tool.zh : tool.en}</span>
                  <span className="vs-card-label">{isChinese ? tool.descZh : tool.descEn}</span>
                </span>
                <span className="vs-soon">{copy.soon}</span>
              </button>
            ))}
          </div>
        )}
      </aside>

      <section aria-label={copy.results} className="vs-stage">
        <div className="vs-stage-tabs">
          {STAGE_TABS.map((tab) => {
            const Icon = TAB_ICONS[tab];
            return (
              <button
                key={tab}
                type="button"
                aria-pressed={tab === activeTab}
                onClick={() => setActiveTab(tab)}
                className={tab === activeTab ? "vs-stage-tab vs-stage-tab-on" : "vs-stage-tab"}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.tabs[tab] ?? tab}
                {tab === "History" && results.length > 0 ? <span className="vs-stage-count">{results.length}</span> : null}
              </button>
            );
          })}
        </div>

        {mode === "Edit" ? (
          <div className="vs-howto">
            <h2 className="vs-howto-title">{isChinese ? EDIT_TOOLS[editTool].zh : EDIT_TOOLS[editTool].en}</h2>
            <p className="vs-howto-sub">
              {isChinese ? `${EDIT_TOOLS[editTool].descZh}。编辑模型接口待接入。` : `${EDIT_TOOLS[editTool].descEn}. The editing model API is coming soon.`}
            </p>
            <div className="vs-howto-media vs-howto-wide">
              <video src="/home/hero-marina-loop.mp4" poster="/home/hero-marina-poster.png" autoPlay muted loop playsInline preload="metadata" />
            </div>
          </div>
        ) : activeTab === "History" ? (
          results.length === 0 ? (
            <div className="vs-empty">
              <Clock className="h-6 w-6" aria-hidden="true" />
              <p>{copy.empty}</p>
            </div>
          ) : (
            <div className="vs-results">
              {results.map((result) =>
                result.status === "completed" && result.videoUrl ? (
                  <video
                    key={result.id}
                    src={result.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    title={result.prompt ?? undefined}
                    className="vs-result"
                  />
                ) : (
                  <div key={result.id} title={result.prompt ?? undefined} className="vs-result vs-result-wait">
                    {result.status === "failed" ? (
                      <X className="h-5 w-5" aria-hidden="true" />
                    ) : (
                      <Clock className={`h-5 w-5 ${result.status === "generating" ? "animate-pulse" : ""}`} aria-hidden="true" />
                    )}
                    <span>
                      {result.status === "failed" ? copy.failed : result.status === "generating" ? copy.generating : copy.queued}
                    </span>
                    {result.status === "failed" && result.message ? <span className="line-clamp-2 text-[11px]">{result.message}</span> : null}
                  </div>
                ),
              )}
            </div>
          )
        ) : (
          <div className="vs-howto">
            <h2 className="vs-howto-title">{isChinese ? "一键制作视频" : "Make a video in one click"}</h2>
            <p className="vs-howto-sub">
              {isChinese
                ? "写一句提示词或上传一张起始帧，选好模型就能生成，生成前就能看到要消耗的积分。"
                : "Write a prompt or upload a start frame, pick a model and generate. You see the credit cost before you start."}
            </p>
            <div className="vs-steps">
              {stepCopy.map((step, index) => (
                <div key={step.title} className="vs-step">
                  <div className="vs-howto-media">
                    <img src={STEP_IMAGES[index]} alt="" loading="lazy" />
                  </div>
                  <h3 className="vs-step-title">{step.title}</h3>
                  <p className="vs-step-body">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
