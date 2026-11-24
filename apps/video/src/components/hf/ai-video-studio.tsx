"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { localizedHref } from "@/lib/locale-path";

import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { useCreditReturnDraft } from "@/hooks/use-credit-return-draft";
import { currentUploadUrls } from "@/lib/home-media-library";
import { readyPickerImage, type PickerAsset } from "@/lib/home-media-library";
import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { EFFECT_TEMPLATES, labelFor } from "@/lib/effects-data";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import { errorMessage } from "@/lib/media-studio";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useCreditsStore } from "@/stores/credits-store";
import {
  AtSign,
  BookOpen,
  ChevronRight,
  Clapperboard,
  Clock,
  Film,
  ImagePlus,
  Paintbrush,
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
  bestAffordableModel,
  canGenerate,
  defaultSettings,
  estimateCredits,
  fetchRecentResults,
  fetchResultStatus,
  isResultPending,
  mergeResults,
  modelOptions,
  selectModel,
  submitGeneration,
} from "@/lib/ai-video-studio";
import type { StudioResult, StudioSettings } from "@/lib/ai-video-studio";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { VIDEO_CATALOG, catalogVideoDurations } from "@/lib/kie-model-catalog";
import { closestDuration, durationLabel } from "@/lib/video-durations";
import { useCatalogDetail } from "@/components/hf/use-catalog-detail";
import { getMarketModel } from "@/ai/kie-market";
import { findNavModel } from "@/lib/nav-models";
import { VIDEO_PRESETS, findVideoPreset } from "@/lib/video-presets";
import { maxVideoReferences, prepareVideoReferencePrompt, removeVideoReferenceToken, type UploadedVideoReference } from "@/lib/video-references";
import { InViewVideo } from "@/components/hf/in-view-video";
import { VideoPlayToggle } from "@/components/hf/video-play-toggle";
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
  "bytedance/seedance-2-5": "/home/samples/red-carpet.webp",
  "seedance-2-5-flash": "/home/samples/rain-couple.webp",
  "kling/v4-reference-to-video": "/home/samples/autumn-walk.webp",
  "kling/v4-flash-reference-to-video": "/home/samples/studio-room.webp",
  "wan/3-0-video": "/home/samples/storm-sea.webp",
};

