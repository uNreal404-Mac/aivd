"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { localizedHref } from "@/lib/locale-path";

import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { useCreditReturnDraft } from "@/hooks/use-credit-return-draft";
import { currentUploadUrls } from "@/lib/home-media-library";
import { clearSubmittedHomePrompt } from "@/lib/home-draft";
import { uploadErrorText } from "@/lib/image-to-video";
import { AUTOSTART_STORAGE_KEY, claimAutostart } from "@/lib/autostart";
import { KLING_KEYFRAME_MODEL, maxKlingFrames } from "@/lib/kling-keyframes";
import { frameKeys, frameReferences, parseStudioFrames, prepareKeyframePrompt, renumberFrameMentions, STUDIO_KEYFRAME_STORAGE, validFrameCount, type StudioFrames } from "@/lib/studio-keyframes";
import { KeyframeInput } from "./video-studio/keyframe-input";
import { isWanVideoMime, WAN_REFERENCE_MAX_FILES } from "@/lib/wan-video-references";
import { readyPickerImage, readyPickerVideo, type PickerAsset } from "@/lib/home-media-library";
import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { EFFECT_TEMPLATES, labelFor } from "@/lib/effects-data";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import { errorMessage } from "@/lib/media-studio";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useCreditsStore } from "@/stores/credits-store";
import { Coins, Loader2 } from "lucide-react";
import {
  RESULT_POLL_INTERVAL_MS,
  STUDIO_MODELS,
  applyResultStatus,
  bestAffordableModel,
  canGenerate,
  defaultSettings,
  buildGenerateRequest,
  estimateCredits,
  fetchRecentResults,
  fetchResultStatus,
  isResultPending,
  mergeResults,
  modelOptions,
  selectModel,
  settingsFromSearchParams,
  submitGeneration,
} from "@/lib/ai-video-studio";
import type { StudioResult, StudioSettings } from "@/lib/ai-video-studio";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { VIDEO_CATALOG, catalogVideoDurations } from "@/lib/kie-model-catalog";
import { closestDuration, durationLabel } from "@/lib/video-durations";
import { useCatalogDetail } from "@/components/hf/use-catalog-detail";
import { getMarketModel } from "@/ai/kie-market";
import { findNavModel } from "@/lib/nav-models";
import { findVideoPreset } from "@/lib/video-presets";
import { marketImageNotice, marketInputNotice } from "@/lib/market-input-check";
import { promptWithPreset } from "@/lib/video-presets";
import { MAX_HOME_REFERENCES, maxVideoReferences, prepareVideoReferencePrompt, removeVideoReferenceToken, type UploadedVideoReference } from "@/lib/video-references";
import { MediaViewer, useImageDrop, type ViewerItem } from "@/components/hf/studio-results";
import { PresetCard, PresetLibrary } from "@/components/hf/video-studio/presets";
import { ReferenceBlock, referenceToken, type ReferenceThumb } from "@/components/hf/video-studio/reference-block";
import { PromptCard, insertToken } from "@/components/hf/video-studio/prompt-card";
import { CardFace, ChoiceCard, DurationCard, widestFirst } from "@/components/hf/video-studio/setting-cards";
import { VideoToolPanel } from "./video-studio/tool-panel";
import { ToolGuide } from "./video-studio/tool-guide";
import "./video-studio/video-tools.css";
import { HowItWorks, StageTabs, type StageTab } from "@/components/hf/video-studio/stage";
import { ExtendPanel, asExtendSource } from "./video-studio/extend-panel";
import type { ExtendSource } from "./extend-dialog";
import { ResultsGrid } from "@/components/hf/video-studio/history-view";
import { FilterMenu, INITIAL_FILTER, matchingVideos, rangeName } from "./video-studio/history-filter";
import { ActiveFilters, NoMatches, ViewMenu, useHistoryView } from "@/components/hf/video-studio/history-tools";
import "./ai-video-studio.css";

// Cover art for the preset card while no camera preset is chosen.
const MODEL_COVERS: Record<string, string> = {
  "veo-3.1": "/home/samples/mountain-valley.webp",
  "wan2.6": "/home/samples/storm-sea.webp",
  "bytedance/seedance-2-5": "/home/samples/red-carpet.webp",
  "seedance-2-5-flash": "/home/samples/rain-couple.webp",
  "kling/v4-reference-to-video": "/home/samples/autumn-walk.webp",
  "kling/v4-flash-reference-to-video": "/home/samples/studio-room.webp",
  "wan/3-0-video": "/home/samples/storm-sea.webp",
};

const PROMPT_MAX_LENGTH = 1500;

export function AiVideoStudio(props: Parameters<typeof AiVideoStudioForm>[0]) {
  const { data: session, isPending } = useSession();
  return <AiVideoStudioForm key={session?.user?.id ?? (isPending ? "loading" : "guest")} {...props} />;
}

