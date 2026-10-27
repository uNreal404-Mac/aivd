"use client";

import {
  Bot,
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
  buildLocalCreativePlan,
  type CreativePlan,
} from "@/lib/creative-space/local-plan";

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
}

interface Viewport {
  x: number;
  y: number;
  scale: number;
}

const MAX_FILE_SIZE = 100 * 1024 * 1024;

const copy = {
  zh: {
    eyebrow: "无限画布 · 试验版",
    title: "创作空间",
    subtitle: "把素材放进画布，用 @素材 告诉 Agent 如何组合。",
    localOnly: "素材仅保存在当前浏览器",
    apiPending: "DeepSeek 尚未接入",
    assets: "素材库",
    addAsset: "上传素材",
    formats: "图片 / 视频，单个文件不超过 100 MB",
    emptyAssets: "上传第一份素材开始创作",
    canvasHint: "拖动画布移动 · 滚轮缩放 · 拖动素材调整位置",
    emptyCanvas: "把图片或视频拖进你的创作空间",
    emptyCanvasSub: "素材不会上传到服务器，也不会触发模型调用。",
    agent: "创作 Agent",
    agentSubtitle: "先在本地生成可核对的编排计划",
    inputPlaceholder: "例如：把 @A 放在片头，@B 放在片尾……",
    createPlan: "整理计划",
    generating: "整理中",
    quickStart: "试试：把 @A 放在片头",
    noPlan: "上传素材并输入指令后，分镜计划会显示在这里。",
    plan: "本地分镜计划",
    safetyTitle: "安全状态",
    safetyBody: "已限制文件类型和大小。内容审核服务接入前，不会将素材发送给生成模型。",
    generationDisabled: "生成暂未开放",
    generationHelp: "接入 DeepSeek、内容审核和现有视频生成流程后启用。",
    selected: "素材设置",
    size: "显示尺寸",
    remove: "从画布移除",
    invalidFile: "仅支持常见图片或视频文件，且单个文件不能超过 100 MB。",
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
    localOnly: "Assets stay in this browser",
    apiPending: "DeepSeek not connected",
    assets: "Assets",
    addAsset: "Upload assets",
    formats: "Images / videos, up to 100 MB each",
    emptyAssets: "Upload your first asset to begin",
    canvasHint: "Drag to pan · scroll to zoom · drag assets to position",
    emptyCanvas: "Drop images or videos into your creative space",
    emptyCanvasSub: "Nothing is uploaded and no model API is called.",
    agent: "Creative Agent",
    agentSubtitle: "Build a reviewable local sequence first",
    inputPlaceholder: "Example: use @A as the opening and @B as the ending…",
    createPlan: "Build plan",
    generating: "Planning",
    quickStart: "Try: use @A as the opening",
    noPlan: "Upload assets and enter an instruction to see a storyboard plan here.",
    plan: "Local storyboard plan",
    safetyTitle: "Safety status",
    safetyBody: "File type and size checks are active. Assets cannot reach a generation model until moderation is connected.",
    generationDisabled: "Generation unavailable",
    generationHelp: "Enabled after DeepSeek, moderation and the existing video pipeline are connected.",
    selected: "Asset settings",
    size: "Display size",
    remove: "Remove from canvas",
    invalidFile: "Use a common image or video file no larger than 100 MB.",
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

export function CreativeSpaceStudio({ locale }: CreativeSpaceStudioProps) {
  const language = locale.toLowerCase().startsWith("zh") ? "zh" : "en";
  const t = copy[language];
  const [assets, setAssets] = useState<CanvasAsset[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 56, y: 56, scale: 1 });
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<CreativePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
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

  const addFiles = (files: File[]) => {
    const accepted = files.filter(
      (file) =>
        (file.type.startsWith("image/") || file.type.startsWith("video/")) &&
        file.size <= MAX_FILE_SIZE
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
      };
    });

    setAssets((current) => [...current, ...nextAssets]);
    setSelectedId(nextAssets[0]?.id ?? null);
    setPlan(null);
  };

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(event.target.files ?? []));
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

  const buildPlan = () => {
    if (!prompt.trim() && assets.length === 0) return;
    setIsPlanning(true);
    window.setTimeout(() => {
      setPlan(buildLocalCreativePlan(prompt, assets, locale));
      setIsPlanning(false);
    }, 220);
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#343b45] bg-[#0b0c10] px-3 py-1.5 text-[#9aa2aa]">
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
              addFiles(Array.from(event.dataTransfer.files));
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
                  role="button"
                  tabIndex={0}
                  onPointerDown={(event) => startAssetDrag(event, asset)}
                  onPointerMove={moveAsset}
                  onPointerUp={endAssetDrag}
                  onPointerCancel={endAssetDrag}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedId(asset.id);
                  }}
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
                    buildPlan();
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
                  onClick={buildPlan}
                  disabled={isPlanning || (!prompt.trim() && assets.length === 0)}
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
              disabled
              className="mt-3 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[#1f2833] bg-[#101318] px-3 py-2.5 text-xs font-semibold text-[#5d6670]"
            >
              <Sparkles className="h-4 w-4" />
              {t.generationDisabled}
            </button>
            <p className="mt-2 text-center text-[9px] leading-relaxed text-[#59616a]">{t.generationHelp}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
