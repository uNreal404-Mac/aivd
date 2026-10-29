"use client";

import {
  Bot,
  CheckCircle2,
  Film,
  Image as ImageIcon,
  LoaderCircle,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  Video,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type CreativePlan,
} from "@/lib/creative-space/local-plan";
import { generateVideo, uploadImage } from "@/lib/video-api";

interface CreativeSpaceStudioProps {
  locale: string;
}

interface CanvasAsset {
  id: string;
  label: string;
  name: string;
  type: "image" | "video";
  url: string;
  x: number;
  y: number;
  width: number;
  file: File;
  samples: File[];
  safety: "checking" | "allowed";
}

interface AgentPlan extends CreativePlan {
  generationPrompt: string;
}

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const copy = {
  zh: {
    eyebrow: "无限画布 · 试验版",
    title: "创作空间",
    subtitle: "把素材放进画布，用 @素材 告诉 Agent 如何组合。",
    localOnly: "审核通过前仅本地预览",
    apiPending: "DeepSeek Agent 已连接",
    assets: "素材库",
    addAsset: "上传素材",
    formats: "图片 ≤ 10 MB / 视频 ≤ 100 MB，上传后自动安全检查",
    emptyAssets: "上传第一份素材开始创作",
    canvasHint: "拖动画布移动 · 滚轮缩放 · 拖动素材调整位置",
    emptyCanvas: "把图片或视频拖进你的创作空间",
    emptyCanvasSub: "上传后先进行安全检查，通过的素材才能进入 Agent。",
    agent: "创作 Agent",
    agentSubtitle: "理解 @素材，生成分镜和可执行提示词",
    inputPlaceholder: "例如：把 @A 放在片头，@B 放在片尾……",
    createPlan: "发送给 Agent",
    generating: "Agent 思考中",
    quickStart: "试试：把 @A 放在片头",
    noPlan: "上传素材并输入指令后，分镜计划会显示在这里。",
    plan: "Agent 分镜计划",
    safetyTitle: "安全状态",
    safetyBody: "Prompt 先经过敏感词规则，再由 DeepSeek 检查文字与视觉内容。可疑或违规内容不会进入生成模型，也不会扣除积分。",
    generationDisabled: "生成视频",
    generationHelp: "Agent 生成安全分镜后，复用现有视频生成、积分和作品库流程。",
    selected: "素材设置",
    size: "显示尺寸",
    remove: "从画布移除",
    invalidFile: "仅支持常见图片或视频；图片不超过 10 MB，视频不超过 100 MB。",
    checking: "安全检查中",
    approved: "已通过安全检查",
    blocked: "素材未通过安全检查，已从画布移除。",
    signIn: "请先登录，再使用 Agent 和安全审核。",
    agentError: "Agent 暂时不可用，请稍后重试。",
    generatingVideo: "正在提交生成任务",
    generationStarted: "生成任务已提交，可在“我的作品”查看进度。",
    openCreations: "查看我的作品",
    resetView: "复位画布",
    uploadAria: "上传图片或视频",
    zoomIn: "放大",
    zoomOut: "缩小",
    fit: "复位",
    asset: "素材",
  },
  en: {
    eyebrow: "INFINITE CANVAS · EXPERIMENTAL",
    title: "Creative Space",
    subtitle: "Place media on the canvas and tell the Agent what to do with @assets.",
    localOnly: "Local preview until approved",
    apiPending: "DeepSeek Agent connected",
    assets: "Assets",
    addAsset: "Upload assets",
    formats: "Images ≤ 10 MB / videos ≤ 100 MB · automatic safety review",
    emptyAssets: "Upload your first asset to begin",
    canvasHint: "Drag to pan · scroll to zoom · drag assets to position",
    emptyCanvas: "Drop images or videos into your creative space",
    emptyCanvasSub: "Every upload is reviewed before the Agent can use it.",
    agent: "Creative Agent",
    agentSubtitle: "Understand @assets and build an executable storyboard",
    inputPlaceholder: "Example: use @A as the opening and @B as the ending…",
    createPlan: "Send to Agent",
    generating: "Agent is thinking",
    quickStart: "Try: use @A as the opening",
    noPlan: "Upload assets and enter an instruction to see a storyboard plan here.",
    plan: "Agent storyboard",
    safetyTitle: "Safety status",
    safetyBody: "Prompts pass the local rule gate first, then DeepSeek reviews text and visual content. Uncertain or blocked content never reaches the generation provider and uses no credits.",
    generationDisabled: "Generate video",
    generationHelp: "After a safe Agent plan, this reuses the existing generation, credits and creations workflow.",
    selected: "Asset settings",
    size: "Display size",
    remove: "Remove from canvas",
    invalidFile: "Use a common image up to 10 MB or video up to 100 MB.",
    checking: "Safety check",
    approved: "Safety approved",
    blocked: "The asset did not pass the safety check and was removed.",
    signIn: "Sign in before using the Agent and safety review.",
    agentError: "The Agent is temporarily unavailable. Please try again.",
    generatingVideo: "Submitting generation",
    generationStarted: "Generation started. Track it in My Creations.",
    openCreations: "Open My Creations",
    resetView: "Reset canvas",
    uploadAria: "Upload images or videos",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    fit: "Reset",
    asset: "Asset",
  },
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function waitForVideoEvent(video: HTMLVideoElement, event: string) {
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Unable to read video"));
    };
    const cleanup = () => {
      video.removeEventListener(event, onReady);
      video.removeEventListener("error", onError);
    };
    video.addEventListener(event, onReady, { once: true });
    video.addEventListener("error", onError, { once: true });
  });
}

