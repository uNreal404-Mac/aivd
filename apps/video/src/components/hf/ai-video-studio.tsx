"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { localizedHref } from "@/lib/locale-path";

import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { useCreditReturnDraft } from "@/hooks/use-credit-return-draft";
import { currentUploadUrls } from "@/lib/home-media-library";
import { uploadErrorText } from "@/lib/image-to-video";
import { claimAutostart } from "@/lib/autostart";
import { readyPickerImage, type PickerAsset } from "@/lib/home-media-library";
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
import { findVideoPreset } from "@/lib/video-presets";
import { maxVideoReferences, prepareVideoReferencePrompt, removeVideoReferenceToken, type UploadedVideoReference } from "@/lib/video-references";
import { MediaViewer, useImageDrop, type ViewerItem } from "@/components/hf/studio-results";
import { PresetCard, PresetLibrary } from "@/components/hf/video-studio/presets";
import { ReferenceBlock, referenceToken, type ReferenceThumb } from "@/components/hf/video-studio/reference-block";
import { PromptCard, insertToken } from "@/components/hf/video-studio/prompt-card";
import { CardFace, ChoiceCard, DurationCard, widestFirst } from "@/components/hf/video-studio/setting-cards";
import { HowItWorks, StageTabs, type StageTab } from "@/components/hf/video-studio/stage";
import { ResultsGrid } from "@/components/hf/video-studio/history-view";
import { ActiveFilters, FilterMenu, NoMatches, ViewMenu, useHistoryView } from "@/components/hf/video-studio/history-tools";
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
    "video",
    settings.prompt,
    (text) => setSettings((previous) => ({ ...previous, prompt: text })),
    Boolean(initialSettings?.prompt),
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
  const autostartDone = useRef(false);
  // Signed in: the balance, so a clip it cannot pay for is caught before it
  // is sent and a model it can pay for is offered.
  const balance = useCreditsStore((state) => state.balance);
  const fetchBalance = useCreditsStore((state) => state.fetchBalance);
  useEffect(() => {
    if (session) void fetchBalance();
  }, [session, fetchBalance]);
  const [results, setResults] = useState<StudioResult[]>([]);
  const [submitting, setSubmitting] = useState(false);
  // First visit opens on how it works, as the reference does; returning users
  // land on their history once it loads.
  const [activeTab, setActiveTab] = useState<StageTab>("How it works");
  // History's Filter and View menus (stage bar, History tab only).
  const [hideFailed, setHideFailed] = useState(false);
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
  const quotedImages = homeReferences.length || (imageKey ? 1 : 0);
  const exampleCredits = selectedModelConnected
    ? estimateCredits(settings, { images: quotedImages, audio: settings.audio })
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
    return bestAffordableModel(modelOptions(settings, usable, referenceCount), catalogModelId, available);
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

  useCreditReturnDraft("video", () => ({ settings, catalogModelId, imageKey, fileName, preview, homeReferences }), (saved) => {
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
  });

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

  // One request at a time, whether it came from the button or from autostart:
  // the lock is taken before anything is awaited, so a double click or an
  // autostart landing during a click cannot send a second, separately charged
  // request.
  const inFlight = useRef(false);
  const lastAttempt = useRef<{ key: string; signature: string } | null>(null);

  async function handleGenerate(presetKey?: string) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await generateOnce(presetKey);
    } finally {
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

    if (homeReferences.length > maxVideoReferences(catalogModelId)) {
      const limit = maxVideoReferences(catalogModelId);
      setNotice(isChinese ? `当前模型最多使用 ${limit} 张参考图，请先移除多余图片。` : `This model accepts up to ${limit} reference images. Remove the extras first.`);
      return;
    }
    const preparedPrompt = prepareVideoReferencePrompt(settings.prompt, homeReferences.length || (imageKey ? 1 : 0));
    if (!preparedPrompt.ok) {
      setNotice(isChinese ? `找不到 @图片${preparedPrompt.index} 对应的参考图，请补传图片或删掉这个引用` : `No reference image for @Image${preparedPrompt.index}. Add one or remove it from the prompt.`);
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

    setSubmitting(true);
    setNotice(null);

    // A request whose answer was lost (network error) is sent again under the
    // same key when nothing changed, so the server answers with the task it
    // may already have created instead of charging a second time.
    const signature = JSON.stringify([settings, preparedPrompt.prompt, homeReferences.map((item) => item.key), imageKey]);
    const idempotencyKey =
      presetKey ??
      (lastAttempt.current?.signature === signature
        ? lastAttempt.current.key
        : typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : String(Date.now()));
    lastAttempt.current = { key: idempotencyKey, signature };

    try {
      const result = await submitGeneration({ ...settings, prompt: preparedPrompt.prompt }, idempotencyKey, fetch, homeReferences.length ? homeReferences.map((item) => item.key) : imageKey);
      // Only a lost answer keeps its key for a retry; anything else is final.
      if (result.ok || result.code !== "NETWORK") lastAttempt.current = null;

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
          // The camera preset comes back too, or the prompt would lose it.
          if (settings.preset) params.set("preset", settings.preset);
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
      setActiveTab("History");
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
  const [sessionWaited, setSessionWaited] = useState(false);
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
      return;
    }
    // Right after a client-side navigation the session can read "not signed
    // in" for a moment: wait for it (or the short timeout) before deciding.
    if (sessionLoading || (!session && !sessionWaited)) return;
    if (sessionStorage.getItem("aivd:home-video-references") && homeReferences.length === 0 && !autostartWaited) return;
    if (session && !balance && !autostartWaited) return;
    autostartDone.current = true;
    url.searchParams.delete("autostart");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
    if (session && claimAutostart(token, sessionStorage)) void handleGenerate(`autostart:${token}`);
  }, [sessionLoading, session, balance, homeReferences, autostartWaited, sessionWaited]);

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
  const modelCover = MODEL_COVERS[coverModelId] ?? "/home/samples/cosmic-bloom.webp";
  const generateDisabled =
    submitting || uploading || availableModels.length === 0 || !selectedModelConnected || needsStartImage;
  const maxReferences = maxVideoReferences(catalogModelId);

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
  const drop = useImageDrop((files) => void selectMedia(files.slice(0, maxReferences).map((file) => ({ id: `direct:${crypto.randomUUID()}`, name: file.name, mimeType: file.type, url: "", file }))), !uploading && maxReferences > 0);

  // The images shown in the reference block and offered by "@ Elements": the
  // attached references, or the single start frame handed over from the
  // homepage.
  const referenceThumbs: ReferenceThumb[] = homeReferences.length
    ? homeReferences.map((item) => ({ key: item.key, url: item.url, name: item.name }))
    : imageKey && preview
      ? [{ key: imageKey, url: preview, name: fileName ?? (isChinese ? "参考图片" : "Reference image") }]
      : [];

  // A click on a reference thumbnail mentions it where the cursor was.
  const mentionReference = (index: number) => {
    const field = promptRef.current;
    const token = referenceToken(index, isChinese);
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

  const gallery = useMemo<ViewerItem[]>(
    () =>
      results
        .filter((item) => item.status === "completed" && item.videoUrl)
        .map((item) => ({ key: item.id, url: item.videoUrl as string, kind: "video" as const, prompt: item.prompt ?? "" })),
    [results],
  );
  // History as the Filter menu leaves it: failed clips (and finished ones
  // that came back without a file) can be hidden.
  const shownResults = hideFailed
    ? results.filter((item) => item.status !== "failed" && !(item.status === "completed" && !item.videoUrl))
    : results;
  const historyKey =
    activeTab === "How it works" ? "how" : hideFailed && shownResults.length === 0 ? "none" : results.length ? "results" : "intro";
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
        maxSelected={maxReferences}
        selectedIds={homeReferences.map((item) => item.sourceId ?? `upload:${item.key}`)}
        userId={session?.user?.id}
      />
      <aside aria-label={copy.settings} className="vst-panel">
        <div className="vst-panel-head">
          <h2 className="vst-panel-title">{copy.panelTitle}</h2>
        </div>
        <div className="vst-panel-scroll">
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

          <ReferenceBlock
            zh={isChinese}
            references={referenceThumbs}
            max={maxReferences}
            uploading={uploading}
            dropOver={drop.over}
            dropBind={drop.bind}
            onOpen={() => openMedia("upload")}
            onMention={mentionReference}
            onRemove={(index) => (homeReferences.length ? removeHomeReference(index) : clearSelectedMedia())}
          />

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
            canReference={maxReferences > 0}
            onOpenMedia={openMedia}
            audio={model.audio ? { on: settings.audio, onToggle: () => setSettings((previous) => ({ ...previous, audio: !previous.audio })) } : undefined}
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
            <ChoiceCard
              label={copy.aspect}
              value={settings.aspect}
              options={widestFirst(model.aspects)}
              fixedNote={isChinese ? `${model.name} 只支持 ${settings.aspect}` : `${model.name} only makes ${settings.aspect}`}
              onChange={(aspect) => setSettings((previous) => ({ ...previous, aspect }))}
            />
            <ChoiceCard
              label={copy.resolution}
              className="vst-card-span"
              value={settings.resolution}
              options={model.resolutions}
              fixedNote={isChinese ? `${model.name} 只支持 ${settings.resolution}` : `${model.name} only makes ${settings.resolution}`}
              onChange={(resolution) => setSettings((previous) => ({ ...previous, resolution }))}
            />
          </div>

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
        </div>
      </aside>

      <section aria-label={copy.results} className="vst-stage" data-library={presetsOpen || undefined}>
        <div className="vst-stage-bar">
          <StageTabs zh={isChinese} active={activeTab} count={results.length} onChange={setActiveTab} />
          {activeTab === "History" ? (
            <div className="vst-stage-tools">
              <FilterMenu zh={isChinese} hideFailed={hideFailed} onHideFailed={setHideFailed} />
              <ViewMenu zh={isChinese} view={historyView} onChange={setHistoryView} />
            </div>
          ) : null}
        </div>
        {activeTab === "History" && hideFailed ? <ActiveFilters zh={isChinese} onClear={() => setHideFailed(false)} /> : null}
        <div className="vst-stage-body" key={historyKey}>
          {activeTab === "How it works" ? (
            <HowItWorks zh={isChinese} templatesHref={localizedHref(locale, "/templates")} />
          ) : hideFailed && shownResults.length === 0 ? (
            <NoMatches zh={isChinese} onClear={() => setHideFailed(false)} />
          ) : results.length === 0 ? (
            // Nothing made yet: the introduction, as on the reference.
            <HowItWorks zh={isChinese} templatesHref={localizedHref(locale, "/templates")} tip={false} />
          ) : (
            <ResultsGrid
              zh={isChinese}
              results={shownResults}
              gallery={gallery}
              view={historyView}
              onView={openViewer}
              onReuse={reuse}
              onCanvas={(result) => {
                try {
                  sessionStorage.setItem(
                    "aivd:canvas-handoff",
                    JSON.stringify({ kind: "video", url: result.videoUrl, prompt: result.prompt, model: model.name, uuid: result.videoUuid ?? undefined, index: 0 }),
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
        />
      ) : null}
    </div>
  );
}