// Living hover-play cinema showcase loops (real local MP4s + WebP posters)
const LIVING_SHOWCASE = [
  {
    id: "japan-rain",
    video: "/home/example-japan-6s.mp4",
    poster: "/home/example-japan-6s-poster.webp",
    aspect: "16:9",
    duration: "6s",
    titleZh: "东京深夜街头食光",
    titleEn: "Tokyo Late-Night Konbini",
    promptZh: "电影级手持慢推镜头，东京深夜便利店暖光与街头霓虹交织，近景呈现日系美食与温馨都市氛围，35mm 胶片质感",
    promptEn: "Cinematic handheld slow push-in through a warm late-night Tokyo convenience store glowing against neon city streets, 35mm film grain",
  },
  {
    id: "sky-dragon",
    video: "/home/example-dragon-full.mp4",
    poster: "/home/example-dragon-full-poster.webp",
    aspect: "16:9",
    duration: "8s",
    titleZh: "苍穹巨龙穿云",
    titleEn: "Sky Dragon Aerial",
    promptZh: "史诗级航拍环绕镜头，东方巨龙破开金色云海翱翔，鳞片在逆光中折射金属光泽，气势磅礴",
    promptEn: "Epic aerial orbiting shot of a majestic dragon soaring through golden storm clouds, sunlight catching iridescent scales, cinema scale",
  },
  {
    id: "samurai-cat",
    video: "/home/example-samurai-cat-7s.mp4",
    poster: "/home/example-samurai-cat-7s-poster.webp",
    aspect: "9:16",
    duration: "7s",
    titleZh: "武士猫电影特写",
    titleEn: "Samurai Cat Cinema",
    promptZh: "浅景深近景特写，身穿精致甲胄的武士猫站在飘落的樱花雨中缓缓拔刀，微风吹动披风，电影级布光",
    promptEn: "Shallow depth-of-field close-up of an armored samurai cat standing in drifting cherry blossoms, slowly drawing its katana, dramatic rim light",
  },
  {
    id: "origami-whale",
    video: "/home/example-whale-origami-7s.mp4",
    poster: "/home/example-whale-origami-7s-poster.webp",
    aspect: "16:9",
    duration: "7s",
    titleZh: "折纸鲸鱼奇境",
    titleEn: "Origami Whale Dream",
    promptZh: "梦幻微距跟拍，一只由发光折纸折成的巨鲸在深蓝云海中优雅游动，纸张纹理清晰，柔和体积光",
    promptEn: "Dreamlike tracking shot of a luminous origami whale gliding gracefully through a deep cobalt cloud sea, crisp paper folds, volumetric rays",
  },
  {
    id: "couture-silk",
    video: "/home/example-dress-10-20.mp4",
    poster: "/home/example-dress-10-20-poster.webp",
    aspect: "9:16",
    duration: "5s",
    titleZh: "高定丝绸时尚大片",
    titleEn: "Couture Silk Editorial",
    promptZh: "高级时装棚拍慢动作，流光丝绸礼服随风舒展飘动，暗调极简背景，轮廓光勾勒织物质感",
    promptEn: "High-fashion slow-motion editorial of flowing iridescent silk couture billowing in soft studio rim light against an obsidian backdrop",
  },
  {
    id: "macro-food",
    video: "/home/example-fried-chicken-22-29.mp4",
    poster: "/home/example-fried-chicken-22-29-poster.webp",
    aspect: "16:9",
    duration: "5s",
    titleZh: "电影级美食微距广告",
    titleEn: "Macro Food Commercial",
    promptZh: "高速升格微距商业广告镜头，金黄酥脆炸鸡热气升腾，辣椒粉与香料颗粒在慢动作中凌空洒落，诱人高光",
    promptEn: "High-speed macro commercial shot of crispy golden fried chicken with rising steam and spice dust falling in dramatic slow motion",
  },
] as const;


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
  fixedHint,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  format?: (option: T) => string;
  onChange: (option: T) => void;
  disabled?: boolean;
  /** Shown on hover when the model offers only this one value. */
  fixedHint?: string;
}) {
  const show = format ?? ((option: T) => String(option));
  // A single choice is not a choice: show it as a fixed value, not a dropdown.
  if (options.length <= 1 && !disabled) {
    return (
      <div className="vs-card vs-card-fixed" title={fixedHint}>
        <span className="min-w-0 flex-1">
          <span className="vs-card-label">{label}</span>
          <span className="vs-card-value">{show(value)}</span>
        </span>
      </div>
    );
  }
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
  // Keep the usual limit, while allowing a longer prompt supplied by a sample link to remain editable.
  const promptMaxLength = Math.max(PROMPT_MAX_LENGTH, initialSettings?.prompt.length ?? 0);
  const signIn = useSigninModal();
  // Signed-out visitors have history too, once they sign in; say so instead of "nothing yet".
  const { data: session, isPending: sessionLoading } = useSession();
  const signedOut = !sessionLoading && !session;
  const internalFree = process.env.NEXT_PUBLIC_IS_PREVIEW === "true" &&
    session?.user?.isAdmin === true && session.user.isSuperAccount === true;
  const canUseGeneration = generationEnabled || internalFree;
  const copy = isChinese
    ? {
        modes: { Create: "创建视频", Edit: "编辑视频" } as Record<string, string>,
        tabs: { History: "历史记录", Library: "灵感库", "How it works": "工作原理" } as Record<string, string>,
        soon: "即将上线",
        top: "热门",
        new: "新品",
        change: "更换",
        startFrame: "上传参考素材（可选）",
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
          { title: "描述镜头", body: "写清主体、动作、镜头运动和光线，并可用 @图片1 引用上传素材。" },
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
  const draft = usePromptDraft(
    "video",
    settings.prompt,
    (text) => setSettings((previous) => ({ ...previous, prompt: text })),
    Boolean(initialSettings?.prompt),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [durationOpen, setDurationOpen] = useState(false);
  const durationRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!durationOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!durationRef.current?.contains(event.target as Node)) setDurationOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [durationOpen]);
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
  const [homeReferences, setHomeReferences] = useState<UploadedVideoReference[]>([]);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const creditsShortfall = useCreditsShortfall(isChinese);
  // Signed in: the balance, so a clip it cannot pay for is caught before it
  // is sent and a model it can pay for is offered.
  const balance = useCreditsStore((state) => state.balance);
  const fetchBalance = useCreditsStore((state) => state.fetchBalance);
  useEffect(() => {
    if (session) void fetchBalance();
  }, [session, fetchBalance]);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("History");
  const [mode, setMode] = useState<(typeof MODES)[number]>("Create");
  const [editTool, setEditTool] = useState(0);

  const model =
    STUDIO_MODELS.find((item) => item.id === settings.modelId) ??
    STUDIO_MODELS[0];
  const selectedModelConnected = !upcoming && availableModelIds.includes(catalogModelId);
  const catalogEntry = VIDEO_CATALOG.find((item) => item.id === catalogModelId);
  const catalogDetail = useCatalogDetail();
  const durationOptions = STUDIO_MODELS.find((item) => item.id === catalogModelId)?.durations
    ?? catalogVideoDurations(catalogModelId);
  const durationMin = durationOptions[0] ?? settings.duration;
  const durationMax = durationOptions.at(-1) ?? settings.duration;
  const durationText = durationOptions.length
    ? `${settings.duration}s`
    : (isChinese ? "继承原片" : "Source clip");
  const durationSupported = durationOptions.includes(settings.duration);
  const exampleCredits = selectedModelConnected
    ? estimateCredits(settings)
    : Math.ceil(settings.duration * 5 * (settings.resolution === "1080p" ? 1.5 : settings.resolution === "720p" ? 1.25 : 1));

  const available = session && balance && !internalFree ? Math.max(0, balance.availableCredits) : null;
  const shortBy = available !== null && selectedModelConnected && durationSupported ? Math.max(0, exampleCredits - available) : 0;
  const referenceCount = homeReferences.length || (imageKey ? 1 : 0);
  const affordable = useMemo(() => {
    if (!shortBy || available === null) return undefined;
    // Only models this clip could run on: enough room for its images, and an
    // image when the model needs one.
    const usable = availableModelIds.filter(
      (id) => referenceCount <= maxVideoReferences(id) && !(getMarketModel(id)?.options.requiresImage && referenceCount === 0),
    );
    return bestAffordableModel(modelOptions(settings, usable), catalogModelId, available);
  }, [shortBy, available, availableModelIds, referenceCount, settings, catalogModelId]);
  const num = (value: number) => value.toLocaleString(isChinese ? "zh-CN" : "en-US");

  const check = canGenerate(settings, canUseGeneration);
  const promptEmpty = !check.ok && check.reason === "empty-prompt";

  useEffect(() => {
    const references = sessionStorage.getItem("aivd:home-video-references");
    if (references) {
      try {
        const parsed: unknown = JSON.parse(references);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item): item is UploadedVideoReference =>
            typeof item?.key === "string" && typeof item?.name === "string" && typeof item?.url === "string");
          if (valid.length) {
            setHomeReferences(valid);
            setImageKey(valid[0].key);
            setFileName(valid[0].name);
            setPreview(valid[0].url);
            return;
          }
        }
      } catch { /* Ignore a stale handoff and keep the studio usable. */ }
    }
    const key = sessionStorage.getItem("aivd:home-start-image");
    if (!key) return;
    setImageKey(key);
    setFileName(sessionStorage.getItem("aivd:home-start-image-name"));
    setPreview(sessionStorage.getItem("aivd:home-start-image-preview"));
    sessionStorage.removeItem("aivd:home-start-image");
    sessionStorage.removeItem("aivd:home-start-image-name");
    sessionStorage.removeItem("aivd:home-start-image-preview");
  }, []);

  useCreditReturnDraft("video", () => ({ settings, catalogModelId, imageKey, fileName, preview, homeReferences, mode, editTool }), (saved) => {
    if (saved.settings && availableModelIds.includes(saved.settings.modelId)) setSettings(saved.settings);
    if (saved.catalogModelId) setCatalogModelId(saved.catalogModelId);
    setImageKey(saved.imageKey ?? null);
    setFileName(saved.fileName ?? null);
    setPreview(saved.preview ?? null);
    setHomeReferences(Array.isArray(saved.homeReferences) ? saved.homeReferences : []);
    void currentUploadUrls().then((urls) => {
      setHomeReferences((items) => items.map((item) => ({ ...item, url: urls.get(item.key) ?? item.url })));
      if (saved.imageKey) setPreview((current) => urls.get(saved.imageKey!) ?? current);
    });
    if (saved.mode === "Create" || saved.mode === "Edit") setMode(saved.mode);
    if (typeof saved.editTool === "number") setEditTool(saved.editTool);
  });

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

  // Show earlier generations only when signed in (avoids 401 noise for guests).
  useEffect(() => {
    if (!session) return;
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
  }, [session]);

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

  function switchModel(id: string) {
    setUpcoming(undefined);
    setCatalogModelId(id);
    setDurationOpen(false);
    setNotice(null);
    // Keep the selected catalogue entry visible even if generation is not connected yet.
    setSettings((previous) => {
      const connected = selectModel(previous, id);
      if (connected !== previous) return connected;
      const durations = STUDIO_MODELS.find((item) => item.id === id)?.durations
        ?? catalogVideoDurations(id);
      return durations.length && !durations.includes(previous.duration)
        ? { ...previous, duration: closestDuration(durations, previous.duration) }
        : previous;
    });
  }

  async function handleGenerate() {
    if (submitting || !availableModelIds.includes(catalogModelId)) {
      return;
    }
    // An empty prompt gets a hint and the cursor, not a dead button.
    if (promptEmpty) {
      setNotice(isChinese ? "先写一句提示词，描述你想看到的画面。" : "Write a prompt describing what you want to see.");
      promptRef.current?.focus();
      return;
    }
    if (!durationSupported) {
      setDurationOpen(true);
      setNotice(isChinese ? `${model.name} 当前支持 ${durationLabel(durationOptions)} 秒，请调整时长后再生成。` : `${model.name} currently supports ${durationLabel(durationOptions, ", ")} seconds. Adjust the length before generating.`);
      return;
    }

    if (homeReferences.length > maxVideoReferences(catalogModelId)) {
      const limit = maxVideoReferences(catalogModelId);
      setNotice(isChinese ? `当前模型最多使用 ${limit} 张参考图，请先移除多余图片。` : `This model accepts up to ${limit} reference images. Remove the extras first.`);
      return;
    }
    const preparedPrompt = prepareVideoReferencePrompt(settings.prompt, homeReferences.length || (imageKey ? 1 : 0));
    if (!preparedPrompt.ok) {
      setNotice(isChinese ? `@图片${preparedPrompt.index} 没有对应的素材，请检查引用。` : `@Image${preparedPrompt.index} has no matching image. Check the reference.`);
      return;
    }

    // Signed in and the balance does not cover this clip: say so, with the
    // cost and the balance, before anything is sent.
    if (shortBy > 0 && available !== null) {
      const message = isChinese
        ? `积分不够：这条视频要 ${num(exampleCredits)} 积分，你还有 ${num(available)}。`
        : `Not enough credits: this clip takes ${num(exampleCredits)} credits and you have ${num(available)}.`;
      setNotice(message);
      creditsShortfall.note(message, exampleCredits);
      return;
    }

    if (!canUseGeneration) {
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
      const result = await submitGeneration({ ...settings, prompt: preparedPrompt.prompt }, idempotencyKey, fetch, homeReferences.length ? homeReferences.map((item) => item.key) : imageKey);

      if (!result.ok) {
        setNotice(errorMessage(result.code, result.message, isChinese));
        if (result.code === "INSUFFICIENT_CREDITS") {
          creditsShortfall.report(errorMessage(result.code, result.message, isChinese), result.requiredCredits);
          useCreditsStore.getState().invalidate();
          void fetchBalance();
        }
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
      sessionStorage.removeItem("aivd:home-video-references");
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
      : (catalogEntry ? catalogDetail(catalogEntry) : ""));
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
    submitting || uploading || availableModels.length === 0 || !selectedModelConnected || needsStartImage;
  const stepCopy = isChinese
    ? [
        { title: "上传参考素材", body: "上传或拖入参考图片（支持 @图片1 引用），或者只写提示词从零生成。" },
        { title: "选择预设", body: "挑一个镜头预设，控制画面的运动方式。" },
        { title: "获取视频", body: "点击生成，完成后在历史记录里播放和下载。" },
      ]
    : [
        { title: "Upload media", body: "Upload or drop reference assets (supports @Image1), or start from text alone." },
        { title: "Pick a preset", body: "Choose a camera preset to control how the shot moves." },
        { title: "Get the video", body: "Hit generate, then play and download it from history." },
      ];

  async function selectMedia(items: PickerAsset[]) {
    setUploading(true);
    setNotice(null);
    try {
      const references = (await Promise.all(items.map(readyPickerImage))).map((item) => ({
        ...item,
        sourceId: item.sourceId.startsWith("direct:") ? `upload:${item.key}` : item.sourceId,
      }));
      sessionStorage.removeItem("aivd:home-video-references");
      setHomeReferences(references);
      setFileName(references[0]?.name ?? null);
      setImageKey(references[0]?.key ?? null);
      setPreview(references[0]?.url ?? null);
    } catch (error) { setNotice(error instanceof Error ? error.message : (isChinese ? "素材上传失败，请重试。" : "Could not prepare the media. Try again.")); }
    finally { setUploading(false); }
  }
  const removeHomeReference = (index: number) => {
    const remaining = homeReferences.filter((_, itemIndex) => itemIndex !== index);
    setHomeReferences(remaining);
    if (remaining.length) sessionStorage.setItem("aivd:home-video-references", JSON.stringify(remaining));
    else sessionStorage.removeItem("aivd:home-video-references");
    setImageKey(remaining[0]?.key ?? null);
    setFileName(remaining[0]?.name ?? null);
    setPreview(remaining[0]?.url ?? null);
    setSettings((previous) => ({ ...previous, prompt: removeVideoReferenceToken(previous.prompt, index + 1) }));
  };
  const clearSelectedMedia = () => {
    sessionStorage.removeItem("aivd:home-video-references");
    setHomeReferences([]);
    setImageKey(null);
    setFileName(null);
    setPreview(null);
    setSettings((current) => ({ ...current, prompt: current.prompt.replace(/@(?:图片|image)\d+/gi, "") }));
  };
  const drop = useImageDrop((files) => void selectMedia(files.slice(0, maxVideoReferences(catalogModelId)).map((file) => ({ id: `direct:${crypto.randomUUID()}`, name: file.name, mimeType: file.type, url: "", file }))), !uploading && mode === "Create" && maxVideoReferences(catalogModelId) > 0);

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
  // Effects from the effects page arrive as a preset id; show their name.
  const effectTemplate = settings.preset ? EFFECT_TEMPLATES.find((item) => item.id === settings.preset) : undefined;
  const effectName = effectTemplate ? labelFor(effectTemplate.name, locale) : null;

  return (
    <div className="vs-root" {...(mode === "Create" ? { onPaste: drop.bind.onPaste } : {})}>
      <HomeMediaPicker
        lang={locale}
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(items) => void selectMedia(items)}
        onDelete={(id) => {
          const index = homeReferences.findIndex((item) => (item.sourceId ?? `upload:${item.key}`) === id);
          if (index >= 0) removeHomeReference(index);
          else if (imageKey && id === `upload:${imageKey}`) clearSelectedMedia();
        }}
        maxSelected={maxVideoReferences(catalogModelId)}
        selectedIds={homeReferences.map((item) => item.sourceId ?? `upload:${item.key}`)}
        userId={session?.user?.id}
      />
      <aside aria-label={copy.settings} className="vs-panel">
        <button type="button" className="vs-banner" onClick={() => setPickerOpen(true)} aria-label={`${copy.chooseModel}：${bannerName}`}>
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
        <div className="h-0 overflow-visible">
          <KieModelPicker
            kind="video"
            locale={locale}
            value={catalogModelId}
            connectedIds={availableModelIds}
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            placement="card"
            catalogSet="backup"
            allowUnconnectedSelection
            glass
            label={copy.model}
            valueLabel={upcoming?.name}
            hideTrigger
            onChange={switchModel}
          />
        </div>

        <button
          type="button"
          className={`vs-upload sr-drop w-full ${drop.over ? "sr-drop-on" : ""} ${preview ? "vs-upload-has" : ""}`}
          onClick={() => setMediaPickerOpen(true)}
          onDragEnter={drop.bind.onDragEnter}
          onDragOver={drop.bind.onDragOver}
          onDragLeave={drop.bind.onDragLeave}
          onDrop={drop.bind.onDrop}
          data-drop-label={isChinese ? "松开即可添加素材" : "Drop to add media"}
          disabled={uploading || maxVideoReferences(catalogModelId) === 0}
          aria-label={isChinese ? "上传素材" : "Upload media"}
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
          <span className="vs-upload-title">
            {homeReferences.length > 1
              ? (isChinese ? `已添加 ${homeReferences.length} 张参考图` : `${homeReferences.length} reference images added`)
              : fileName ?? (isChinese ? "上传素材" : "Upload media")}
          </span>
          <span className="vs-upload-sub">
            {uploading
              ? isChinese ? "上传中…" : "Uploading…"
              : preview
                ? isChinese ? "点击查看素材库或更换素材" : "Open your library to change the media"
                : isChinese ? `点击打开素材库或拖拽上传（支持 @引用）· ${copy.fileTypes}` : `Click or drop media (supports @mention) · ${copy.fileTypes}`}
          </span>
        </button>
            {homeReferences.length > 0 ? <div className="vs-home-references" aria-label={isChinese ? "已选择的参考素材" : "Selected reference media"}>
              {homeReferences.map((item, index) => {
                const token = `@${isChinese ? "图片" : "Image"}${index + 1}`;
                return (
                  <div key={item.key} className="vs-home-reference" title={isChinese ? `点击在提示词中插入 ${token}` : `Click to insert ${token} into prompt`}>
                    <button
                      type="button"
                      className="vs-home-reference-pick"
                      onClick={() => {
                        setSettings((previous) => ({
                          ...previous,
                          prompt: `${previous.prompt}${previous.prompt.trim() ? " " : ""}${token} `,
                        }));
                        promptRef.current?.focus();
                      }}
                    >
                      <img src={item.url} alt={isChinese ? `参考图片 ${index + 1}` : `Reference image ${index + 1}`} />
                      <span>{token}</span>
                    </button>
                    <button type="button" className="vs-home-reference-remove" onClick={() => removeHomeReference(index)} aria-label={isChinese ? `移除参考图片 ${index + 1}` : `Remove reference image ${index + 1}`}><X className="h-3 w-3" /></button>
                  </div>
                );
              })}
              <p>{isChinese ? `当前模型最多引用 ${maxVideoReferences(catalogModelId)} 张，点击标签可插入 @引用` : `Up to ${maxVideoReferences(catalogModelId)} assets — click a tag to insert @mention`}</p>
            </div> : null}
            {imageKey ? (
              <button type="button" onClick={clearSelectedMedia} className="vs-link">
                {isChinese ? "移除素材" : "Remove media"}
              </button>
            ) : null}

            <div className="vs-card vs-prompt">
              <div className="vs-prompt-head">
                <label htmlFor="studio-prompt" className="vs-prompt-label">{copy.prompt}</label>
                <kbd className="vs-kbd" title={isChinese ? "按 ⌘/Ctrl + Enter 生成" : "Press ⌘/Ctrl + Enter to generate"}>
                  {isMac ? "⌘" : "Ctrl"} ↵ {isChinese ? "生成" : "generate"}
                </kbd>
              </div>
              <textarea
                id="studio-prompt"
                ref={promptRef}
                value={settings.prompt}
                maxLength={promptMaxLength}
                placeholder={copy.promptPlaceholder}
                onChange={(event) => {
                  setSettings((previous) => ({ ...previous, prompt: event.target.value }));
                  if (notice) setNotice(null);
                }}
                onKeyDown={(event) => {
                  // ⌘/Ctrl+Enter generates, the same shortcut as the image studio.
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !generateDisabled) {
                    event.preventDefault();
                    void handleGenerate();
                  }
                }}
              />
              {draft.restored ? (
                <p className="draft-note">
                  {isChinese ? "已恢复上次没生成的草稿" : "Your unsent draft is back"}
                  <button type="button" onClick={draft.discard}>
                    {isChinese ? "清空" : "Clear"}
                  </button>
                </p>
              ) : null}
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
                  {settings.prompt.length}/{promptMaxLength}
                </span>
              </div>
            </div>

            {settings.preset && !activePreset ? (
              <span className="vs-chip w-fit">
                {effectName ? `${isChinese ? "特效" : "Effect"}：${effectName}` : `${copy.preset}: ${settings.preset}`}
                <button type="button" aria-label={copy.clearPreset} onClick={() => setSettings((previous) => ({ ...previous, preset: undefined }))}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ) : null}

            {presetsOpen ? (
              <dialog open className="vs-presets-backdrop m-0 max-h-none max-w-none border-0" aria-label={isChinese ? "选择镜头预设" : "Choose camera preset"} onClick={() => setPresetsOpen(false)}>
                <section id="studio-presets" className="vs-presets vs-presets-modal" onClick={(e) => e.stopPropagation()}>
                  <div className="vs-presets-head">
                    <span>{isChinese ? "镜头运镜预设" : "Camera presets"}</span>
                    <div className="flex items-center gap-3">
                      {activePreset ? (
                        <button type="button" className="vs-link" onClick={() => setSettings((previous) => ({ ...previous, preset: undefined }))}>
                          {copy.clearPreset}
                        </button>
                      ) : null}
                      <button type="button" className="vs-link" onClick={() => setPresetsOpen(false)} aria-label={isChinese ? "关闭" : "Close"}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
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
                          <img src={preset.image} alt="" loading="eager" decoding="async" />
                        </span>
                        <span className="vs-preset-name">{isChinese ? preset.zh : preset.en}</span>
                      </button>
                    ))}
                  </div>
                  <p className="vs-presets-note">
                    {isChinese ? "选中的运镜会自动加到提示词后面，所有模型都能用。" : "The camera move is added to your prompt, so it works with every model."}
                  </p>
                </section>
              </dialog>
            ) : null}

            <div className="vs-grid">
              <div ref={durationRef} className="vs-duration-wrap">
                <button type="button" className="vs-card vs-duration-trigger" aria-expanded={durationOpen} aria-controls="studio-duration-panel" onClick={() => setDurationOpen((value) => !value)}>
                  <span className="min-w-0 flex-1"><span className="vs-card-label">{copy.duration}</span><span className="vs-card-value">{durationText}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-[var(--hfv-muted)]" aria-hidden="true" />
                </button>
                {durationOpen ? <div id="studio-duration-panel" className="vs-duration-panel">
                  <div className="vs-duration-heading">{copy.duration}<strong>{durationText}</strong></div>
                  {durationOptions.length ? <>
                    <input id="studio-duration" type="range" min={durationMin} max={durationMax} step="1" value={settings.duration} disabled={durationOptions.length < 2} aria-label={copy.duration} onChange={(event) => { setSettings((previous) => ({ ...previous, duration: closestDuration(durationOptions, Number(event.target.value)) })); setNotice(null); }} style={{ "--vs-duration-progress": `${durationMax === durationMin ? 0 : ((settings.duration - durationMin) / (durationMax - durationMin)) * 100}%` } as CSSProperties} />
                    <div className="vs-duration-limits"><span>{durationMin}s</span><span>{durationMax}s</span></div>
                  </> : null}
                  {!durationSupported && durationOptions.length ? <p className="vs-duration-warning">{isChinese ? `${model.name} 当前支持 ${durationLabel(durationOptions)} 秒` : `${model.name} currently supports ${durationLabel(durationOptions, ", ")}s`}</p> : null}
                </div> : null}
              </div>
              <SelectCard
                id="studio-aspect"
                label={copy.aspect}
                fixedHint={isChinese ? `${model.name} 只支持这个比例` : `${model.name} only offers this ratio`}
                value={settings.aspect}
                options={model.aspects}
                onChange={(aspect) => setSettings((previous) => ({ ...previous, aspect }))}
              />
              <SelectCard
                id="studio-resolution"
                label={isChinese ? "画质" : "Quality"}
                fixedHint={isChinese ? `${model.name} 只支持这个画质` : `${model.name} only offers this quality`}
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
            {!durationSupported && durationOptions.length ? <output className="vs-duration-warning">{isChinese ? `${model.name} 当前支持 ${durationLabel(durationOptions)} 秒，请调整时长后再生成。` : `${model.name} currently supports ${durationLabel(durationOptions, ", ")} seconds. Adjust the length before generating.`}</output> : null}

            <button
              type="button"
              disabled={generateDisabled}
              onClick={handleGenerate}
              className="vs-generate"
              title={internalFree ? (isChinese ? "内部测试账号免费" : "Free for internal test account") : selectedModelConnected ? copy.creditCostNote : copy.creditEstimateNote}
            >
              {submitting ? copy.submit : copy.generate}
              <span className="vs-generate-cost">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                {selectedModelConnected ? (durationSupported ? (internalFree ? 0 : exampleCredits) : "—") : copy.soon}
              </span>
            </button>
            {available !== null && selectedModelConnected ? (
              <p className={shortBy ? "vs-balance vs-balance-short" : "vs-balance"}>
                {isChinese ? `余额 ${num(available)} 积分` : `Balance: ${num(available)} credits`}
                {shortBy ? (isChinese ? `，这条还差 ${num(shortBy)}` : ` · ${num(shortBy)} short for this clip`) : null}
              </p>
            ) : null}
            {needsStartImage ? (
              <output className="vs-notice">
                {isChinese ? `${bannerName} 需要先上传素材。` : `${bannerName} needs reference media. Upload above.`}
              </output>
            ) : null}
            {selectedModelConnected ? null : (
              <output className="vs-notice">
                {isChinese
                  ? `${bannerName} 暂不可生成。现在可以用 ${availableModels.map((item) => item.name).join(" 或 ")} 生成。`
                  : `${bannerName} cannot generate yet. You can use ${availableModels.map((item) => item.name).join(" or ")} today.`}
              </output>
            )}

            {notice ? (
              <output aria-live="polite" className="vs-notice">
                {notice}
                {creditsShortfall.isShortfall(notice) ? (
                  <span className="vs-notice-actions">
                    {affordable ? (
                      <button type="button" className="cu-get cu-get-alt" onClick={() => switchModel(affordable.id)}>
                        {isChinese ? `换成 ${affordable.name}（${num(affordable.credits)} 积分）` : `Use ${affordable.name} (${num(affordable.credits)} credits)`}
                      </button>
                    ) : null}
                    {creditsShortfall.action(notice)}
                  </span>
                ) : null}
              </output>
            ) : null}
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
              {isChinese ? `${EDIT_TOOLS[editTool].descZh}。即将上线。` : `${EDIT_TOOLS[editTool].descEn}. Coming soon.`}
            </p>
            <div className="vs-howto-media vs-howto-wide" data-video-scope>
              {/* A large clip: with reduced motion it plays from the button only. */}
              <InViewVideo src="/home/hero-marina-loop.mp4" poster="/home/hero-marina-poster.webp" hoverPlay={false} />
              {/* One sample clip stands in for every tool; it is not that tool's result. */}
              <span className="vs-howto-tag">{isChinese ? "示意" : "Illustration"}</span>
              <VideoPlayToggle zh={isChinese} className="vs-howto-play" />
            </div>
          </div>
        ) : activeTab === "History" ? (
          results.length === 0 ? (
            <div className="vs-empty-stage">
              <div className="vs-empty-strip">
                <div className="vs-empty-strip-copy">
                  <span className="vs-empty-strip-icon" aria-hidden="true">
                    <Clapperboard className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="vs-stage-title">
                      {signedOut
                        ? isChinese ? "悬停预览灵感样片，一键做同款" : "Hover to preview, click to recreate"
                        : isChinese ? "还没有生成过视频 · 选一条样片立刻开拍" : "No clips yet · Pick a reel to start"}
                    </h2>
                    <p className="vs-empty-strip-sub">
                      {signedOut
                        ? isChinese
                          ? "登录后同步所有云端作品；未登录也可先点样片自动填充提示词与运镜。"
                          : "Sign in to sync clips across devices, or click any reel below to auto-fill its prompt & camera."
                        : isChinese
                          ? "在左侧写提示词或拖入素材（支持 @图片1），也可以直接点下方动态样片一键做同款。"
                          : "Write a prompt or upload media on the left (supports @Image1), or recreate any living reel below."}
                    </p>
                  </div>
                </div>
                {signedOut ? (
                  <button type="button" className="vs-empty-signin" onClick={() => signIn.onOpen()}>
                    {isChinese ? "登录同步作品" : "Sign in"}
                  </button>
                ) : null}
              </div>

              <div className="vs-living-grid" aria-label={isChinese ? "动态悬停样片墙" : "Living video showcase reel"}>
                {LIVING_SHOWCASE.map((item, idx) => (
                  <button
                    key={item.id}
                    type="button"
                    className="vs-living-card"
                    title={isChinese ? item.promptZh : item.promptEn}
                    onMouseEnter={(event) => {
                      const vid = event.currentTarget.querySelector("video");
                      if (vid) void vid.play().catch(() => undefined);
                    }}
                    onMouseLeave={(event) => {
                      const vid = event.currentTarget.querySelector("video");
                      if (vid) {
                        vid.pause();
                        vid.currentTime = 0;
                      }
                    }}
                    onClick={() => {
                      const presetId = VIDEO_PRESETS[idx % VIDEO_PRESETS.length]?.id;
                      setSettings((previous) => ({
                        ...previous,
                        prompt: isChinese ? item.promptZh : item.promptEn,
                        aspect: model.aspects.includes(item.aspect) ? item.aspect : previous.aspect,
                        preset: presetId ?? previous.preset,
                      }));
                      promptRef.current?.focus();
                    }}
                  >
                    <video
                      src={item.video}
                      poster={item.poster}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="vs-living-video"
                    />
                    <span className="vs-recreate-shade" aria-hidden="true" />
                    <span className="vs-living-badge vs-meta-mono">{item.duration} · {item.aspect}</span>
                    <span className="vs-recreate-pill">
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      {isChinese ? "做同款" : "Recreate"}
                    </span>
                    <span className="vs-recreate-meta">
                      <strong>{isChinese ? item.titleZh : item.titleEn}</strong>
                    </span>
                  </button>
                ))}
              </div>
            </div>
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
                        <button
                          type="button"
                          className="sr-icon"
                          title={isChinese ? "在无限画布中截帧 / 配音 / 编排" : "Open in Infinite Canvas"}
                          aria-label={isChinese ? "在无限画布中打开" : "Open in Infinite Canvas"}
                          onClick={() => {
                            try {
                              sessionStorage.setItem(
                                "aivd:canvas-handoff",
                                JSON.stringify({ kind: "video", url: result.videoUrl, prompt: result.prompt, model: model.name }),
                              );
                            } catch {
                              // Ignore storage errors.
                            }
                            window.location.assign(localizedHref(locale, "/creative-space/canvas"));
                          }}
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
                    className="vs-result ds-shimmer"
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
                ? "写一句提示词或上传素材（支持 @图片1 引用），选好模型就能生成，生成前就能看到要消耗的积分。"
                : "Write a prompt or upload media (supports @Image1 mentions), pick a model and generate. You see the credit cost before you start."}
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
            <a className="vs-help" href={localizedHref(locale, "/templates")}>
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