async function sampleVideo(file: File, label: string): Promise<File[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.src = url;

  try {
    await waitForVideoEvent(video, "loadedmetadata");
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const times = duration > 0 ? [0.12, 0.5, 0.88].map((ratio) => duration * ratio) : [0];
    const frames: File[] = [];

    for (const [index, time] of times.entries()) {
      if (duration > 0) {
        video.currentTime = Math.min(Math.max(time, 0), Math.max(duration - 0.05, 0));
        await waitForVideoEvent(video, "seeked");
      }
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight, 1));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.82),
      );
      if (blob) {
        frames.push(
          new File([blob], `${label}__frame-${index + 1}.jpg`, {
            type: "image/jpeg",
          }),
        );
      }
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function parseApiError(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object") return fallback;
  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : fallback;
}

export function CreativeSpaceStudio({ locale }: CreativeSpaceStudioProps) {
  const language = locale.toLowerCase().startsWith("zh") ? "zh" : "en";
  const t = copy[language];
  const [assets, setAssets] = useState<CanvasAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 56, y: 56, scale: 1 });
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStarted, setGenerationStarted] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<string[]>([]);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    assetId: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === selectedId) ?? null,
    [assets, selectedId]
  );

  useEffect(() => {
    return () => {
      for (const url of urlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const moderateAsset = async (asset: CanvasAsset) => {
    const samples =
      asset.type === "image"
        ? [
            new File([asset.file], `${asset.label}__${asset.file.name}`, {
              type: asset.file.type,
            }),
          ]
        : await sampleVideo(asset.file, asset.label);

    if (samples.length === 0) {
      throw new Error(t.agentError);
    }

    const formData = new FormData();
    formData.set("action", "moderate");
    formData.set("locale", locale);
    formData.set(
      "assets",
      JSON.stringify([
        {
          id: asset.id,
          label: asset.label,
          name: asset.name,
          type: asset.type,
        },
      ]),
    );
    for (const sample of samples) formData.append("visual", sample);

    const response = await fetch("/api/v1/creative-space/agent", {
      method: "POST",
      body: formData,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new Error(t.signIn);
      throw new Error(parseApiError(payload, t.blocked));
    }

    setAssets((current) =>
      current.map((item) =>
        item.id === asset.id
          ? { ...item, safety: "allowed", samples }
          : item,
      ),
    );
  };

  const addFiles = async (files: File[]) => {
    const accepted = files.filter(
      (file) =>
        (file.type.startsWith("image/") || file.type.startsWith("video/")) &&
        file.size <=
          (file.type.startsWith("image/") ? MAX_IMAGE_SIZE : MAX_FILE_SIZE)
    );

    if (accepted.length !== files.length) {
      setError(t.invalidFile);
    } else {
      setError(null);
    }

    if (accepted.length === 0) return;

    const nextAssets = accepted.map((file, index) => {
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      const absoluteIndex = assets.length + index;
      return {
        id: `${Date.now()}-${index}-${file.name}`,
        label: String.fromCharCode(65 + (absoluteIndex % 26)),
        name: file.name,
        type: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
        url,
        x: 80 + (absoluteIndex % 3) * 300,
        y: 90 + Math.floor(absoluteIndex / 3) * 240,
        width: 260,
        file,
        samples: [],
        safety: "checking" as const,
      };
    });

    setAssets((current) => [...current, ...nextAssets]);
    setSelectedId(nextAssets[0]?.id ?? null);
    setPlan(null);
    setGenerationStarted(false);

    for (const asset of nextAssets) {
      try {
        await moderateAsset(asset);
      } catch (moderationError) {
        URL.revokeObjectURL(asset.url);
        setAssets((current) => current.filter((item) => item.id !== asset.id));
        setSelectedId((current) => (current === asset.id ? null : current));
        setError(
          moderationError instanceof Error ? moderationError.message : t.blocked,
        );
      }
    }
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    };
    setSelectedId(null);
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = panRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    setViewport((current) => ({
      ...current,
      x: gesture.originX + event.clientX - gesture.startX,
      y: gesture.originY + event.clientY - gesture.startY,
    }));
  };

  const endCanvasPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const nextScale = clamp(viewport.scale * (event.deltaY > 0 ? 0.9 : 1.1), 0.35, 2.5);
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - viewport.x) / viewport.scale;
    const worldY = (cursorY - viewport.y) / viewport.scale;
    setViewport({
      scale: nextScale,
      x: cursorX - worldX * nextScale,
      y: cursorY - worldY * nextScale,
    });
  };

  const startAssetDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    asset: CanvasAsset
  ) => {
    if ((event.target as HTMLElement).closest("button, video")) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      assetId: asset.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: asset.x,
      originY: asset.y,
    };
    setSelectedId(asset.id);
  };

  const moveAsset = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = dragRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const x = gesture.originX + (event.clientX - gesture.startX) / viewport.scale;
    const y = gesture.originY + (event.clientY - gesture.startY) / viewport.scale;
    setAssets((current) =>
      current.map((asset) =>
        asset.id === gesture.assetId ? { ...asset, x, y } : asset
      )
    );
  };

  const endAssetDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const updateSelectedWidth = (delta: number) => {
    if (!selectedId) return;
    setAssets((current) =>
      current.map((asset) =>
        asset.id === selectedId
          ? { ...asset, width: clamp(asset.width + delta, 140, 560) }
          : asset
      )
    );
  };

  const removeSelected = () => {
    if (!selectedId) return;
    const asset = assets.find((item) => item.id === selectedId);
    if (asset) URL.revokeObjectURL(asset.url);
    setAssets((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
    setPlan(null);
  };

  const appendMention = (label: string) => {
    setPrompt((current) => `${current}${current.trim() ? " " : ""}@${label} `);
  };

  const buildPlan = async () => {
    const approvedAssets = assets.filter((asset) => asset.safety === "allowed");
    if (!prompt.trim()) return;
    setIsPlanning(true);
    setError(null);
    setGenerationStarted(false);

    try {
      const formData = new FormData();
      formData.set("action", "plan");
      formData.set("instruction", prompt.trim());
      formData.set("locale", locale);
      formData.set(
        "assets",
        JSON.stringify(
          approvedAssets.map(({ id, label, name, type }) => ({
            id,
            label,
            name,
            type,
          })),
        ),
      );
      for (const asset of approvedAssets) {
        for (const sample of asset.samples) formData.append("visual", sample);
      }

      const response = await fetch("/api/v1/creative-space/agent", {
        method: "POST",
        body: formData,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 401) throw new Error(t.signIn);
        throw new Error(parseApiError(payload, t.agentError));
      }
      const result = (payload as {
        data: {
          reply: string;
          generationPrompt: string;
          mentionedAssetIds: string[];
          steps: CreativePlan["steps"];
        };
      }).data;
      setPlan({
        mentionedAssetIds: result.mentionedAssetIds,
        steps: result.steps,
        summary: result.reply,
        generationPrompt: result.generationPrompt,
      });
    } catch (agentError) {
      setPlan(null);
      setError(agentError instanceof Error ? agentError.message : t.agentError);
    } finally {
      setIsPlanning(false);
    }
  };

  const startGeneration = async () => {
    if (!plan?.generationPrompt || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    setGenerationStarted(false);

    try {
      const approvedAssets = assets.filter((asset) => asset.safety === "allowed");
      const referenceFiles = approvedAssets
        .flatMap((asset) =>
          asset.type === "image" ? [asset.file] : asset.samples.slice(1, 2),
        )
        .slice(0, 3);
      const uploaded = await Promise.all(referenceFiles.map(uploadImage));
      await generateVideo({
        prompt: plan.generationPrompt,
        model: "sora-2",
        duration: 10,
        aspectRatio: "16:9",
        quality: "720p",
        imageUrl: uploaded.length === 1 ? uploaded[0] : undefined,
        imageUrls: uploaded.length > 1 ? uploaded : undefined,
        generateAudio: true,
      });
      setGenerationStarted(true);
    } catch (generationError) {
      setError(
        generationError instanceof Error ? generationError.message : t.agentError,
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const setZoom = (next: number) => {
    setViewport((current) => ({ ...current, scale: clamp(next, 0.35, 2.5) }));
  };

  return (
    <main className="flex min-h-[calc(100svh-52px)] w-full flex-col overflow-hidden bg-[#000] text-[#c5c6c7]">
      <section className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1f2833] px-4 py-3 lg:px-6">
        <div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#66fcf1]">
            {t.eyebrow}
          </div>
          <div className="flex items-end gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{t.title}</h1>
            <p className="hidden pb-0.5 text-xs text-[#7f8994] md:block">{t.subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#214d4c] bg-[#0b1f20] px-3 py-1.5 text-[#66fcf1]">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.localOnly}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#214d4c] bg-[#0b1f20] px-3 py-1.5 text-[#66fcf1]">
            <Bot className="h-3.5 w-3.5" />
            {t.apiPending}
          </span>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)_340px]">
        <aside className="order-2 border-t border-[#1f2833] bg-[#07090c] p-4 lg:order-none lg:border-r lg:border-t-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">{t.assets}</h2>
            <span className="rounded-full bg-[#10151b] px-2 py-0.5 text-[10px] text-[#7f8994]">
              {assets.length}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleUpload}
            className="hidden"
            aria-label={t.uploadAria}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#66fcf1] px-3 py-2.5 text-sm font-semibold text-black transition hover:bg-[#45a29e]"
          >
            <Upload className="h-4 w-4" />
            {t.addAsset}
          </button>
          <p className="mt-2 text-[10px] leading-relaxed text-[#66707b]">{t.formats}</p>
          {error && (
            <p className="mt-3 rounded-lg border border-red-900/70 bg-red-950/30 p-2 text-[11px] text-red-300">
              {error}
            </p>
          )}

          <div className="mt-4 grid max-h-48 grid-cols-3 gap-2 overflow-auto lg:max-h-[calc(100svh-270px)] lg:grid-cols-2">
            {assets.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => setSelectedId(asset.id)}
                className={`group relative aspect-square overflow-hidden rounded-lg border text-left transition ${
                  selectedId === asset.id
                    ? "border-[#66fcf1] ring-1 ring-[#66fcf1]"
                    : "border-[#1f2833] hover:border-[#45a29e]"
                }`}
              >
                {asset.type === "image" ? (
                  <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" />
                ) : (
                  <video src={asset.url} muted playsInline className="h-full w-full object-cover" />
                )}
                <span className="absolute left-1.5 top-1.5 flex h-5 min-w-5 items-center justify-center rounded bg-black/75 px-1 text-[10px] font-bold text-[#66fcf1]">
                  {asset.label}
                </span>
                <span
                  className={`absolute right-1.5 top-1.5 flex h-5 items-center gap-1 rounded px-1.5 text-[9px] font-semibold ${
                    asset.safety === "allowed"
                      ? "bg-emerald-950/90 text-emerald-300"
                      : "bg-black/85 text-amber-300"
                  }`}
                >
                  {asset.safety === "allowed" ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <LoaderCircle className="h-3 w-3 animate-spin" />
                  )}
                  {asset.safety === "allowed" ? t.approved : t.checking}
                </span>
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-1.5 py-1 text-[9px] text-white">
                  {asset.name}
                </span>
              </button>
            ))}
          </div>
          {assets.length === 0 && (
            <div className="mt-5 rounded-xl border border-dashed border-[#1f2833] p-4 text-center text-xs text-[#66707b]">
              <ImageIcon className="mx-auto mb-2 h-5 w-5" />
              {t.emptyAssets}
            </div>
          )}
        </aside>

        <section className="relative order-1 min-h-[56svh] overflow-hidden bg-[#050708] lg:order-none lg:min-h-0">
          <div className="pointer-events-none absolute left-4 top-4 z-20 rounded-lg border border-[#1f2833] bg-black/75 px-3 py-2 text-[10px] text-[#8a949e] backdrop-blur">
            <span className="inline-flex items-center gap-1.5">
              <MousePointer2 className="h-3.5 w-3.5 text-[#66fcf1]" />
              {t.canvasHint}
            </span>
          </div>
          <div className="absolute right-4 top-4 z-20 flex items-center overflow-hidden rounded-lg border border-[#1f2833] bg-black/80 shadow-xl backdrop-blur">
            <button
              type="button"
              onClick={() => setZoom(viewport.scale / 1.15)}
              aria-label={t.zoomOut}
              className="p-2 text-[#aeb5bc] hover:bg-[#10151b] hover:text-[#66fcf1]"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-12 text-center text-[10px] text-[#8a949e]">
              {Math.round(viewport.scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoom(viewport.scale * 1.15)}
              aria-label={t.zoomIn}
              className="p-2 text-[#aeb5bc] hover:bg-[#10151b] hover:text-[#66fcf1]"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewport({ x: 56, y: 56, scale: 1 })}
              title={t.resetView}
              aria-label={t.fit}
              className="border-l border-[#1f2833] p-2 text-[#aeb5bc] hover:bg-[#10151b] hover:text-[#66fcf1]"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={canvasRef}
            className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(102,252,241,0.18) 1px, transparent 1px)",
              backgroundPosition: `${viewport.x}px ${viewport.y}px`,
              backgroundSize: `${24 * viewport.scale}px ${24 * viewport.scale}px`,
            }}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={endCanvasPan}
            onPointerCancel={endCanvasPan}
            onWheel={handleWheel}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void addFiles(Array.from(event.dataTransfer.files));
            }}
          >
            <div
              className="pointer-events-none absolute left-0 top-0"
              style={{
                transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
                transformOrigin: "0 0",
              }}
            >
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  onPointerDown={(event) => startAssetDrag(event, asset)}
                  onPointerMove={moveAsset}
                  onPointerUp={endAssetDrag}
                  onPointerCancel={endAssetDrag}
                  className={`pointer-events-auto absolute select-none overflow-hidden rounded-2xl border-2 bg-[#0b0c10] shadow-2xl transition-[border-color] ${
                    selectedId === asset.id
                      ? "border-[#66fcf1]"
                      : "border-[#1f2833] hover:border-[#45a29e]"
                  }`}
                  style={{ left: asset.x, top: asset.y, width: asset.width }}
                >
                  <div className="flex h-8 cursor-move items-center justify-between border-b border-[#1f2833] bg-[#0b0c10] px-2">
                    <span className="flex min-w-0 items-center gap-2 text-[10px] text-white">
                      {asset.type === "image" ? (
                        <ImageIcon className="h-3.5 w-3.5 shrink-0 text-[#66fcf1]" />
                      ) : (
                        <Video className="h-3.5 w-3.5 shrink-0 text-[#66fcf1]" />
                      )}
                      <span className="truncate">@{asset.label} · {asset.name}</span>
                    </span>
                    {asset.safety === "checking" && (
                      <span className="inline-flex items-center gap-1 text-[9px] text-amber-300">
                        <LoaderCircle className="h-3 w-3 animate-spin" />
                        {t.checking}
                      </span>
                    )}
                  </div>
                  {asset.type === "image" ? (
                    <img
                      src={asset.url}
                      alt={asset.name}
                      draggable={false}
                      className="aspect-video w-full bg-black object-contain"
                    />
                  ) : (
                    <video
                      src={asset.url}
                      controls
                      playsInline
                      className="aspect-video w-full bg-black object-contain"
                    />
                  )}
                </div>
              ))}
            </div>

            {assets.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8 text-center">
                <div>
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#214d4c] bg-[#0b1f20] text-[#66fcf1]">
                    <Film className="h-6 w-6" />
                  </div>
                  <h2 className="text-base font-semibold text-white">{t.emptyCanvas}</h2>
                  <p className="mt-1 max-w-md text-xs text-[#69737d]">{t.emptyCanvasSub}</p>
                </div>
              </div>
            )}
          </div>

          {selectedAsset && (
            <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-[#1f2833] bg-black/85 p-2 shadow-2xl backdrop-blur">
              <span className="px-2 text-[11px] text-white">{t.selected} · @{selectedAsset.label}</span>
              <span className="h-5 w-px bg-[#1f2833]" />
              <button
                type="button"
                onClick={() => updateSelectedWidth(-40)}
                aria-label={`${t.size} -`}
                className="rounded-md p-1.5 text-[#aeb5bc] hover:bg-[#10151b] hover:text-[#66fcf1]"
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => updateSelectedWidth(40)}
                aria-label={`${t.size} +`}
                className="rounded-md p-1.5 text-[#aeb5bc] hover:bg-[#10151b] hover:text-[#66fcf1]"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={removeSelected}
                aria-label={t.remove}
                className="rounded-md p-1.5 text-[#aeb5bc] hover:bg-red-950 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </section>

        <aside className="order-3 flex min-h-[430px] flex-col border-t border-[#1f2833] bg-[#07090c] lg:min-h-0 lg:border-l lg:border-t-0">
          <div className="border-b border-[#1f2833] p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0b1f20] text-[#66fcf1]">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">{t.agent}</h2>
                <p className="text-[10px] text-[#66707b]">{t.agentSubtitle}</p>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
            <div className="rounded-xl border border-[#1f2833] bg-[#0b0c10] p-3">
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#66fcf1]">
                <ShieldCheck className="h-4 w-4" />
                {t.safetyTitle}
              </div>
              <p className="text-[10px] leading-relaxed text-[#7f8994]">{t.safetyBody}</p>
            </div>

            {plan ? (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8b949e]">{t.plan}</h3>
                <div className="space-y-2">
                  {plan.steps.map((step, index) => (
                    <button
                      key={`${step.assetId}-${index}`}
                      type="button"
                      onClick={() => setSelectedId(step.assetId)}
                      className="w-full rounded-xl border border-[#1f2833] bg-[#0b0c10] p-3 text-left transition hover:border-[#45a29e]"
                    >
                      <div className="mb-1 text-xs font-semibold text-white">{step.title}</div>
                      <p className="text-[10px] leading-relaxed text-[#7f8994]">{step.instruction}</p>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[10px] leading-relaxed text-[#66fcf1]">{plan.summary}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#1f2833] p-4 text-center text-[11px] leading-relaxed text-[#66707b]">
                <Bot className="mx-auto mb-2 h-5 w-5" />
                {t.noPlan}
              </div>
            )}
          </div>

          <div className="border-t border-[#1f2833] p-4">
            {assets.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {assets.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => appendMention(asset.label)}
                    className="rounded-md border border-[#214d4c] bg-[#0b1f20] px-2 py-1 text-[10px] text-[#66fcf1] hover:bg-[#123031]"
                  >
                    @{asset.label}
                  </button>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-[#26303b] bg-[#0b0c10] p-2 focus-within:border-[#45a29e]">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault();
                    void buildPlan();
                  }
                }}
                placeholder={t.inputPlaceholder}
                rows={3}
                className="w-full resize-none bg-transparent px-1 py-1 text-xs text-white outline-none placeholder:text-[#545d66]"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setPrompt(t.quickStart.replace(/^试试：|^Try:\s*/i, ""))}
                  className="truncate px-1 text-left text-[9px] text-[#66707b] hover:text-[#66fcf1]"
                >
                  {t.quickStart}
                </button>
                <button
                  type="button"
                  onClick={() => void buildPlan()}
                  disabled={
                    isPlanning ||
                    !prompt.trim() ||
                    assets.some((asset) => asset.safety === "checking")
                  }
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#66fcf1] px-3 py-2 text-[11px] font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isPlanning ? (
                    <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  {isPlanning ? t.generating : t.createPlan}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void startGeneration()}
              disabled={!plan?.generationPrompt || isGenerating}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#66fcf1] px-3 py-2.5 text-xs font-semibold text-black transition hover:bg-[#45a29e] disabled:cursor-not-allowed disabled:border disabled:border-[#1f2833] disabled:bg-[#101318] disabled:text-[#5d6670]"
            >
              {isGenerating ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGenerating ? t.generatingVideo : t.generationDisabled}
            </button>
            <p className="mt-2 text-center text-[9px] leading-relaxed text-[#59616a]">{t.generationHelp}</p>
            {generationStarted && (
              <div className="mt-3 rounded-xl border border-emerald-900/70 bg-emerald-950/25 p-3 text-center">
                <p className="text-[10px] leading-relaxed text-emerald-200">
                  {t.generationStarted}
                </p>
                <a
                  href={`/${language}/my-creations`}
                  className="mt-2 inline-flex text-[10px] font-semibold text-[#66fcf1] hover:underline"
                >
                  {t.openCreations}
                </a>
              </div>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