function AiVideoStudioForm({
  generationEnabled,
  initialSettings,
  initialExtend = false,
  initialTool = "create",
  initialKeyframes = false,
  locale,
  availableModelIds,
  initialCatalogModelId,
  upcomingModel,
  homeHandoffToken = "",
  expectedReferences = 0,
}: {
  generationEnabled: boolean;
  initialSettings?: StudioSettings;
  initialExtend?: boolean;
  initialTool?: "create" | "edit" | "motion";
  initialKeyframes?: boolean;
  locale: string;
  availableModelIds: string[];
  initialCatalogModelId?: string;
  homeHandoffToken?: string;
  expectedReferences?: number;
  /** A model picked from the nav that is not connected or catalogued yet. */
  upcomingModel?: { name: string; desc: string };
}) {
  const isChinese = locale.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  // Signed-out visitors have history too, once they sign in; say so instead of "nothing yet".
  const { data: session, isPending: sessionLoading } = useSession();
  const draftScope = session?.user?.id ? `video:${session.user.id}` : sessionLoading ? "video:loading" : "video";
  const signedOut = !sessionLoading && !session;
  const internalFree = process.env.NEXT_PUBLIC_IS_PREVIEW === "true" &&
    session?.user?.isAdmin === true && session.user.isSuperAccount === true;
  const canUseGeneration = generationEnabled || internalFree;
  const copy = isChinese
    ? {
        panelTitle: "创建视频",
        change: "更换",
        promptPlaceholder: "描述镜头：主体、动作、镜头运动和光线。输入 @ 可引用参考图片……",
        model: "模型",
        chooseModel: "选择模型",
        duration: "时长",
        aspect: "画面比例",
        resolution: "画质",
        sourceClip: "继承原片",
        submit: "正在提交…",
        generate: "生成",
        creditEstimateNote: "示例估算，实际消耗以正式计费规则为准。",
        creditCostNote: "提交时冻结这些积分，生成失败会退回。",
        settings: "视频设置",
        results: "生成结果",
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
        panelTitle: "Create video",
        change: "Change",
        promptPlaceholder: "Describe the shot: subject, motion, camera and light. Type @ to mention a reference image…",
        model: "Model",
        chooseModel: "Choose a model",
        duration: "Duration",
        aspect: "Aspect ratio",
        resolution: "Resolution",
        sourceClip: "Source clip",
        submit: "Starting…",
        generate: "Generate",
        creditEstimateNote: "Example estimate only. Actual credits follow the published pricing.",
        creditCostNote: "Held when you submit and returned if generation fails.",
        settings: "Video settings",
        results: "Results",
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
    draftScope,
    settings.prompt,
    (text) => setSettings((previous) => ({ ...previous, prompt: text })),
    Boolean(initialSettings?.prompt || homeHandoffToken),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  // The tab the media library opens on: Upload, or Elements from the chip.
  const [mediaTab, setMediaTab] = useState<"upload" | "elements">("upload");
  const openMedia = (tab: "upload" | "elements" = "upload") => {
    setMediaTab(tab);
    setMediaPickerOpen(true);
  };
  const [durationOpen, setDurationOpen] = useState(false);
  // Start on a model that can generate: the one in the URL when it is on sale,
  // otherwise whatever the settings resolved to.
  // Models from the catalogue open selected even when they cannot generate
  // yet, so a click in the nav lands on that model, as on the reference.
  const [catalogModelId, setCatalogModelId] = useState(() =>
    initialCatalogModelId && VIDEO_CATALOG.some((item) => item.id === initialCatalogModelId)
      ? initialCatalogModelId
      : settings.modelId,
  );
  const settingsSlot = `aivd:video-create-options:${draftScope}:${initialCatalogModelId ?? "default"}`;
  const [optionsReady, setOptionsReady] = useState(false);
  useEffect(() => {
    try {
      const explicit = new URL(window.location.href).searchParams;
      const raw = sessionStorage.getItem(settingsSlot);
      if (
        !raw ||
        initialKeyframes ||
        ["autostart", "prompt", "sample", "preset", "duration", "resolution", "aspect", "audio"].some(
          (field) => explicit.has(field),
        )
      )
        return;
      const saved = JSON.parse(raw);
      if (
        typeof saved.model !== "string" ||
        !availableModelIds.includes(saved.model) ||
        !VIDEO_CATALOG.some((item) => item.id === saved.model) ||
        (explicit.has("model") && saved.model !== initialCatalogModelId)
      )
        return;
      const restored = settingsFromSearchParams(saved);
      setCatalogModelId(saved.model);
      setSettings((previous) => ({ ...restored, prompt: previous.prompt }));
    } catch {
      /* Keep the model and options in the link. */
    } finally {
      setOptionsReady(true);
    }
  }, [settingsSlot]);
  useEffect(() => {
    if (!optionsReady || initialKeyframes) return;
    try {
      sessionStorage.setItem(
        settingsSlot,
        JSON.stringify({
          model: catalogModelId,
          preset: settings.preset,
          duration: String(settings.duration),
          aspect: settings.aspect,
          resolution: settings.resolution,
          audio: String(settings.audio),
        }),
      );
    } catch {
      /* Keep the settings in this page. */
    }
  }, [
    settingsSlot,
    optionsReady,
    initialKeyframes,
    catalogModelId,
    settings.preset,
    settings.duration,
    settings.aspect,
    settings.resolution,
    settings.audio,
  ]);

  const [upcoming, setUpcoming] = useState(upcomingModel);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [viewing, setViewing] = useState<number | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [homeReferences, setHomeReferences] = useState<UploadedVideoReference[]>([]);
  const [handoffReady, setHandoffReady] = useState(!homeHandoffToken);
  const [mediaDraftReady, setMediaDraftReady] = useState(false);
  const mediaDraftKey = `aivd:video-media-draft:${draftScope}`;
  const [videoInput, setVideoInput] = useState(false);
  const [keyframeMode, setKeyframeMode] = useState(initialKeyframes);
  const promptMaxLength = keyframeMode ? 8000 : Math.max(PROMPT_MAX_LENGTH, initialSettings?.prompt.length ?? 0);
  const [frames, setFrames] = useState<StudioFrames>({});
  const [framesReady, setFramesReady] = useState(!initialKeyframes);
  const frameCount = frameReferences(frames).length;
  const changeFrames = (next: StudioFrames) => {
    if (!session?.user?.id) return;
    setSettings(previous => ({ ...previous, prompt: renumberFrameMentions(previous.prompt, frames, next) }));
    setFrames(next);
    setNotice(null);
    try { sessionStorage.setItem(STUDIO_KEYFRAME_STORAGE, JSON.stringify({ ownerId: session.user.id, ...next })); }
    catch { setNotice(isChinese ? "标签页存储已满，请减少素材后重试。" : "Tab storage is full. Remove a reference and retry."); }
  };
  const mediaSelectionRevision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; mediaSelectionRevision.current++; };
  }, []);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const creditsShortfall = useCreditsShortfall(isChinese);
  const autostartDone = useRef(false);
  // Signed in: the balance, so a clip it cannot pay for is caught before it
  // is sent and a model it can pay for is offered.
  const balance = useCreditsStore((state) => state.balance);
  const fetchBalance = useCreditsStore((state) => state.fetchBalance);
  useEffect(() => {
    if (session) void fetchBalance();
  }, [session, fetchBalance]);
  const [extendMode, setExtendMode] = useState(initialExtend);
  const [tool, setTool] = useState(initialTool);
  const [visitedTools, setVisitedTools] = useState<string[]>([initialTool]);
  function visit(next: typeof tool) {
    setTool(next);
    if (next !== "create")
      setVisitedTools((previous) => (previous.includes(next) ? previous : [...previous, next]));
  }
  function chooseMode(next: typeof tool, extend = extendMode) {
    visit(next);
    setExtendMode(extend);
    setPresetsOpen(false);
    setMediaPickerOpen(false);
    const url = new URL(window.location.href);
    const mode = next === "create" ? (extend ? "extend" : "") : next;
    url.searchParams.delete("mode");
    if (mode) url.searchParams.set("tool", mode);
    else url.searchParams.delete("tool");
    if (url.href !== window.location.href) window.history.pushState(null, "", url);
  }
  useEffect(() => {
    const restoreMode = () => {
      const search = new URL(window.location.href).searchParams;
      const mode = search.get("tool") ?? search.get("mode");
      visit(mode === "edit" || mode === "motion" ? mode : "create");
      if (mode !== "edit" && mode !== "motion") setExtendMode(mode === "extend");
      setPresetsOpen(false);
      setMediaPickerOpen(false);
    };
    window.addEventListener("popstate", restoreMode);
    return () => window.removeEventListener("popstate", restoreMode);
  }, []);
  const [extendSource, setExtendSource] = useState<ExtendSource | null>(null);
  const sourceSlot = `aivd:extend-source:${session?.user?.id ?? "guest"}`;
  const [sourceRestored, setSourceRestored] = useState(false);
  const sourceDirty = useRef(false);
  const changeExtendSource = (next: ExtendSource | null) => {
    sourceDirty.current = true;
    setExtendSource(next);
  };
  useEffect(() => {
    let live = true;
    sourceDirty.current = false;
    if (!session?.user?.id) return;
    const restore = async () => {
      try {
        const raw = sessionStorage.getItem(sourceSlot);
        if (!raw) return;
        const saved = JSON.parse(raw);
        let url: string | null = null;
        let definitivelyGone = false;
        if (typeof saved.sourceVideoKey === "string") {
          const response = await fetch("/api/v1/video/tool-source", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Media-Account": session.user.id },
            body: JSON.stringify({ model: "pixverse-v6/extend", sourceVideoKey: saved.sourceVideoKey }),
          });
          if (response.status === 400 || response.status === 404) {
            definitivelyGone = true;
          } else if (response.ok) {
            const payload = await response.json().catch(() => null);
            url = typeof payload?.data?.preview === "string" ? payload.data.preview : null;
          }
        } else if (typeof saved.videoUuid === "string" && /^[\w-]+$/.test(saved.videoUuid)) {
          const status = await fetchResultStatus(saved.videoUuid);
          if (status.ok && status.status === "completed") url = status.videoUrl ?? null;
          else if (status.ok && status.status === "failed") definitivelyGone = true;
        } else {
          definitivelyGone = true;
        }
        if (!live) return;
        if (definitivelyGone) {
          sessionStorage.removeItem(sourceSlot);
        } else if (url) {
          setExtendSource((current) => current ?? { ...saved, videoUrl: url });
        } else {
          // Transient preview error: keep the exact source pointer so retry reuses the same key.
          setExtendSource((current) => current ?? { ...saved, videoUrl: "" });
        }
      } catch {
        // Transient network/storage error: leave sessionStorage intact and preserve the saved pointer if parseable.
        try {
          const raw = sessionStorage.getItem(sourceSlot);
          const saved = raw ? JSON.parse(raw) : null;
          if (live && saved && (typeof saved.sourceVideoKey === "string" || typeof saved.videoUuid === "string")) {
            setExtendSource((current) => current ?? { ...saved, videoUrl: "" });
          }
        } catch {
          /* Keep stored source untouched. */
        }
      } finally {
        if (live) setSourceRestored(true);
      }
    };
    void restore();
    return () => {
      live = false;
    };
  }, [sourceSlot, session?.user?.id]);
  useEffect(() => {
    if (!sourceRestored || !session?.user?.id) return;
    try {
      if (!extendSource) {
        if (sourceDirty.current) sessionStorage.removeItem(sourceSlot);
      } else {
        const { videoUrl: _preview, ...stable } = extendSource;
        sessionStorage.setItem(sourceSlot, JSON.stringify(stable));
      }
    } catch {
      /* Keep the source in this page. */
    }
  }, [extendSource, sourceRestored, sourceSlot, session?.user?.id]);

  const [results, setResults] = useState<StudioResult[]>([]);
  const [pendingSubmission, setPendingSubmission] = useState<StudioResult | null>(() => homeHandoffToken ? {
    id: `submitting:${homeHandoffToken}`, status: "submitting", prompt: initialSettings?.prompt ?? "",
    model: initialCatalogModelId ?? initialSettings?.modelId, createdAt: Date.now(),
  } : null);
  const [pendingTools, setPendingTools] = useState<StudioResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // First visit opens on how it works, as the reference does; returning users
  // land on their history once it loads.
  const [activeTab, setActiveTab] = useState<StageTab>(homeHandoffToken ? "History" : "How it works");
  // History's Filter and View menus (stage bar, History tab only).
  const [historyFilter, setHistoryFilter] = useState(INITIAL_FILTER);
  const [historyView, setHistoryView] = useHistoryView();

  const model =
    STUDIO_MODELS.find((item) => item.id === settings.modelId) ??
    STUDIO_MODELS[0];
  const selectedModelConnected = !upcoming && availableModelIds.includes(catalogModelId);
  const catalogEntry = VIDEO_CATALOG.find((item) => item.id === catalogModelId);
  const catalogDetail = useCatalogDetail();
  const durationOptions = STUDIO_MODELS.find((item) => item.id === catalogModelId)?.durations
    ?? catalogVideoDurations(catalogModelId);
  const durationSupported = durationOptions.includes(settings.duration);
  // What the server will freeze: reference images and sound included.
  const quotedImages = keyframeMode ? frameCount : videoInput ? 0 : homeReferences.length || (imageKey ? 1 : 0);
  const exampleCredits = selectedModelConnected
    ? estimateCredits(settings, { images: quotedImages, audio: settings.audio })
    : Math.ceil(settings.duration * 5 * (settings.resolution === "1080p" ? 1.5 : settings.resolution === "720p" ? 1.25 : 1));

  const available = session && balance && !internalFree ? Math.max(0, balance.availableCredits) : null;
  const shortBy = available !== null && selectedModelConnected && durationSupported ? Math.max(0, exampleCredits - available) : 0;
  const referenceCount = quotedImages;
  const affordable = useMemo(() => {
    if (!shortBy || available === null || videoInput || keyframeMode) return undefined;
    // Only models this clip could run on: enough room for its images, and an
    // image when the model needs one.
    const usable = availableModelIds.filter(
      (id) => referenceCount <= maxVideoReferences(id) && !(getMarketModel(id)?.options.requiresImage && referenceCount === 0),
    );
    return bestAffordableModel(modelOptions(settings, usable, referenceCount), catalogModelId, available);
  }, [shortBy, available, availableModelIds, referenceCount, settings, catalogModelId, videoInput, keyframeMode]);
  const num = (value: number) => value.toLocaleString(isChinese ? "zh-CN" : "en-US");

  const check = canGenerate(settings, canUseGeneration);
  const promptEmpty = !check.ok && check.reason === "empty-prompt";

  const handoffChecked = useRef(false);
  const incomingMedia = useRef(false);
  const [sessionWaited, setSessionWaited] = useState(false);
  useEffect(() => {
    if (sessionLoading || !optionsReady || handoffChecked.current || (homeHandoffToken && !session && !sessionWaited)) return;
    handoffChecked.current = true;
    const owner = sessionStorage.getItem("aivd:home-video-reference-owner");
    const references = sessionStorage.getItem("aivd:home-video-references");
    const rejectHandoff = () => {
      sessionStorage.removeItem("aivd:home-video-references");
      sessionStorage.removeItem("aivd:home-video-reference-owner");
      autostartDone.current = true;
      setPendingSubmission(null);
      const url = new URL(window.location.href);
      const token = url.searchParams.get("autostart");
      if (token) {
        claimAutostart(token, sessionStorage);
        url.searchParams.delete("autostart");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      }
      setNotice(isChinese ? "请重新选择当前账户的参考素材。" : "Choose reference media from your current account.");
      setHandoffReady(true);
    };
    if (initialKeyframes) {
      incomingMedia.current = true;
      const raw = sessionStorage.getItem(STUDIO_KEYFRAME_STORAGE);
      const next = raw ? parseStudioFrames(raw, session?.user?.id ?? "") : {};
      if (next && (!expectedReferences || frameReferences(next).length === expectedReferences)) setFrames(next);
      else {
        sessionStorage.removeItem(STUDIO_KEYFRAME_STORAGE);
        rejectHandoff();
      }
      setFramesReady(true);
      setHandoffReady(true);
      return;
    }
    if (references) {
      try {
        const parsed: unknown = JSON.parse(references);
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((item): item is UploadedVideoReference =>
            typeof item?.key === "string" && typeof item?.name === "string" && typeof item?.url === "string");
          const hasVideos = valid.some(item => item.mimeType?.startsWith("video/"));
          if ((owner && owner !== session?.user?.id) || valid.length !== parsed.length ||
            (homeHandoffToken && expectedReferences > 0 && valid.length !== expectedReferences) ||
            new Set(valid.map(item => item.key)).size !== valid.length ||
            valid.some(item => item.key.startsWith("uploads/") && !item.key.startsWith(`uploads/${session?.user?.id}/`)) ||
            (hasVideos && (catalogModelId !== "wan2.6" || valid.length > WAN_REFERENCE_MAX_FILES ||
              valid.some(item => !isWanVideoMime(item.mimeType ?? "") || !item.key.startsWith(`uploads/${session?.user?.id}/`))))) {
            rejectHandoff();
            return;
          }
          if (valid.length) {
            incomingMedia.current = true;
            setHomeReferences(valid);
            const video = valid.some(item => item.mimeType?.startsWith("video/"));
            setVideoInput(video);
            setImageKey(video ? null : valid[0].key);
            setFileName(valid[0].name);
            setPreview(valid[0].url);
            sessionStorage.removeItem("aivd:home-video-references");
            sessionStorage.removeItem("aivd:home-video-reference-owner");
            setHandoffReady(true);
            return;
          }
        }
      } catch { rejectHandoff(); return; }
    }
    const key = sessionStorage.getItem("aivd:home-start-image");
    if (!key) {
      if (homeHandoffToken && expectedReferences > 0) rejectHandoff();
      else setHandoffReady(true);
      return;
    }
    const startOwner = sessionStorage.getItem("aivd:home-start-image-owner");
    sessionStorage.removeItem("aivd:home-start-image-owner");
    if (startOwner && startOwner !== session?.user?.id) {
      for (const name of ["aivd:home-start-image", "aivd:home-start-image-name", "aivd:home-start-image-preview"]) sessionStorage.removeItem(name);
      rejectHandoff();
      return;
    }
    setImageKey(key);
    incomingMedia.current = true;
    setFileName(sessionStorage.getItem("aivd:home-start-image-name"));
    setPreview(sessionStorage.getItem("aivd:home-start-image-preview"));
    sessionStorage.removeItem("aivd:home-start-image");
    sessionStorage.removeItem("aivd:home-start-image-name");
    sessionStorage.removeItem("aivd:home-start-image-preview");
    setHandoffReady(true);
  }, [sessionLoading, session?.user?.id, sessionWaited, initialKeyframes, optionsReady, catalogModelId, homeHandoffToken, expectedReferences]);

  useEffect(() => {
    if (sessionLoading || !optionsReady || !handoffReady) return;
    if (!homeHandoffToken && !incomingMedia.current) {
      try {
        const saved = JSON.parse(sessionStorage.getItem(mediaDraftKey) || "null");
        if (saved && Array.isArray(saved.references)) {
          const references = saved.references.filter((item: UploadedVideoReference) =>
            typeof item?.key === "string" && typeof item?.name === "string" && typeof item?.url === "string" &&
            (!item.key.startsWith("uploads/") || item.key.startsWith(`uploads/${session?.user?.id}/`))
          );
          if (references.length) {
            setHomeReferences(references);
            setVideoInput(Boolean(saved.videoInput));
            setImageKey(saved.videoInput ? null : (saved.imageKey ?? references[0].key));
            setFileName(saved.fileName ?? references[0].name);
            setPreview(saved.preview ?? references[0].url);
            void currentUploadUrls().then((urls) => {
              setHomeReferences((items) => items.map((item) => ({ ...item, url: urls.get(item.key) ?? item.url })));
              setPreview((current) => current === (saved.preview ?? references[0].url) ? (urls.get(saved.imageKey ?? references[0].key) ?? current) : current);
            });
          }
        }
      } catch { /* An unavailable draft does not block the studio. */ }
    }
    setMediaDraftReady(true);
  }, [sessionLoading, optionsReady, handoffReady, homeHandoffToken, mediaDraftKey]);

  useCreditReturnDraft(draftScope, () => ({ settings, catalogModelId, imageKey, fileName, preview, homeReferences, videoInput, keyframeMode, frames }), (saved) => {
    if (initialKeyframes && !saved.keyframeMode) return;
    if (saved.keyframeMode && session?.user?.id && saved.catalogModelId === KLING_KEYFRAME_MODEL) {
      const restored = parseStudioFrames(JSON.stringify({ ownerId: session.user.id, ...saved.frames }), session.user.id);
      if (restored) { setFrames(restored); setKeyframeMode(true); setFramesReady(true); }
    }
    if (saved.settings && availableModelIds.includes(saved.settings.modelId)) setSettings(saved.settings);
    if (saved.catalogModelId) setCatalogModelId(saved.catalogModelId);
    setVideoInput(Boolean(saved.videoInput || saved.homeReferences?.some((item: UploadedVideoReference) => item.mimeType?.startsWith("video/"))));
    setImageKey(saved.imageKey ?? null);
    setFileName(saved.fileName ?? null);
    setPreview(saved.preview ?? null);
    setHomeReferences(Array.isArray(saved.homeReferences) ? saved.homeReferences : []);
    void currentUploadUrls().then((urls) => {
      setHomeReferences((items) => items.map((item) => ({ ...item, url: urls.get(item.key) ?? item.url })));
      if (saved.imageKey) setPreview((current) => urls.get(saved.imageKey!) ?? current);
    });
  }, () => {
    if (!homeHandoffToken) return false;
    try { return JSON.parse(sessionStorage.getItem(AUTOSTART_STORAGE_KEY) || "null")?.token === homeHandoffToken; }
    catch { return false; }
  });

  useEffect(() => {
    if (!mediaDraftReady) return;
    try {
      if (homeReferences.length) sessionStorage.setItem(mediaDraftKey, JSON.stringify({ references: homeReferences, videoInput, imageKey, fileName, preview }));
      else sessionStorage.removeItem(mediaDraftKey);
    } catch { /* Storage is optional. */ }
  }, [mediaDraftReady, mediaDraftKey, homeReferences, videoInput, imageKey, fileName, preview]);

  // Show earlier generations only when signed in (avoids 401 noise for guests).
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchRecentResults().then((history) => {
      if (cancelled || history.length === 0) return;
      setResults((previous) => mergeResults(previous, history));
      // Returning users see their clips first, not the introduction.
      setActiveTab("History");
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
    if (keyframeMode && id !== KLING_KEYFRAME_MODEL) return;
    if (id !== catalogModelId) mediaSelectionRevision.current += 1;
    if (id !== "wan2.6" && videoInput) { clearSelectedMedia(); setVideoInput(false); }
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

  const currentDraft = useRef({ settings, frames, homeReferences, imageKey, catalogModelId });
  currentDraft.current = { settings, frames, homeReferences, imageKey, catalogModelId };

  // One request at a time, whether it came from the button or from autostart:
  // the lock is taken before anything is awaited, so a double click or an
  // autostart landing during a click cannot send a second, separately charged
  // request.
  const inFlight = useRef(false);

  async function handleGenerate(presetKey?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await generateOnce(presetKey);
    } finally {
      setPendingSubmission(null);
      inFlight.current = false;
    }
  }

  async function generateOnce(presetKey?: string) {
    // Pressing Generate yourself takes over from a pending homepage autostart:
    // its token is used up and leaves the address.
    if (!presetKey && !autostartDone.current) {
      autostartDone.current = true;
      const url = new URL(window.location.href);
      const token = url.searchParams.get("autostart");
      if (token) {
        claimAutostart(token, sessionStorage);
        url.searchParams.delete("autostart");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      }
    }
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

    if (keyframeMode && (catalogModelId !== KLING_KEYFRAME_MODEL || !validFrameCount(frames, settings.duration))) {
      setNotice(isChinese ? `请为本次视频选择 1 至 ${maxKlingFrames(settings.duration)} 帧。` : `Choose 1–${maxKlingFrames(settings.duration)} frames for this clip.`);
      return;
    }
    if (videoInput && (catalogModelId !== "wan2.6" || !homeReferences.length || homeReferences.length > WAN_REFERENCE_MAX_FILES ||
      homeReferences.some(item => !isWanVideoMime(item.mimeType ?? "") || !session?.user?.id || !item.key.startsWith(`uploads/${session.user.id}/`)))) {
      setNotice(isChinese ? "请选择 1 至 3 个自己上传的 MP4 或 MOV 视频，每个不超过 10 MB。" : "Select 1–3 of your uploaded MP4 or MOV videos, up to 10 MB each.");
      return;
    }
    if (!videoInput && homeReferences.length > maxVideoReferences(catalogModelId)) {
      const limit = maxVideoReferences(catalogModelId);
      setNotice(isChinese ? `当前模型最多使用 ${limit} 张参考图，请先移除多余图片。` : `This model accepts up to ${limit} reference images. Remove the extras first.`);
      return;
    }
    const preparedPrompt = keyframeMode ? prepareKeyframePrompt(settings.prompt, frames)
      : prepareVideoReferencePrompt(settings.prompt, homeReferences.length || (imageKey ? 1 : 0), videoInput ? "video" : "image", catalogModelId);
    if (!preparedPrompt.ok) {
      setNotice(isChinese ? `第 ${preparedPrompt.index} 个引用与当前素材不匹配，请重新选择引用` : `Reference ${preparedPrompt.index} does not match your selected media. Select the reference again.`);
      return;
    }
    const inputNotice = keyframeMode || videoInput ? null
      : // Checked as sent: a camera preset adds its own sentence.
      marketInputNotice(catalogModelId, { prompt: promptWithPreset(preparedPrompt.prompt, settings.preset), imageCount: startImageCount }, isChinese);
    if (inputNotice) {
      setNotice(inputNotice);
      promptRef.current?.focus();
      return;
    }
    const imageNotice = keyframeMode || videoInput ? null : await marketImageNotice(catalogModelId,
      homeReferences.length ? homeReferences : imageKey ? [{ url: preview, name: fileName }] : [], isChinese);
    if (imageNotice) {
      setNotice(imageNotice);
      return;
    }

    // Signed in and the balance does not cover this clip: say so, with the
    // cost and the balance, before anything is sent.
    if (shortBy > 0 && available !== null) {
      const message = isChinese
        ? `积分不够：这条视频需要 ${num(exampleCredits)} 积分，你目前还有 ${num(available)} 积分`
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

    setPendingSubmission((current) => current ?? {
      id: `submitting:${crypto.randomUUID()}`, status: "submitting", prompt: settings.prompt.trim(),
      model: catalogModelId, createdAt: Date.now(),
    });
    setActiveTab("History");
    setSubmitting(true);
    setNotice(null);

    // A request whose answer was lost (network error) is sent again under the
    // same key when nothing changed, so the server answers with the task it
    // may already have created instead of charging a second time.
    const requestedSettings = videoInput ? { ...settings, audio: true, aspect: undefined } : settings;
    const keyframeKeys = keyframeMode ? frameKeys(frames) : undefined;
    const signature = keyframeKeys
      ? JSON.stringify([settings.modelId, settings.duration, settings.resolution, settings.preset, preparedPrompt.prompt, keyframeKeys])
      : JSON.stringify([requestedSettings, preparedPrompt.prompt, homeReferences.map((item) => item.key), imageKey, videoInput]);
    try {
      // Keep the exact role assignment and normalized settings on a manual refresh after a lost answer.
      if (keyframeKeys && session?.user?.id) {
        sessionStorage.setItem(STUDIO_KEYFRAME_STORAGE, JSON.stringify({ ownerId: session.user.id, ...frames }));
        const url = new URL(window.location.href);
        url.searchParams.set("model", KLING_KEYFRAME_MODEL);
        url.searchParams.set("input", "keyframes");
        url.searchParams.set("prompt", settings.prompt);
        url.searchParams.set("duration", String(settings.duration));
        url.searchParams.set("resolution", settings.resolution);
        url.searchParams.delete("aspect"); url.searchParams.delete("audio");
        if (settings.preset) url.searchParams.set("preset", settings.preset); else url.searchParams.delete("preset");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
      }
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));
      const signatureId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      const storageKey = `aivd:pending-video:${session?.user?.id ?? ""}:${signatureId}`;
      let idempotencyKey: string;
      let recoveringRequest = false;
      try {
        const storedKey = sessionStorage.getItem(storageKey);
        recoveringRequest = Boolean(storedKey);
        idempotencyKey = storedKey || presetKey || crypto.randomUUID();
        sessionStorage.setItem(storageKey, idempotencyKey);
      } catch {
        setNotice(isChinese ? "浏览器无法保存任务编号，请允许本网站使用会话存储后再试。" : "Allow session storage for this site to save the request before submitting.");
        return;
      }
      const keys = homeReferences.map(item => item.key);
      const result = await submitGeneration(
        { ...settings, prompt: preparedPrompt.prompt }, idempotencyKey, fetch,
        keyframeMode || videoInput ? null : keys.length ? keys : imageKey, videoInput ? keys : [], session?.user?.id, keyframeKeys,
      );
      // A rejection during recovery cannot tell us what happened to the original attempt.
      if (result.ok || (!recoveringRequest && result.code && result.code !== "NETWORK")) sessionStorage.removeItem(storageKey);

      if (!mounted.current) return;
      if (!result.ok) {
        setNotice(result.code === "NETWORK" ? isChinese ? "尚未收到生成结果。再次提交会使用同一个任务编号。" : "No response yet. Retrying will reuse the same request." : errorMessage(result.code, result.message, isChinese));
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
          // The camera preset comes back too, or the prompt would lose it.
          if (settings.preset) params.set("preset", settings.preset);
          if (keyframeMode) params.set("input", "keyframes");
          signIn.onOpenWithRedirect(`${window.location.pathname}?${params}`);
        }
        return;
      }

      const submitted = buildGenerateRequest(
        { ...settings, prompt: preparedPrompt.prompt }, idempotencyKey,
        keyframeMode || videoInput ? null : keys.length ? keys : imageKey,
        videoInput ? keys : [], keyframeKeys,
      );
      const submittedParameters = submitted.ok
        ? Object.fromEntries(Object.entries(submitted.body).filter(([key]) => key !== "prompt" && key !== "idempotencyKey"))
        : undefined;
      setResults((previous) => [
        {
          id: result.videoUuid ?? result.taskId ?? `clip-${previous.length + 1}`,
          status: "queued",
          videoUuid: result.videoUuid,
          prompt: settings.prompt.trim(),
          model: catalogModelId,
          parameters: submittedParameters,
          createdAt: Date.now(),
        },
        ...previous,
      ]);
      setNotice(null);
      if (homeHandoffToken && session?.user?.id) {
        try {
          clearSubmittedHomePrompt(sessionStorage, [localStorage, sessionStorage], {
            token: homeHandoffToken, kind: "video", owner: session.user.id, prompt: settings.prompt.trim(),
          });
        } catch { /* Draft storage is optional. */ }
      }
      const live = currentDraft.current;
      // Other settings may have changed while the request was running; clear
      // the submitted prompt unless the user has already started a new one.
      if (live.settings.prompt === settings.prompt) draft.discard();
      if (
        live.settings === settings &&
        live.frames === frames &&
        live.homeReferences === homeReferences &&
        live.imageKey === imageKey &&
        live.catalogModelId === catalogModelId
      ) {
        clearSelectedMedia();
        if (keyframeMode) {
          setFrames({});
          sessionStorage.removeItem(STUDIO_KEYFRAME_STORAGE);
        }
      }

      setActiveTab("History");
    } catch {
      setNotice(isChinese ? "暂时无法确认任务状态，请查看历史记录后重试。" : "The task status is unavailable. Check History before retrying.");
    } finally {
      setSubmitting(false);
    }
  }

  // Signed out, Generate opens sign-in straight away, as on the reference,
  // and brings the visitor back here with the prompt and settings filled in
  // (the same return address the server's "sign in first" answer leads to).
  // Nothing is sent, so nothing can be charged.
  function signInToGenerate() {
    const params = new URLSearchParams({
      prompt: settings.prompt.trim(),
      model: catalogModelId,
      duration: String(settings.duration),
      aspect: settings.aspect,
      resolution: settings.resolution,
      audio: String(settings.audio),
    });
    if (settings.preset) params.set("preset", settings.preset);
    if (keyframeMode) params.set("input", "keyframes");
    signIn.onOpenWithRedirect(`${window.location.pathname}?${params}`);
  }
  const startGenerate = () => {
    if (signedOut) {
      signInFromGenerate.current = true;
      signInToGenerate();
    } else void handleGenerate();
  };
  // Closing that sign-in without signing in puts focus back on Generate.
  const generateRef = useRef<HTMLButtonElement>(null);
  const signInFromGenerate = useRef(false);
  const signInOpen = signIn.isOpen;
  useEffect(() => {
    if (signInOpen || !signInFromGenerate.current) return;
    signInFromGenerate.current = false;
    // After the dialog's exit (--m-base), once it has let go of focus.
    const timer = setTimeout(() => {
      if (!document.activeElement || document.activeElement === document.body) generateRef.current?.focus({ preventScroll: true });
    }, 360);
    return () => clearTimeout(timer);
  }, [signInOpen]);

  // "Generate" on the homepage arrives with ?autostart=<token> and starts that
  // generation here, so the visitor does not press Generate twice (see
  // lib/autostart). It waits for the session, the handed-over references and,
  // briefly, the balance; claims the one-time token (a reload, Back or a second
  // tab has none); drops it from the address; and uses it as the idempotency
  // key. Every check in handleGenerate still applies.
  const [autostartWaited, setAutostartWaited] = useState(false);
  useEffect(() => {
    const short = setTimeout(() => setAutostartWaited(true), 2000);
    const long = setTimeout(() => setSessionWaited(true), 8000);
    return () => {
      clearTimeout(short);
      clearTimeout(long);
    };
  }, []);
  useEffect(() => {
    if (autostartDone.current) return;
    const url = new URL(window.location.href);
    const token = url.searchParams.get("autostart");
    if (!token) {
      autostartDone.current = true;
      setPendingSubmission(null);
      return;
    }
    // Right after a client-side navigation the session can read "not signed
    // in" for a moment: wait for it (or the short timeout) before deciding.
    if (sessionLoading || (!session && !sessionWaited) || !handoffReady) return;
    if (keyframeMode && !framesReady) return;
    if (session && !balance && !autostartWaited) return;
    autostartDone.current = true;
    url.searchParams.delete("autostart");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    if (session && claimAutostart(token, sessionStorage)) void handleGenerate(`autostart:${token}`);
    else setPendingSubmission(null);
  }, [sessionLoading, session, balance, homeReferences, keyframeMode, framesReady, handoffReady, autostartWaited, sessionWaited]);

  const coverModelId = selectedModelConnected ? catalogModelId : "";
  const bannerName = upcoming?.name ?? (selectedModelConnected ? model.name : (catalogEntry?.name ?? model.name));
  const navEntry = findNavModel("video", catalogModelId);
  const bannerSub =
    upcoming?.desc ??
    (selectedModelConnected
      ? (copy.modelTaglines[model.id] ?? (model.tagline || (navEntry ? (isChinese ? navEntry.desc.zh : navEntry.desc.en) : "")))
      : (catalogEntry ? catalogDetail(catalogEntry) : ""));
  // Some models (Grok Imagine 1.5 on KIE) only run from a start image.
  const startImageCount = homeReferences.length || (imageKey ? 1 : 0);
  const needsStartImage = Boolean(getMarketModel(catalogModelId)?.options.requiresImage) && startImageCount === 0;
  // Vidu Q4 from one picture keeps that picture's ratio; the choice only applies to two or more.
  const aspectFollowsImage = Boolean(getMarketModel(catalogModelId)?.options.aspectFollowsSingleImage) && startImageCount === 1;
  const modelCover = MODEL_COVERS[coverModelId] ?? "/home/samples/cosmic-bloom.webp";
  const generateDisabled =
    submitting || uploading || availableModels.length === 0 || !selectedModelConnected || needsStartImage || (keyframeMode && !validFrameCount(frames, settings.duration));
  const maxReferences = videoInput ? WAN_REFERENCE_MAX_FILES : MAX_HOME_REFERENCES;

  async function selectMedia(items: PickerAsset[]) {
    if (videoInput && !session?.user?.id) { signIn.onOpen(); return; }
    const revision = ++mediaSelectionRevision.current;
    setUploading(true);
    setNotice(null);
    try {
      const assets = videoInput ? await Promise.all(items.map(item => readyPickerVideo(item, session!.user.id))) : await Promise.all(items.map(item => readyPickerImage(item, session?.user?.id)));
      if (revision !== mediaSelectionRevision.current) return;
      const references = [...new Map(assets.map(item => [item.key, item])).values()].map((item) => ({
        ...item,
        sourceId: item.sourceId.startsWith("direct:") ? `upload:${item.key}` : item.sourceId,
      }));
      sessionStorage.setItem("aivd:home-video-references", JSON.stringify(references));
      if (session?.user?.id) sessionStorage.setItem("aivd:home-video-reference-owner", session.user.id);
      setHomeReferences(references);
      setFileName(references[0]?.name ?? null);
      setImageKey(videoInput ? null : references[0]?.key ?? null);
      setPreview(references[0]?.url ?? null);
    } catch (error) { setNotice(uploadErrorText(error, isChinese)); }
    finally { setUploading(false); }
  }
  // A delete in the library finishes later: it works on the references as they
  // are now, not as they were when the delete started.
  const latestMedia = useRef({ homeReferences, imageKey });
  latestMedia.current = { homeReferences, imageKey };
  const removeHomeReference = (index: number) => {
    const remaining = latestMedia.current.homeReferences.filter((_, itemIndex) => itemIndex !== index);
    setHomeReferences(remaining);
    if (remaining.length) sessionStorage.setItem("aivd:home-video-references", JSON.stringify(remaining));
    else sessionStorage.removeItem("aivd:home-video-references");
    setImageKey(videoInput ? null : remaining[0]?.key ?? null);
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
    setSettings((current) => ({ ...current, prompt: current.prompt.replace(/@(?:图片|image|视频|video)\d+/gi, "") }));
  };
  const drop = useImageDrop((files) => void selectMedia(files.slice(0, maxReferences).map((file) => ({ id: `direct:${crypto.randomUUID()}`, name: file.name, mimeType: file.type, url: "", file }))), tool === "create" && !extendMode && !keyframeMode && !uploading && maxReferences > 0, videoInput ? isWanVideoMime : undefined);

  // The images shown in the reference block and offered by "@ Elements": the
  // attached references, or the single start frame handed over from the
  // homepage.
  const referenceThumbs: ReferenceThumb[] = keyframeMode
    ? frameReferences(frames).map((item, index) => ({ ...item, key: `${index}:${item.key}` }))
    : homeReferences.length
    ? homeReferences.map((item) => ({ key: item.key, url: item.url, name: item.name, video: isWanVideoMime(item.mimeType ?? "") }))
    : imageKey && preview
      ? [{ key: imageKey, url: preview, name: fileName ?? (isChinese ? "参考图片" : "Reference image") }]
      : [];

  // A click on a reference thumbnail mentions it where the cursor was.
  const mentionReference = (index: number) => {
    const field = promptRef.current;
    const token = referenceToken(index, isChinese, videoInput);
    const start = field?.selectionStart ?? settings.prompt.length;
    const end = field?.selectionEnd ?? start;
    const next = insertToken(settings.prompt, token, start, end);
    setSettings((previous) => ({ ...previous, prompt: next.text }));
    requestAnimationFrame(() => {
      const target = promptRef.current;
      if (!target) return;
      target.focus();
      target.setSelectionRange(next.caret, next.caret);
    });
  };

  // The viewer hands focus back to the card it was opened from.
  const viewerReturn = useRef<HTMLElement | null>(null);
  const openViewer = (position: number) => {
    viewerReturn.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setViewing(position);
  };
  const closeViewer = () => {
    setViewing(null);
    requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) viewerReturn.current?.focus({ preventScroll: true });
    });
  };

  const reuse = (text: string | null | undefined) => {
    if (!text) return;
    setSettings((previous) => ({ ...previous, prompt: text }));
    promptRef.current?.focus();
  };
  const reuseParameters = (item: ViewerItem) => {
    const params = item.parameters ?? {};
    const id = item.modelId ?? (typeof params.model === "string" ? params.model : "");
    const next = STUDIO_MODELS.find((entry) => entry.id === id && entry.available && availableModelIds.includes(id));
    if (!next) {
      setNotice(isChinese ? "该模型已不可用，无法复用参数。" : "This model is no longer available, so its settings can't be reused.");
      return;
    }
    if (keyframeMode && id !== KLING_KEYFRAME_MODEL) {
      setKeyframeMode(false);
      setFrames({});
      setCatalogModelId(id);
      setUpcoming(undefined);
      setDurationOpen(false);
    } else switchModel(id);
    setSettings((previous) => {
      const selected = selectModel(previous, id);
      const duration = typeof params.duration === "number" ? params.duration : Number(params.duration);
      const aspect = params.aspectRatio;
      const resolution = params.resolution ?? params.quality;
      const audio = params.audio ?? params.generateAudio;
      return {
        ...selected,
        duration: next.durations.includes(duration) ? duration : selected.duration,
        aspect: typeof aspect === "string" && next.aspects.includes(aspect) ? aspect : selected.aspect,
        resolution: typeof resolution === "string" && next.resolutions.includes(resolution) ? resolution : selected.resolution,
        audio: next.audio && typeof audio === "boolean" ? audio : selected.audio,
        preset: typeof params.preset === "string" ? params.preset : undefined,
      };
    });
    setNotice(null);
    setActiveTab("History");
    promptRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  };

  const gallery = useMemo<ViewerItem[]>(
    () =>
      results
        .filter((item) => item.status === "completed" && item.videoUrl)
        .map((item) => ({
          key: item.id, url: item.videoUrl as string, kind: "video" as const, prompt: item.prompt ?? "", sourceUuid: item.videoUuid ?? undefined,
          model: VIDEO_CATALOG.find(model => model.id === item.model)?.name ?? getMarketModel(item.model ?? "")?.name ?? item.model,
          modelId: item.model,
          parameters: item.parameters,
        })),
    [results],
  );
  const shownResults = [...(pendingSubmission ? [pendingSubmission] : []), ...pendingTools, ...matchingVideos(results, historyFilter, Date.now())];
  const filterModels = [...new Set([...availableModelIds, ...results.flatMap(item => item.model ? [item.model] : [])])]
    .map(id => ({ id, name: VIDEO_CATALOG.find(item => item.id === id)?.name ?? getMarketModel(id)?.name ?? id }));
  const clearFilters = () => setHistoryFilter(INITIAL_FILTER);
  const trackToolPending = (id: string, prompt?: string) => {
    setPendingTools((current) => prompt === undefined
      ? current.filter((item) => item.id !== `submitting:${id}`)
      : [{ id: `submitting:${id}`, status: "submitting", prompt, createdAt: Date.now() }, ...current]);
    if (prompt !== undefined) { setActiveTab("History"); clearFilters(); }
  };
  const activeFilters = [
    ...(historyFilter.model ? [{ key: "model", name: filterModels.find(item => item.id === historyFilter.model)?.name ?? historyFilter.model, clear: () => setHistoryFilter(current => ({ ...current, model: "" })) }] : []),
    ...(historyFilter.range !== "all" ? [{ key: "range", name: rangeName(historyFilter.range, isChinese), clear: () => setHistoryFilter(current => ({ ...current, range: "all", dates: undefined })) }] : []),
    ...(historyFilter.hideFailed ? [{ key: "hide", name: isChinese ? "隐藏失败项" : "Hide failed", clear: () => setHistoryFilter(current => ({ ...current, hideFailed: false })) }] : []),
  ];
  const noMatch = activeFilters.length > 0 && shownResults.length === 0;
  const historyKey = activeTab === "How it works" ? "how" : noMatch ? "none" : shownResults.length ? "results" : "intro";
  const activePreset = findVideoPreset(settings.preset);
  // Effects from the effects page arrive as a preset id; show their name.
  const effectTemplate = settings.preset && !activePreset ? EFFECT_TEMPLATES.find((item) => item.id === settings.preset) : undefined;
  const effectName = effectTemplate ? labelFor(effectTemplate.name, locale) : null;
  const presetTitle = effectName
    ?? (activePreset ? (isChinese ? activePreset.zh : activePreset.en) : settings.preset ? settings.preset : isChinese ? "通用" : "General");
  const presetCover = effectTemplate?.image ?? activePreset?.image ?? modelCover;

  const presetCardRef = useRef<HTMLButtonElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  // The model list returns focus to its own hidden anchor when it closes;
  // hand it back to the model card the visitor actually pressed.
  const pickerWasOpen = useRef(false);
  useEffect(() => {
    if (pickerWasOpen.current && !pickerOpen) {
      requestAnimationFrame(() => {
        if (document.activeElement?.getAttribute("aria-hidden") === "true") modelButtonRef.current?.focus({ preventScroll: true });
      });
    }
    pickerWasOpen.current = pickerOpen;
  }, [pickerOpen]);

  const durationWarning = !durationSupported && durationOptions.length
    ? isChinese
      ? `${model.name} 当前支持 ${durationLabel(durationOptions)} 秒，请调整时长后再生成。`
      : `${model.name} currently supports ${durationLabel(durationOptions, ", ")} seconds. Adjust the length before generating.`
    : null;

  return (
    <div className="vs-root vst-root" onPaste={drop.bind.onPaste}>
      <HomeMediaPicker
        lang={locale}
        open={mediaPickerOpen}
        initialTab={mediaTab}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(items) => void selectMedia(items)}
        onDelete={(id) => {
          const { homeReferences: current, imageKey: currentKey } = latestMedia.current;
          const index = current.findIndex((item) => (item.sourceId ?? `upload:${item.key}`) === id);
          if (index >= 0) removeHomeReference(index);
          else if (currentKey && id === `upload:${currentKey}`) clearSelectedMedia();
        }}
        acceptedTypes={videoInput ? ["video"] : ["image"]}
        wanVideoOnly={videoInput}
        maxSelected={maxReferences}
        selectedIds={homeReferences.map((item) => item.sourceId ?? `upload:${item.key}`)}
        userId={session?.user?.id}
      />
      <aside aria-label={copy.settings} className="vst-panel">
        <div className="vst-panel-head">
          <div className="vtool-tabs" role="group" aria-label={isChinese ? "视频工作流" : "Video workflow"}>
            {([
              ["create", isChinese ? "创建视频" : "Create video"],
              ["edit", isChinese ? "编辑视频" : "Edit video"],
              ["motion", "Motion Control"],
            ] as const).map(([mode, label]) => (
              <button type="button" key={mode} aria-pressed={tool === mode} onClick={() => chooseMode(mode)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="vst-panel-scroll">
          {(["edit", "motion"] as const).filter((item) => visitedTools.includes(item)).map((item) => (
            <div key={item} className="vtool-mode-pane" hidden={tool !== item}>
              <VideoToolPanel
                kind={item}
                active={tool === item}
                locale={locale}
                owner={session?.user?.id}
                enabled={canUseGeneration}
                free={internalFree}
                onExtend={() => chooseMode("create", true)}
                onPending={trackToolPending}
                onStarted={(uuid, prompt) => {
                  if (!mounted.current) return;
                  setResults((prev) => [{ id: uuid, videoUuid: uuid, prompt, status: "queued", createdAt: Date.now() }, ...prev]);
                  setActiveTab("History");
                  clearFilters();
                }}
              />
            </div>
          ))}
          <div className="vtool-create-body" hidden={tool !== "create"}>
          {extendMode ? (
            <div className="vst-preset-card vst-extend-cover">
              <img className="vst-preset-cover" src="/home/samples/red-carpet.webp" alt="" />
              <span className="vst-preset-shade" aria-hidden="true" />
              <span className="vst-preset-text">
                <span className="vst-preset-name">{isChinese ? "延长视频" : "Extend video"}</span>
                <span className="vst-preset-model">PixVerse V6</span>
              </span>
            </div>
          ) : (
          <PresetCard
            buttonRef={presetCardRef}
            cover={presetCover}
            title={presetTitle}
            model={bannerName}
            changeLabel={copy.change}
            label={isChinese ? `镜头预设：${presetTitle}，模型：${bannerName}。点击更换预设` : `Camera preset: ${presetTitle}, model: ${bannerName}. Click to change the preset`}
            open={presetsOpen}
            onToggle={() => setPresetsOpen((open) => !open)}
          />
          )}
        <fieldset className="vst-create-mode" aria-label={isChinese ? "视频工具" : "Video tool"}>
          <button type="button" aria-pressed={!extendMode} onClick={() => chooseMode("create",false)}>{isChinese ? "全能参考" : "References"}</button>
          <button type="button" disabled={uploading || submitting} aria-pressed={extendMode} onClick={() => chooseMode("create",true)}>{isChinese ? "延长视频" : "Extend video"}</button>
        </fieldset>
        <div className="vtool-extend-body" hidden={!extendMode}><ExtendPanel
          key={session?.user?.id ?? "guest"}
          locale={locale} source={extendSource} onSource={changeExtendSource} generationEnabled={canUseGeneration} freeGeneration={internalFree}
          onPending={trackToolPending}
          onStarted={job => {
            setResults(previous => [{ id: job.uuid, videoUuid: job.uuid, status: "queued", prompt: job.prompt, createdAt: Date.now() }, ...previous]);
            setActiveTab("History");
            clearFilters();
          }}
        /></div>
        {!extendMode && <>
          {catalogModelId === "wan2.6" ? (
            <fieldset className="vst-reference-modes" aria-label={isChinese ? "参考素材类型" : "Reference type"}>
              {[false, true].map(video => (
                <button type="button" key={String(video)} aria-pressed={videoInput === video} disabled={uploading}
                  onClick={() => {
                    if (video === videoInput) return;
                    clearSelectedMedia();
                    setNotice(null);
                    setVideoInput(video);
                  }}>{video ? isChinese ? "视频参考" : "Video reference" : isChinese ? "图像参考" : "Image reference"}</button>
              ))}
            </fieldset>
          ) : null}
          {catalogModelId === KLING_KEYFRAME_MODEL ? <fieldset className="vst-reference-modes" aria-label={isChinese ? "输入类型" : "Input type"}>
            {[false, true].map(enabled => <button type="button" key={String(enabled)} aria-pressed={keyframeMode === enabled} disabled={uploading || submitting}
              onClick={() => {
                if (keyframeMode === enabled) return;
                clearSelectedMedia(); setKeyframeMode(enabled); setFramesReady(true); setFrames({});
                sessionStorage.removeItem(STUDIO_KEYFRAME_STORAGE);
                const url = new URL(window.location.href);
                if (enabled) {
                  setSettings(previous => ({ ...previous, duration: 10, resolution: "1080p" }));
                  url.searchParams.set("input", "keyframes"); url.searchParams.set("model", KLING_KEYFRAME_MODEL);
                  url.searchParams.set("duration", "10"); url.searchParams.set("resolution", "1080p");
                  url.searchParams.delete("aspect"); url.searchParams.delete("audio");
                }
                else url.searchParams.delete("input");
                window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
              }}>{enabled ? isChinese ? "关键帧" : "Keyframes" : isChinese ? "图像参考" : "Image references"}</button>)}
          </fieldset> : null}
          {keyframeMode ? <KeyframeInput frames={frames} duration={settings.duration} locale={locale} userId={session?.user?.id} onChange={changeFrames}
            onBusy={setUploading} onError={setNotice} signIn={signInToGenerate} /> : <ReferenceBlock
            video={videoInput}
            zh={isChinese}
            references={referenceThumbs}
            max={maxReferences}
            uploading={uploading}
            dropOver={drop.over}
            dropBind={drop.bind}
            onOpen={() => openMedia("upload")}
            onMention={mentionReference}
            onRemove={(index) => (homeReferences.length ? removeHomeReference(index) : clearSelectedMedia())}
          />}

          <PromptCard
            zh={isChinese}
            value={settings.prompt}
            maxLength={promptMaxLength}
            placeholder={copy.promptPlaceholder}
            textareaRef={promptRef}
            onChange={(text) => {
              setSettings((previous) => ({ ...previous, prompt: text }));
              if (notice) setNotice(null);
            }}
            onSubmit={() => {
              // ⌘/Ctrl+Enter generates, the same shortcut as the image studio.
              if (!generateDisabled) startGenerate();
            }}
            references={referenceThumbs}
            canReference={keyframeMode ? Boolean(frameCount) : maxReferences > 0}
            showLibraryLink={!keyframeMode}
            onOpenMedia={openMedia}
            audio={!keyframeMode && !videoInput && model.audio ? { on: settings.audio, onToggle: () => setSettings((previous) => ({ ...previous, audio: !previous.audio })) } : undefined}
            draftRestored={draft.restored}
            onDiscardDraft={draft.discard}
          />

          <div className="vst-model">
            <KieModelPicker
              kind="video"
              locale={locale}
              value={catalogModelId}
              connectedIds={availableModelIds}
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              placement="card"
              catalogSet="current"
              glass
              label={copy.model}
              valueLabel={upcoming?.name}
              hideTrigger
              onChange={switchModel}
            />
            <button
              ref={modelButtonRef}
              disabled={keyframeMode}
              type="button"
              className="vst-card vst-card-button"
              aria-expanded={pickerOpen}
              aria-haspopup="true"
              aria-label={`${copy.chooseModel}：${bannerName}`}
              title={bannerSub || undefined}
              // The list closes itself on any press outside it; a press on
              // this card while it is open should close it, not reopen it.
              // React listens on the document too (it is the root here), so
              // only stopping the remaining listeners there keeps the list's
              // own outside-press handler from firing first.
              onPointerDown={(event) => {
                if (pickerOpen) event.nativeEvent.stopImmediatePropagation();
              }}
              onClick={() => setPickerOpen((open) => !open)}
            >
              <CardFace label={copy.model} value={bannerName} chevron />
            </button>
          </div>

          <div className="vst-grid">
            <DurationCard
              label={copy.duration}
              value={settings.duration}
              options={durationOptions}
              emptyValue={copy.sourceClip}
              fixedNote={
                durationOptions.length
                  ? isChinese ? `${model.name} 只支持 ${settings.duration} 秒` : `${model.name} only makes ${settings.duration}s clips`
                  : isChinese ? "这个模型沿用原片的时长" : "This model keeps the length of the source clip"
              }
              warning={durationWarning}
              open={durationOpen}
              onOpenChange={setDurationOpen}
              onChange={(seconds) => {
                setSettings((previous) => ({ ...previous, duration: closestDuration(durationOptions, seconds) }));
                setNotice(null);
              }}
            />
            {!videoInput && !keyframeMode ? <ChoiceCard
              label={copy.aspect}
              value={settings.aspect}
              options={aspectFollowsImage ? [settings.aspect] : widestFirst(model.aspects)}
              format={aspectFollowsImage ? () => (isChinese ? "跟随首图" : "From image") : undefined}
              fixedNote={aspectFollowsImage
                ? (isChinese ? "只用一张图片时，画幅跟随这张图片。加第二张参考图后可以选画幅。" : "With one image the clip keeps its ratio. Add a second reference to choose one.")
                : isChinese ? `${model.name} 只支持 ${settings.aspect}` : `${model.name} only makes ${settings.aspect}`}
              onChange={(aspect) => setSettings((previous) => ({ ...previous, aspect }))}
            /> : null}
            <ChoiceCard
              label={copy.resolution}
              className={videoInput || keyframeMode ? undefined : "vst-card-span"}
              value={settings.resolution}
              options={model.resolutions}
              fixedNote={isChinese ? `${model.name} 只支持 ${settings.resolution}` : `${model.name} only makes ${settings.resolution}`}
              onChange={(resolution) => setSettings((previous) => ({ ...previous, resolution }))}
            />
          </div>

          {videoInput ? <span className="vst-sound-note">{isChinese ? "生成的视频包含音轨" : "Output includes audio"}</span> : null}
          <div className="vst-footer">
            {durationWarning ? <output className="vst-notice">{durationWarning}</output> : null}
            {needsStartImage ? (
              <output className="vst-notice">
                {isChinese ? `${bannerName} 需要至少 1 张参考图片才能生成，` : `${bannerName} needs at least 1 reference image to generate — `}
                <button type="button" disabled={uploading} className="vst-notice-link" onClick={() => openMedia("upload")}>
                  {uploading ? (isChinese ? "上传中…" : "uploading…") : (isChinese ? "立即添加" : "add one now")}
                </button>
              </output>
            ) : null}
            {selectedModelConnected ? null : (
              <output className="vst-notice">
                {isChinese ? `${bannerName} 暂未开放，先试试现在能用的模型：` : `${bannerName} isn't available yet. Try one of these:`}
                <span className="vst-notice-actions">
                  {availableModels.slice(0, 3).map((item) => (
                    <button key={item.id} type="button" className="cu-get cu-get-alt" onClick={() => switchModel(item.id)}>
                      {item.name}
                    </button>
                  ))}
                </span>
              </output>
            )}
            {notice ? (
              <output key={notice} data-presence="fade" aria-live="polite" className="vst-notice">
                {notice}
                {creditsShortfall.isShortfall(notice) ? (
                  <span className="vst-notice-actions">
                    {affordable ? (
                      <button type="button" className="cu-get cu-get-alt" onClick={() => switchModel(affordable.id)}>
                        {isChinese ? `换成 ${affordable.name}（${num(affordable.credits)} 积分）` : `Switch to ${affordable.name} (${num(affordable.credits)} credits)`}
                      </button>
                    ) : null}
                    {creditsShortfall.action(notice)}
                  </span>
                ) : null}
              </output>
            ) : null}

            <button
              ref={generateRef}
              type="button"
              disabled={generateDisabled}
              onClick={startGenerate}
              aria-busy={submitting || undefined}
              className="vst-generate"
              title={internalFree ? (isChinese ? "内部测试账号免费" : "Free for internal test account") : selectedModelConnected ? copy.creditCostNote : copy.creditEstimateNote}
            >
              <span className="vst-generate-label">
                {submitting ? <Loader2 key="busy" data-swap className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {submitting ? copy.submit : copy.generate}
              </span>
              {selectedModelConnected ? (
                <span className="vst-generate-cost">
                  <Coins aria-hidden="true" />
                  {durationSupported ? <><span className="du-num">{internalFree ? 0 : num(exampleCredits)}</span>{isChinese ? " 积分" : " credits"}</> : "—"}
                </span>
              ) : null}
            </button>
            {available !== null && selectedModelConnected ? (
              <p className={shortBy ? "vst-balance vst-balance-short" : "vst-balance"}>
                {isChinese ? `余额 ${num(available)} 积分` : `Balance: ${num(available)} credits`}
                {shortBy ? (isChinese ? `，还差 ${num(shortBy)} 积分` : ` (${num(shortBy)} more needed)`) : null}
              </p>
            ) : null}
          </div>
        </>}
          </div>
        </div>
      </aside>

      <section aria-label={copy.results} className="vst-stage" data-library={presetsOpen || undefined}>
        <div className="vst-stage-bar">
          <StageTabs zh={isChinese} active={activeTab} count={results.length + pendingTools.length + (pendingSubmission ? 1 : 0)} onChange={setActiveTab} />
          {activeTab === "History" ? (
            <div className="vst-stage-tools">
              <FilterMenu zh={isChinese} filter={historyFilter} models={filterModels} onChange={setHistoryFilter} />
              <ViewMenu zh={isChinese} view={historyView} onChange={setHistoryView} />
            </div>
          ) : null}
        </div>
        {activeTab === "History" && activeFilters.length > 0 ? <ActiveFilters zh={isChinese} filters={activeFilters} onClear={clearFilters} /> : null}
        <div className="vst-stage-body" key={historyKey}>
          {activeTab === "How it works" ? (
            tool !== "create" || extendMode ? <ToolGuide kind={tool==="create" ? "extend" : tool} zh={isChinese}/> : <HowItWorks zh={isChinese} templatesHref={localizedHref(locale, "/templates")} />
          ) : noMatch ? (
            <NoMatches zh={isChinese} onClear={clearFilters} />
          ) : shownResults.length === 0 ? (
            // Nothing made yet: the introduction, as on the reference.
            tool !== "create" || extendMode ? <ToolGuide kind={tool==="create" ? "extend" : tool} zh={isChinese}/> : <HowItWorks zh={isChinese} templatesHref={localizedHref(locale, "/templates")} tip={false} />
          ) : (
            <ResultsGrid
              zh={isChinese}
              results={shownResults}
              gallery={gallery}
              view={historyView}
              onView={openViewer}
              onReuse={reuse}
              userId={session?.user?.id}
              onExtend={result => {
                const source = asExtendSource(result);
                if (!source) return;
                setPresetsOpen(false);
                changeExtendSource(source);
                chooseMode("create",true);
                requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(".xd-inline textarea")?.focus());
              }}
              onCanvas={(result) => {
                try {
                  sessionStorage.setItem(
                    "aivd:canvas-handoff",
                    JSON.stringify({ kind: "video", ownerId: session?.user?.id, url: result.videoUrl, prompt: result.prompt, model: filterModels.find(item => item.id === result.model)?.name ?? result.model, uuid: result.videoUuid ?? undefined, index: 0 }),
                  );
                } catch {
                  // Ignore storage errors.
                }
                window.location.assign(localizedHref(locale, "/creative-space/canvas"));
              }}
            />
          )}
        </div>
        <PresetLibrary
          open={presetsOpen}
          onClose={() => setPresetsOpen(false)}
          zh={isChinese}
          selected={settings.preset}
          onSelect={(id) => setSettings((previous) => ({ ...previous, preset: id }))}
          generalCover={modelCover}
          effect={effectTemplate ? { id: effectTemplate.id, name: effectName ?? effectTemplate.id, image: effectTemplate.image } : undefined}
          triggerRef={presetCardRef}
        />
      </section>
      {viewing !== null && gallery[viewing] ? (
        <MediaViewer
          items={gallery}
          index={viewing}
          zh={isChinese}
          onIndex={setViewing}
          onClose={closeViewer}
          onReuse={(item) => reuse(item.prompt)}
          onReuseParameters={reuseParameters}
          userId={session?.user?.id}
        />
      ) : null}
    </div>
  );
}
