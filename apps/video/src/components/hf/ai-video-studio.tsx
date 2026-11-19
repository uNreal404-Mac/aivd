"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useSigninModal } from "@/hooks/use-signin-modal";
import { errorMessage } from "@/lib/media-studio";
import {
  AtSign,
  BookOpen,
  ChevronRight,
  Clapperboard,
  Clock,
  Film,
  ImagePlus,
  Pencil,
  Play,
  RotateCcw,
  Sparkles,
  Wand2,
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
import { VIDEO_CATALOG } from "@/lib/kie-model-catalog";
import { getMarketModel } from "@/ai/kie-market";
import { findNavModel } from "@/lib/nav-models";
import { VIDEO_PRESETS, findVideoPreset } from "@/lib/video-presets";
import { HOME_TEMPLATES } from "@/lib/home-templates";
import { StateBlock } from "@/components/states/state-block";
import { InViewVideo } from "@/components/hf/in-view-video";
import {
  CopyPromptButton,
  DownloadLink,
  MediaViewer,
  PendingCard,
  useImageDrop,
  type ViewerItem,
} from "@/components/hf/studio-results";
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
  upcomingModel,
}: {
  generationEnabled: boolean;
  initialSettings?: StudioSettings;
  locale: string;
  availableModelIds: string[];
  initialCatalogModelId?: string;
  /** A model picked from the nav that is not connected or catalogued yet. */
  upcomingModel?: { name: string; desc: string };
}) {
  const isChinese = locale.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  const copy = isChinese
    ? {
        modes: { Create: "创建视频", Edit: "编辑视频" } as Record<string, string>,
        tabs: { History: "历史记录", Library: "灵感库", "How it works": "工作原理" } as Record<string, string>,
        soon: "即将上线",
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
  // Models from the catalogue open selected even when they cannot generate
  // yet, so a click in the nav lands on that model, as on the reference.
  const [catalogModelId, setCatalogModelId] = useState(() =>
    initialCatalogModelId && VIDEO_CATALOG.some((item) => item.id === initialCatalogModelId)
      ? initialCatalogModelId
      : settings.modelId,
  );
  const [upcoming, setUpcoming] = useState(upcomingModel);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
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
  const selectedModelConnected = !upcoming && availableModelIds.includes(catalogModelId);
  const catalogEntry = VIDEO_CATALOG.find((item) => item.id === catalogModelId);
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
    setPreview(sessionStorage.getItem("aivd:home-start-image-preview"));
    sessionStorage.removeItem("aivd:home-start-image");
    sessionStorage.removeItem("aivd:home-start-image-name");
    sessionStorage.removeItem("aivd:home-start-image-preview");
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
      // Returning users see their clips first, not the introduction.
      setActiveTab((tab) => (tab === "How it works" ? RIGHT_TABS[0] : tab));
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
        setNotice(errorMessage(result.code, result.message, isChinese));
        // Signed out: open sign-in and come back to this studio with the
        // prompt and settings still filled in.
        if (result.code === "UNAUTHORIZED") {
          const params = new URLSearchParams({
            prompt: settings.prompt.trim(),
            model: catalogModelId,
            duration: String(settings.duration),
            aspect: settings.aspect,
            resolution: settings.resolution,
            audio: String(settings.audio),
          });
          signIn.onOpenWithRedirect(`${window.location.pathname}?${params}`);
        }
        return;
      }

      setResults((previous) => [
        {
          id: result.videoUuid ?? result.taskId ?? `clip-${previous.length + 1}`,
          status: "queued",
          videoUuid: result.videoUuid,
          prompt: settings.prompt.trim(),
          createdAt: Date.now(),
        },
        ...previous,
      ]);
      setNotice(null);
      setActiveTab(RIGHT_TABS[0]);
    } finally {
      setSubmitting(false);
    }
  }

  const coverModelId = selectedModelConnected ? catalogModelId : "";
  const bannerName = upcoming?.name ?? (selectedModelConnected ? model.name : (catalogEntry?.name ?? model.name));
  const navEntry = findNavModel("video", catalogModelId);
  const bannerSub =
    upcoming?.desc ??
    (selectedModelConnected
      ? (copy.modelTaglines[model.id] ?? (model.tagline || (navEntry ? (isChinese ? navEntry.desc.zh : navEntry.desc.en) : "")))
      : (catalogEntry?.detail ?? ""));
  // Some models (Grok Imagine 1.5 on KIE) only run from a start image.
  const needsStartImage = Boolean(getMarketModel(catalogModelId)?.options.requiresImage) && !imageKey;
  const cover = MODEL_COVERS[coverModelId] ?? "/home/samples/cosmic-bloom.webp";
  // Shortcut label: ⌘ on Apple keyboards, Ctrl elsewhere. Decided after mount
  // so the server render and the first client render agree.
  const [isMac, setIsMac] = useState(true);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);
  const generateDisabled =
    promptEmpty || submitting || uploading || availableModels.length === 0 || !selectedModelConnected || needsStartImage;
  const stepCopy = isChinese
    ? [
        { title: "添加图片", body: "上传一张起始帧，或者只写提示词，从零开始生成。" },
        { title: "选择预设", body: "挑一个镜头预设，控制画面的运动方式。" },
        { title: "获取视频", body: "点击生成，完成后在历史记录里播放和下载。" },
      ]
    : [
        { title: "Add an image", body: "Upload a start frame, or just write a prompt and start from scratch." },
        { title: "Pick a preset", body: "Choose a camera preset to control how the shot moves." },
        { title: "Get the video", body: "Hit generate, then play and download it from history." },
      ];

  async function uploadStartFrame(file: File) {
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
      setPreview(URL.createObjectURL(file));
    } else {
      setNotice(result.message);
    }
  }
  const drop = useImageDrop((files) => void uploadStartFrame(files[0]), !uploading && mode === "Create");

  const reuse = (text: string | null | undefined) => {
    if (!text) return;
    setSettings((previous) => ({ ...previous, prompt: text }));
    promptRef.current?.focus();
  };

  const gallery = useMemo<ViewerItem[]>(
    () =>
      results
        .filter((item) => item.status === "completed" && item.videoUrl)
        .map((item) => ({ key: item.id, url: item.videoUrl as string, kind: "video" as const, prompt: item.prompt ?? "" })),
    [results],
  );
  const activePreset = findVideoPreset(settings.preset);

  return (
    <div className="vs-root" {...(mode === "Create" ? { onPaste: drop.bind.onPaste } : {})}>
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
                <span className="vs-banner-title">{bannerName}</span>
                <span className="vs-banner-sub">{bannerSub}</span>
              </span>
            </button>

            <label
              className={`vs-upload sr-drop ${drop.over ? "sr-drop-on" : ""} ${preview ? "vs-upload-has" : ""}`}
              data-drop-label={isChinese ? "松开即可上传起始帧" : "Drop to upload the start frame"}
              onDragEnter={drop.bind.onDragEnter}
              onDragOver={drop.bind.onDragOver}
              onDragLeave={drop.bind.onDragLeave}
              onDrop={drop.bind.onDrop}
            >
              {preview ? (
                <img src={preview} alt="" className="vs-upload-preview" />
              ) : (
                <span className="vs-upload-icons" aria-hidden="true">
                  <span><ImagePlus className="h-4 w-4" /></span>
                  <span><Film className="h-4 w-4" /></span>
                  <span><Sparkles className="h-4 w-4" /></span>
                </span>
              )}
              <span className="vs-upload-title">{fileName ?? (isChinese ? "上传起始帧" : "Upload a start frame")}</span>
              <span className="vs-upload-sub">
                {uploading
                  ? isChinese ? "上传中…" : "Uploading…"
                  : preview
                    ? isChinese ? "点击更换，或拖入新图片" : "Click to replace, or drop a new image"
                    : isChinese ? `拖入、粘贴或点击上传 · ${copy.fileTypes} · 可选` : `Drop, paste or click · ${copy.fileTypes} · optional`}
              </span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadStartFrame(file);
                }}
              />
            </label>
            {imageKey ? (
              <button type="button" onClick={() => { setImageKey(null); setFileName(null); setPreview(null); }} className="vs-link">
                {isChinese ? "移除起始帧" : "Remove start frame"}
              </button>
            ) : null}

            <div className="vs-card vs-prompt">
              <label htmlFor="studio-prompt" className="vs-prompt-label">{copy.prompt}</label>
              <textarea
                id="studio-prompt"
                ref={promptRef}
                value={settings.prompt}
                maxLength={PROMPT_MAX_LENGTH}
                placeholder={copy.promptPlaceholder}
                onChange={(event) => setSettings((previous) => ({ ...previous, prompt: event.target.value }))}
                onKeyDown={(event) => {
                  // ⌘/Ctrl+Enter generates, the same shortcut as the image studio.
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !generateDisabled) {
                    event.preventDefault();
                    void handleGenerate();
                  }
                }}
              />
              <div className="vs-prompt-foot">
                <button
                  type="button"
                  className={activePreset ? "vs-chip vs-chip-on" : "vs-chip"}
                  aria-expanded={presetsOpen}
                  aria-controls="studio-presets"
                  onClick={() => setPresetsOpen((open) => !open)}
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden="true" />
                  {activePreset ? (isChinese ? activePreset.zh : activePreset.en) : copy.preset}
                </button>
                <span className="vs-chip vs-chip-static" title={copy.soon}>
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
                <span className="vs-count">
                  <kbd className="vs-kbd" title={isChinese ? "按 ⌘/Ctrl + Enter 生成" : "Press ⌘/Ctrl + Enter to generate"}>
                    {isMac ? "⌘" : "Ctrl"} ↵
                  </kbd>
                  {settings.prompt.length}/{PROMPT_MAX_LENGTH}
                </span>
              </div>
            </div>

            {settings.preset && !activePreset ? (
              <span className="vs-chip w-fit">
                {copy.preset}: {settings.preset}
                <button type="button" aria-label={copy.clearPreset} onClick={() => setSettings((previous) => ({ ...previous, preset: undefined }))}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ) : null}

            {presetsOpen ? (
              <section id="studio-presets" className="vs-presets" aria-label={isChinese ? "镜头预设" : "Camera presets"}>
                <div className="vs-presets-head">
                  <span>{isChinese ? "镜头预设" : "Camera presets"}</span>
                  {activePreset ? (
                    <button type="button" className="vs-link" onClick={() => setSettings((previous) => ({ ...previous, preset: undefined }))}>
                      {copy.clearPreset}
                    </button>
                  ) : null}
                </div>
                <div className="vs-presets-grid">
                  {VIDEO_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={settings.preset === preset.id}
                      className={settings.preset === preset.id ? "vs-preset vs-preset-on" : "vs-preset"}
                      title={preset.prompt}
                      onClick={() => {
                        setSettings((previous) => ({ ...previous, preset: previous.preset === preset.id ? undefined : preset.id }));
                        setPresetsOpen(false);
                      }}
                    >
                      <span className={`vs-preset-media vs-move-${preset.motion}`}>
                        <img src={preset.image} alt="" loading="lazy" />
                      </span>
                      <span className="vs-preset-name">{isChinese ? preset.zh : preset.en}</span>
                    </button>
                  ))}
                </div>
                <p className="vs-presets-note">
                  {isChinese ? "选中的运镜会自动加到提示词后面，所有模型都能用。" : "The camera move is added to your prompt, so it works with every model."}
                </p>
              </section>
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
              valueLabel={upcoming?.name}
              onChange={(id) => {
                setUpcoming(undefined);
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
                {selectedModelConnected ? exampleCredits : copy.soon}
              </span>
            </button>
            {needsStartImage ? (
              <output className="vs-notice">
                {isChinese ? `${bannerName} 需要先上传一张起始帧。` : `${bannerName} needs a start frame. Upload one above.`}
              </output>
            ) : null}
            {selectedModelConnected ? null : (
              <output className="vs-notice">
                {isChinese
                  ? `${bannerName} 即将上线。现在可以用 ${availableModels.map((item) => item.name).join(" 或 ")} 生成。`
                  : `${bannerName} is coming soon. You can generate with ${availableModels.map((item) => item.name).join(" or ")} today.`}
              </output>
            )}

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
              <InViewVideo src="/home/hero-marina-loop.mp4" poster="/home/hero-marina-poster.webp" />
            </div>
          </div>
        ) : activeTab === "History" ? (
          results.length === 0 ? (
            <StateBlock
              icon={Clapperboard}
              title={isChinese ? "还没有生成过视频" : "No clips yet"}
              body={
                isChinese
                  ? "在左边写一句提示词再点生成，视频会出现在这里。没有头绪？试试下面的点子："
                  : "Write a prompt on the left and generate; your clips land here. Need an idea? Try one:"
              }
            >
              <div className="st-ideas">
                {HOME_TEMPLATES.slice(0, 4).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className="st-idea"
                    title={isChinese ? template.prompt.zh : template.prompt.en}
                    onClick={() => reuse(isChinese ? template.prompt.zh : template.prompt.en)}
                  >
                    <Sparkles aria-hidden="true" />
                    {isChinese ? template.title.zh : template.title.en}
                  </button>
                ))}
              </div>
            </StateBlock>
          ) : (
            <div className="vs-results">
              {results.map((result) => {
                if (result.status === "completed" && result.videoUrl) {
                  const position = gallery.findIndex((item) => item.key === result.id);
                  return (
                    <figure key={result.id} className="sr-card vs-result">
                      <video
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
                      <button type="button" className="sr-card-open" aria-label={isChinese ? "全屏播放" : "Play full screen"} onClick={() => setViewing(position)} />
                      <span className="sr-card-shade" aria-hidden="true" />
                      <span className="sr-card-top">
                        {result.prompt ? <CopyPromptButton prompt={result.prompt} zh={isChinese} /> : null}
                        <DownloadLink url={result.videoUrl} zh={isChinese} />
                      </span>
                      <span className="sr-card-bottom">
                        <span className="sr-card-prompt">{result.prompt}</span>
                        <button type="button" className="sr-icon" title={isChinese ? "复用提示词" : "Reuse prompt"} aria-label={isChinese ? "复用提示词" : "Reuse prompt"} onClick={() => reuse(result.prompt)}>
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </span>
                    </figure>
                  );
                }
                return (
                  <PendingCard
                    key={result.id}
                    className="vs-result"
                    status={result.status === "completed" ? "failed" : result.status}
                    since={result.createdAt}
                    prompt={result.prompt}
                    message={result.status === "completed" ? (isChinese ? "没有返回视频" : "No clip came back") : result.message}
                    zh={isChinese}
                    onReuse={result.prompt ? () => reuse(result.prompt) : undefined}
                  />
                );
              })}
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
            <ol className="vs-steps vs-steps-illus">
              {stepCopy.map((step, index) => (
                <li key={step.title} className="vs-step">
                  <div className="vs-illus" aria-hidden="true">
                    {index === 0 ? (
                      <div className="vs-illus-upload">
                        <span className="vs-illus-drop">
                          <ImagePlus />
                          {isChinese ? "上传图片" : "Upload an image"}
                          <small>{isChinese ? "拖入或点击上传" : "Drop or click"}</small>
                        </span>
                        <img src="/home/samples/rain-couple.webp" alt="" className="vs-illus-photo" />
                      </div>
                    ) : index === 1 ? (
                      <div className="vs-illus-presets">
                        {VIDEO_PRESETS.slice(0, 3).map((preset, position) => (
                          <span key={preset.id} className={position === 1 ? "vs-illus-preset vs-illus-preset-on" : "vs-illus-preset"}>
                            <img src={preset.image} alt="" />
                            <small>{isChinese ? preset.zh : preset.en}</small>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="vs-illus-result">
                        <img src="/home/hero-marina-poster.webp" alt="" />
                        <span className="vs-illus-play">
                          <Play />
                        </span>
                      </div>
                    )}
                  </div>
                  <h3 className="vs-step-title">{step.title}</h3>
                  <p className="vs-step-body">{step.body}</p>
                </li>
              ))}
            </ol>
            <a className="vs-help" href={`/${locale}/templates`}>
              <span className="vs-help-art" aria-hidden="true">
                <img src="/home/samples/autumn-walk.webp" alt="" />
                <img src="/home/samples/cosmic-bloom.webp" alt="" />
              </span>
              <span className="vs-help-text">
                <strong>{isChinese ? "不知道从哪里开始？" : "Not sure where to start?"}</strong>
                <span>{isChinese ? "从模板挑一个，提示词会自动填好" : "Pick a template and its prompt fills in"}</span>
              </span>
              <ChevronRight aria-hidden="true" />
            </a>
          </div>
        )}
      </section>
      {viewing !== null && gallery[viewing] ? (
        <MediaViewer
          items={gallery}
          index={viewing}
          zh={isChinese}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onReuse={(item) => reuse(item.prompt)}
        />
      ) : null}
    </div>
  );
}
