"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Brush,
  Download,
  Eraser,
  Expand,
  Film,
  Loader2,
  Paintbrush,
  RotateCcw,
  Scissors,
  Sparkles,
  Type,
  Undo2,
  X,
} from "lucide-react";

import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { estimateCredits } from "@/lib/ai-video-studio";
import "./canvas-inpaint-modal.css";
export type CanvasEditAction = "inpaint" | "erase" | "outpaint" | "cutout" | "upscale" | "text-edit" | "animate";

/** The image being edited: what the modal shows and prices. */
export interface EditableImage {
  label: string;
  name: string;
  url: string;
  aspectRatio?: string;
}

export type CanvasEditSubmit =
  | {
      action: "inpaint" | "erase" | "outpaint" | "cutout" | "upscale" | "text-edit";
      modelId: string;
      prompt: string;
      aspectRatio: string;
      resolution: string;
      compositeFile?: File;
    }
  | {
      action: "animate";
      modelId: string;
      prompt: string;
      duration: number;
      aspectRatio: string;
      resolution: string;
      audio: boolean;
    };

interface CanvasEditModalProps {
  locale: string;
  node: EditableImage;
  action: CanvasEditAction;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (payload: CanvasEditSubmit) => void;
  onLocalCutout?: (dataUrl: string, file: File) => void;
}

type Stroke = {
  tool: "brush" | "eraser";
  size: number;
  points: { x: number; y: number }[];
};

const OUTPAINT_TARGETS = [
  { id: "16:9", zh: "横向 16:9 扩图", en: "Expand 16:9 Wide" },
  { id: "9:16", zh: "竖屏 9:16 扩图", en: "Expand 9:16 Tall" },
  { id: "21:9", zh: "电影宽银幕 21:9", en: "Cinema 21:9" },
  { id: "1:1", zh: "方形 1:1 扩图", en: "Expand 1:1 Square" },
  { id: "4:3", zh: "画幅 4:3 扩图", en: "Expand 4:3" },
  { id: "3:4", zh: "海报 3:4 扩图", en: "Expand 3:4" },
];

const UPSCALE_MODES = [
  { id: "2K", modelId: "seedream-5-5", zh: "2K 超清修复（Seedream 5.5）", en: "2K HD Enhance (Seedream 5.5)" },
  { id: "4K", modelId: "nano-banana-pro", zh: "4K 细节增强（Nano Banana Pro）", en: "4K Detail Upscale (Nano Banana Pro)" },
  { id: "8K", modelId: "kling-image-4", zh: "8K 旗舰超清（Kling Image 4.0）", en: "8K Ultra HD (Kling Image 4.0)" },
];

const ANIMATE_MODELS = [
  { id: "bytedance/seedance-2-5", name: "Seedance 2.5", durations: [5, 8, 10], resolutions: ["720p", "1080p"], audio: true },
  { id: "kling/v4-reference-to-video", name: "Kling 4.0", durations: [5, 10], resolutions: ["720p", "1080p"], audio: false },
  { id: "veo-3.1", name: "Veo 3.1", durations: [8], resolutions: ["720p"], audio: true },
  { id: "wan/3-0-video", name: "Wan 3.0", durations: [5, 10], resolutions: ["720p", "1080p"], audio: true },
];

function CanvasEditDialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="cc-modal-backdrop">
          <Dialog.Content className="cc-modal" aria-describedby={undefined} onPointerDownOutside={(event) => event.preventDefault()}>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function CanvasEditModal({
  locale,
  node,
  action,
  submitting,
  onClose,
  onSubmit,
  onLocalCutout,
}: CanvasEditModalProps) {
  const zh = locale.toLowerCase().startsWith("zh");
  const isMaskTool = action === "inpaint" || action === "erase";

  const [brushTool, setBrushTool] = useState<"brush" | "eraser">("brush");
  const [brushSize, setBrushSize] = useState(38);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef<Stroke | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [prompt, setPrompt] = useState(() => {
    if (action === "erase") {
      return zh
        ? "自然消除涂抹选区内的多余物体，按周围背景纹理无缝补全画面，保持其余区域完全不变"
        : "Cleanly remove the highlighted object in the marked region and seamlessly reconstruct the surrounding background while keeping the rest unchanged";
    }
    if (action === "outpaint") {
      return zh
        ? "保持原图主体、光影和构图风格不变，向四周自然延展补全场景边界"
        : "Keep the original subject, lighting and composition intact and seamlessly extend the surrounding environment outward";
    }
    if (action === "cutout") {
      return zh
        ? "精准保留画面前景主体，去除全部背景并替换为干净纯白棚拍底色，主体边缘锐利清晰"
        : "Precisely isolate the foreground subject and remove the entire background to a clean solid pure-white studio backdrop with crisp edges";
    }
    if (action === "animate") {
      return zh
        ? "平滑电影运镜推进，自然光影微动，画面细节稳定流畅"
        : "Smooth cinematic camera push-in, subtle natural lighting motion, crisp temporal consistency";
    }
    return "";
  });

  const [oldText, setOldText] = useState("");
  const [newText, setNewText] = useState("");
  const [outpaintAspect, setOutpaintAspect] = useState("16:9");
  const [upscaleIndex, setUpscaleIndex] = useState(1);
  const [animateModelId, setAnimateModelId] = useState(ANIMATE_MODELS[0].id);
  const [animateDuration, setAnimateDuration] = useState(5);
  const [animateResolution, setAnimateResolution] = useState("720p");
  const [animateAudio, setAnimateAudio] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const confirming = useRef(false);
  const submittedRef = useRef(false);
  const sawSubmitting = useRef(false);
  useEffect(() => {
    if (submitting) sawSubmitting.current = true;
    else if (sawSubmitting.current) {
      // The parent finished (or failed): another confirm is allowed again.
      sawSubmitting.current = false;
      confirming.current = false;
    }
  }, [submitting]);
  const send = (payload: CanvasEditSubmit) => {
    submittedRef.current = true;
    onSubmit(payload);
    // The parent may decline at once (e.g. asks to sign in) without submitting.
    setTimeout(() => {
      if (!sawSubmitting.current) confirming.current = false;
    }, 4000);
  };

  const activeAnimate = ANIMATE_MODELS.find((item) => item.id === animateModelId) ?? ANIMATE_MODELS[0];

  // Redraw brush mask strokes whenever strokes change.
  useEffect(() => {
    if (!isMaskTool) return;
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = stroke.size;
      if (stroke.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "black";
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = "cyan";
        ctx.globalAlpha = 0.55;
      }
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [isMaskTool, strokes]);

  const toCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / Math.max(1, rect.width);
    const scaleY = canvas.height / Math.max(1, rect.height);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = toCanvasPoint(event);
    const stroke: Stroke = { tool: brushTool, size: brushSize, points: [point, { x: point.x + 0.5, y: point.y + 0.5 }] };
    drawingRef.current = stroke;
    setStrokes((prev) => [...prev, stroke]);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const point = toCanvasPoint(event);
    drawingRef.current.points.push(point);
    setStrokes((prev) => [...prev.slice(0, -1), { ...drawingRef.current! }]);
  };

  const handlePointerUp = () => {
    drawingRef.current = null;
  };

  // Compose original image + highlighted mask into a guide file for inpaint/erase.
  const buildCompositeFile = async (): Promise<File | undefined> => {
    if (!isMaskTool || strokes.length === 0) return undefined;
    const img = imgRef.current;
    const mask = maskCanvasRef.current;
    if (!img || !mask || !img.naturalWidth) return undefined;
    try {
      const out = document.createElement("canvas");
      const maxDim = 1280;
      const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      out.width = Math.max(64, Math.round(img.naturalWidth * ratio));
      out.height = Math.max(64, Math.round(img.naturalHeight * ratio));
      const ctx = out.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(img, 0, 0, out.width, out.height);
      ctx.drawImage(mask, 0, 0, out.width, out.height);
      const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"));
      if (!blob) return undefined;
      return new File([blob], `mask-${node.label}.png`, { type: "image/png" });
    } catch {
      return undefined;
    }
  };

  // Instant browser edge-based background cutout (no credits, local PNG download & canvas node).
  const runInstantLocalCutout = async () => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || !onLocalCutout) return;
    try {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, c.width, c.height);
      const data = imageData.data;
      // Sample 4 corners to detect solid backdrop color.
      const samples = [
        0,
        (c.width - 1) * 4,
        (c.height - 1) * c.width * 4,
        ((c.height - 1) * c.width + (c.width - 1)) * 4,
      ];
      let sr = 0;
      let sg = 0;
      let sb = 0;
      for (const offset of samples) {
        sr += data[offset];
        sg += data[offset + 1];
        sb += data[offset + 2];
      }
      sr /= 4;
      sg /= 4;
      sb /= 4;
      const threshold = 48;
      for (let i = 0; i < data.length; i += 4) {
        const dist = Math.hypot(data[i] - sr, data[i + 1] - sg, data[i + 2] - sb);
        if (dist < threshold) {
          data[i + 3] = 0;
        } else if (dist < threshold + 22) {
          data[i + 3] = Math.round(((dist - threshold) / 22) * 255);
        }
      }
      ctx.putImageData(imageData, 0, 0);
      const dataUrl = c.toDataURL("image/png");
      const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
      if (blob) {
        onLocalCutout(dataUrl, new File([blob], `cutout-${node.label}.png`, { type: "image/png" }));
        onClose();
      }
    } catch {
      setLocalError(zh ? "跨域图片暂不支持本机直抠，请点击下方 AI 智能抠图。" : "Cross-origin image cannot be masked locally. Use AI Cutout below.");
    }
  };

  // Compute exact credit cost from live market pricing.
  const creditCost = (() => {
    if (action === "animate") {
      return estimateCredits({
        modelId: animateModelId,
        duration: animateDuration,
        resolution: animateResolution,
      });
    }
    if (action === "upscale") {
      const target = UPSCALE_MODES[upscaleIndex];
      const model = getMarketModel(target.modelId);
      return model ? marketCredits(model, { prompt: "upscale", resolution: target.id, imageUrls: [node.url] }) : 12;
    }
    const editModelId = action === "text-edit" ? "gpt-image-2-6-sunburst" : "seedream-5-5";
    const model = getMarketModel(editModelId);
    const res = editModelId === "seedream-5-5" ? "2K" : "1K";
    // Painted inpaint / erase also sends the marked-up copy: two reference images.
    const images = isMaskTool && strokes.length > 0 ? [node.url, "mask"] : [node.url];
    return model ? marketCredits(model, { prompt: prompt || "edit", resolution: res, imageUrls: images }) : 12;
  })();

  const titles: Record<CanvasEditAction, { zh: string; en: string; icon: React.ReactNode }> = {
    inpaint: { zh: "局部重绘 · 涂抹选区修改", en: "Inpaint · Paint Region to Edit", icon: <Paintbrush className="h-4 w-4" /> },
    erase: { zh: "图像消除 · 涂抹擦除物体", en: "Magic Erase · Remove Objects", icon: <Eraser className="h-4 w-4" /> },
    outpaint: { zh: "一键扩图 · 延展画面边界", en: "Outpaint · Expand Canvas", icon: <Expand className="h-4 w-4" /> },
    cutout: { zh: "智能抠图 · 主体分离", en: "Smart Cutout · Isolate Subject", icon: <Scissors className="h-4 w-4" /> },
    upscale: { zh: "高清放大 · 2K / 4K / 8K 修复", en: "HD Upscale · 2K / 4K / 8K", icon: <Sparkles className="h-4 w-4" /> },
    "text-edit": { zh: "文字重绘 · 精准替换图中文字", en: "Text Edit · Replace Image Text", icon: <Type className="h-4 w-4" /> },
    animate: { zh: "图生视频 · 让画布图片动起来", en: "Animate · Image to Video", icon: <Film className="h-4 w-4" /> },
  };

  const handleConfirm = async () => {
    // One press, one job: locked before the mask export is awaited.
    if (confirming.current || submitting) return;
    confirming.current = true;
    setLocalError(null);
    try {
      await confirm();
    } finally {
      // Released when the parent reports it finished (below) or on a local error.
      if (!submittedRef.current) confirming.current = false;
      submittedRef.current = false;
    }
  };

  const confirm = async () => {
    if (action === "animate") {
      if (!prompt.trim()) {
        setLocalError(zh ? "请描述画面想要如何运动。" : "Describe how the scene should move.");
        return;
      }
      send({
        action: "animate",
        modelId: animateModelId,
        prompt: prompt.trim(),
        duration: animateDuration,
        aspectRatio: node.aspectRatio ?? "16:9",
        resolution: animateResolution,
        audio: animateAudio,
      });
      return;
    }

    if (action === "inpaint" && !prompt.trim()) {
      setLocalError(zh ? "请输入想在选区里生成或替换的内容。" : "Describe what to paint in the selected region.");
      return;
    }

    if (action === "text-edit") {
      if (!newText.trim()) {
        setLocalError(zh ? "请输入要替换成的新文字。" : "Enter the replacement text.");
        return;
      }
      const composed = oldText.trim()
        ? `Replace the text "${oldText.trim()}" in the image with "${newText.trim()}". Keep the exact original typography, layout, lighting, perspective, and background untouched.`
        : `Update the visible headline/signage text in the image to read "${newText.trim()}", matching the original font style, lighting, and perspective seamlessly.`;
      send({
        action: "text-edit",
        modelId: "gpt-image-2-6-sunburst",
        prompt: composed,
        aspectRatio: node.aspectRatio ?? "auto",
        resolution: "1K",
      });
      return;
    }

    if (action === "upscale") {
      const target = UPSCALE_MODES[upscaleIndex];
      send({
        action: "upscale",
        modelId: target.modelId,
        prompt: "Ultra high-definition restoration and detail enhancement. Preserve the exact composition, faces, colors, and subject identity from the reference image while sharpening fine textures, lighting, and clarity.",
        aspectRatio: node.aspectRatio ?? "auto",
        resolution: target.id,
      });
      return;
    }

    if (action === "outpaint") {
      send({
        action: "outpaint",
        modelId: "seedream-5-5",
        prompt: `Outpaint and expand the image naturally into ${outpaintAspect} aspect ratio. ${prompt.trim()}`,
        aspectRatio: outpaintAspect,
        resolution: "2K",
      });
      return;
    }

    if (action === "cutout") {
      send({
        action: "cutout",
        modelId: "seedream-5-5",
        prompt: prompt.trim(),
        aspectRatio: node.aspectRatio ?? "1:1",
        resolution: "2K",
      });
      return;
    }

    // Inpaint or Erase
    const compositeFile = await buildCompositeFile();
    if (strokes.length > 0 && !compositeFile) {
      setLocalError(zh ? "涂抹区域没能导出，请重试。没有扣积分。" : "The painted area could not be exported; try again. No credits used.");
      return;
    }
    const editPrompt =
      action === "inpaint"
        ? strokes.length > 0
          ? `Edit ONLY the cyan-highlighted masked area in the reference image: ${prompt.trim()}. Keep all unmasked areas completely identical in lighting, pose, and composition, and remove any cyan highlight overlay.`
          : `Modify the reference image cleanly: ${prompt.trim()}. Preserve overall identity and lighting.`
        : strokes.length > 0
          ? `Erase and cleanly remove everything inside the cyan-highlighted masked area, reconstructing natural background textures seamlessly. Remove the cyan highlight overlay completely. ${prompt.trim()}`
          : prompt.trim();

    send({
      action,
      modelId: "seedream-5-5",
      prompt: editPrompt,
      aspectRatio: node.aspectRatio ?? "1:1",
      resolution: "2K",
      compositeFile,
    });
  };

  return (
    <CanvasEditDialog onClose={onClose}>
        <div className="cc-modal-head">
          <div className="cc-modal-title">
            <span className="cc-modal-icon">{titles[action].icon}</span>
            <Dialog.Title asChild><span>{zh ? titles[action].zh : titles[action].en}</span></Dialog.Title>
            <span className="cc-pill">@{node.label}</span>
          </div>
          <button type="button" className="cc-icon-btn" onClick={onClose} aria-label={zh ? "关闭" : "Close"}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="cc-modal-body">
          <div className="cc-modal-stage">
            <div className="cc-stage-frame">
              <img
                ref={imgRef}
                src={node.url}
                alt={node.name}
                crossOrigin="anonymous"
                className="cc-stage-img"
                onLoad={(event) => {
                  const canvas = maskCanvasRef.current;
                  if (canvas && event.currentTarget.naturalWidth) {
                    canvas.width = Math.min(960, event.currentTarget.naturalWidth);
                    canvas.height = Math.round(
                      (canvas.width / event.currentTarget.naturalWidth) * event.currentTarget.naturalHeight,
                    );
                  }
                }}
              />
              {isMaskTool ? (
                <canvas
                  ref={maskCanvasRef}
                  className="cc-mask-canvas"
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                />
              ) : null}
            </div>

            {isMaskTool ? (
              <div className="cc-brush-bar">
                <button
                  type="button"
                  className={`cc-chip-btn${brushTool === "brush" ? " cc-chip-btn-on" : ""}`}
                  onClick={() => setBrushTool("brush")}
                >
                  <Brush className="h-3.5 w-3.5" />
                  {zh ? "选区画笔" : "Brush"}
                </button>
                <button
                  type="button"
                  className={`cc-chip-btn${brushTool === "eraser" ? " cc-chip-btn-on" : ""}`}
                  onClick={() => setBrushTool("eraser")}
                >
                  <Eraser className="h-3.5 w-3.5" />
                  {zh ? "橡皮擦" : "Eraser"}
                </button>
                <label className="cc-range-wrap">
                  <span>{zh ? `笔刷 ${brushSize}px` : `Size ${brushSize}px`}</span>
                  <input
                    type="range"
                    min={12}
                    max={96}
                    value={brushSize}
                    onChange={(event) => setBrushSize(Number(event.target.value))}
                  />
                </label>
                <button
                  type="button"
                  className="cc-chip-btn"
                  disabled={strokes.length === 0}
                  onClick={() => setStrokes((prev) => prev.slice(0, -1))}
                >
                  <Undo2 className="h-3.5 w-3.5" />
                  {zh ? "撤销" : "Undo"}
                </button>
                <button
                  type="button"
                  className="cc-chip-btn"
                  disabled={strokes.length === 0}
                  onClick={() => setStrokes([])}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {zh ? "清空" : "Clear"}
                </button>
              </div>
            ) : null}
          </div>

          <div className="cc-modal-controls">
            {action === "outpaint" ? (
              <div className="cc-field">
                <span className="cc-field-label">{zh ? "目标扩图比例" : "Target Aspect Ratio"}</span>
                <div className="cc-option-grid">
                  {OUTPAINT_TARGETS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cc-option-btn${outpaintAspect === item.id ? " cc-option-btn-on" : ""}`}
                      onClick={() => setOutpaintAspect(item.id)}
                    >
                      {zh ? item.zh : item.en}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {action === "upscale" ? (
              <div className="cc-field">
                <span className="cc-field-label">{zh ? "选择放大清晰度" : "Select Upscale Tier"}</span>
                <div className="cc-stack">
                  {UPSCALE_MODES.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`cc-option-btn${upscaleIndex === idx ? " cc-option-btn-on" : ""}`}
                      onClick={() => setUpscaleIndex(idx)}
                    >
                      {zh ? item.zh : item.en}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {action === "text-edit" ? (
              <>
                <label className="cc-field">
                  <span className="cc-field-label">{zh ? "原图中的文字（可选）" : "Original Text (Optional)"}</span>
                  <input
                    type="text"
                    value={oldText}
                    onChange={(event) => setOldText(event.target.value)}
                    placeholder={zh ? "例如：SALE 50%" : "e.g. SALE 50%"}
                    className="cc-input"
                  />
                </label>
                <label className="cc-field">
                  <span className="cc-field-label">{zh ? "替换为新文字" : "New Text"}</span>
                  <input
                    type="text"
                    value={newText}
                    onChange={(event) => setNewText(event.target.value)}
                    placeholder={zh ? "例如：AIVD STUDIO" : "e.g. AIVD STUDIO"}
                    className="cc-input"
                  />
                </label>
              </>
            ) : null}

            {action === "animate" ? (
              <>
                <div className="cc-field">
                  <span className="cc-field-label">{zh ? "视频模型" : "Video Model"}</span>
                  <div className="cc-option-grid">
                    {ANIMATE_MODELS.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className={`cc-option-btn${animateModelId === m.id ? " cc-option-btn-on" : ""}`}
                        onClick={() => {
                          setAnimateModelId(m.id);
                          setAnimateDuration(m.durations[0]);
                          setAnimateResolution(m.resolutions[0]);
                          setAnimateAudio(m.audio);
                        }}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="cc-inline-row">
                  <div className="cc-field">
                    <span className="cc-field-label">{zh ? "时长" : "Duration"}</span>
                    <div className="cc-chip-row">
                      {activeAnimate.durations.map((d) => (
                        <button
                          key={d}
                          type="button"
                          className={`cc-chip-btn${animateDuration === d ? " cc-chip-btn-on" : ""}`}
                          onClick={() => setAnimateDuration(d)}
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="cc-field">
                    <span className="cc-field-label">{zh ? "画质" : "Resolution"}</span>
                    <div className="cc-chip-row">
                      {activeAnimate.resolutions.map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`cc-chip-btn${animateResolution === r ? " cc-chip-btn-on" : ""}`}
                          onClick={() => setAnimateResolution(r)}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {action !== "upscale" && action !== "text-edit" ? (
              <label className="cc-field">
                <span className="cc-field-label">
                  {action === "inpaint"
                    ? zh
                      ? "重绘提示词（描述选区内要改成什么）"
                      : "Inpaint prompt (what to generate in the brushed region)"
                    : action === "animate"
                      ? zh
                        ? "镜头运动与画面动态描述"
                        : "Motion & camera prompt"
                      : zh
                        ? "补充提示词"
                        : "Guidance prompt"}
                </span>
                <textarea
                  rows={4}
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder={
                    action === "inpaint"
                      ? zh
                        ? "例如：把外套换成银色未来感机能风夹克，保持光影一致"
                        : "e.g. Replace jacket with a sleek silver futuristic shell, matching lighting"
                      : undefined
                  }
                  className="cc-textarea"
                />
              </label>
            ) : null}

            {action === "cutout" && onLocalCutout ? (
              <div className="cc-local-box">
                <p className="cc-hint">
                  {zh
                    ? "纯色背景图片可直接免费本机透明抠图；复杂场景推荐使用下方 AI 智能抠图。"
                    : "Solid backdrops can be cut out locally for free as transparent PNG; complex scenes work best with AI Cutout below."}
                </p>
                <button type="button" className="cc-secondary-btn" onClick={() => void runInstantLocalCutout()}>
                  <Download className="h-3.5 w-3.5" />
                  {zh ? "免费快速透明抠图（纯色背景）" : "Instant Free Cutout (Solid Backdrop)"}
                </button>
              </div>
            ) : null}

            {localError ? <p className="cc-error">{localError}</p> : null}

            <div className="cc-modal-foot">
              <button type="button" className="cc-secondary-btn" onClick={onClose}>
                {zh ? "取消" : "Cancel"}
              </button>
              <button type="button" className="cc-primary-btn" disabled={submitting} onClick={() => void handleConfirm()}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {submitting
                  ? zh
                    ? "提交中…"
                    : "Submitting…"
                  : zh
                    ? `确认生成 · ${creditCost} 积分`
                    : `Generate · ${creditCost} credits`}
              </button>
            </div>
          </div>
        </div>
    </CanvasEditDialog>
  );
}
