"use client";

/**
 * Generator Panel Component - Pollo.ai Style
 *
 * Tool page generator panel with dark theme design
 * Design inspired by https://pollo.ai
 * - Dark theme (#1A1A1A background)
 * - Uppercase labels for sections
 * - Purple accent color (#6D28D9)
 * - Dashed border upload area
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { useLocale } from "next-intl";
import { cn } from "@/components/ui";
import { DEFAULT_VIDEO_MODELS } from "@/components/video-generator";
import { getAvailableModels, calculateModelCredits } from "@/config/credits";
import { ChevronDown, X, Sparkles, Image as ImageIcon, Clock, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// ============================================================================
// Types
// ============================================================================

interface SectionLabelProps {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}

function SectionLabel({ children, required, className }: SectionLabelProps) {
  return (
    <div className={cn("text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2 block", className)}>
      {children}
      {required && <span className="text-destructive ml-1">*</span>}
    </div>
  );
}

interface GeneratorPanelProps {
  toolType: "image-to-video" | "text-to-video" | "reference-to-video";
  isLoading?: boolean;
  onSubmit?: (data: GeneratorData) => void;
  availableModelIds?: string[];
  defaultModelId?: string;
  initialPrompt?: string;
  initialModelId?: string;
  initialDuration?: number;
  initialAspectRatio?: string;
  initialQuality?: string;
  initialImageUrl?: string;
}

export interface GeneratorData {
  toolType: string;
  model: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  quality?: string;
  outputNumber?: number;
  generateAudio?: boolean;
  imageFile?: File;
  imageUrl?: string;
  estimatedCredits: number;
}

export function GeneratorPanel({
  toolType,
  isLoading = false,
  onSubmit,
  availableModelIds,
  defaultModelId,
  initialPrompt,
  initialModelId,
  initialDuration,
  initialAspectRatio,
  initialQuality,
  initialImageUrl,
}: GeneratorPanelProps) {
  const locale = useLocale();
  const isChinese = locale.toLowerCase().startsWith("zh");
  const copy = isChinese
    ? {
        titles: {
          "image-to-video": "图片生成视频",
          "text-to-video": "文字生成视频",
          "reference-to-video": "参考图生成视频",
        } as Record<string, string>,
        noModels: "当前 AI 服务配置下，暂时没有可用于此工具的模型。",
        model: "模型",
        videoModels: "视频模型",
        prompt: "提示词",
        promptPlaceholder: "描述你想创建的视频，例如：一只猫在阳光花园中玩耍，画面自然明亮、空气清新……",
        referenceImage: "参考图片",
        imageSource: "图片来源",
        selected: "已选择",
        uploadImage: "上传图片",
        uploadHint: "JPG、PNG、WEBP · 最大 10MB",
        aspectRatio: "画面比例",
        videoLength: "视频时长",
        resolution: "分辨率",
        totalCredits: "所需积分：",
        credits: "积分",
        generating: "生成中…",
        generate: "生成视频",
      }
    : {
        titles: {
          "image-to-video": "IMAGE TO VIDEO",
          "text-to-video": "TEXT TO VIDEO",
          "reference-to-video": "REFERENCE TO VIDEO",
        } as Record<string, string>,
        noModels: "No models are currently available for this tool under the active AI provider configuration.",
        model: "MODEL",
        videoModels: "Video Models",
        prompt: "PROMPT",
        promptPlaceholder: "Describe the video you want to create, e.g., A cat playing in a sunny garden with natural lighting and fresh atmosphere...",
        referenceImage: "REFERENCE IMAGE",
        imageSource: "IMAGE SOURCE",
        selected: "Selected",
        uploadImage: "Upload image",
        uploadHint: "JPG, PNG, WEBP · Max 10MB",
        aspectRatio: "ASPECT RATIO",
        videoLength: "VIDEO LENGTH",
        resolution: "RESOLUTION",
        totalCredits: "Total Credits:",
        credits: "Credits",
        generating: "Generating...",
        generate: "Generate Video",
      };
  const models = getAvailableModels();
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [selectedModel, setSelectedModel] = useState(initialModelId || defaultModelId || models[0]?.id || "");
  const [duration, setDuration] = useState(initialDuration || 10);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio || "16:9");
  const [quality, setQuality] = useState(initialQuality || "standard");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Filter models based on tool type
  const availableModels = useMemo(() => {
    const allowList = Array.isArray(availableModelIds) && availableModelIds.length > 0;
    let filtered = allowList
      ? models.filter((m) => availableModelIds!.includes(m.id))
      : models;
    if (toolType === "image-to-video" || toolType === "reference-to-video") {
      filtered = filtered.filter((m) => m.supportImageToVideo);
    }
    return filtered;
  }, [toolType, models, availableModelIds]);

  const currentModel = useMemo(
    () => availableModels.find((m) => m.id === selectedModel) || availableModels[0],
    [selectedModel, availableModels]
  );
  const hasAvailableModels = availableModels.length > 0;

  const modelMetadata = useMemo(() => {
    return new Map(DEFAULT_VIDEO_MODELS.map((model) => [model.id, model]));
  }, []);

  const getModelIcon = (modelId: string, fallbackName: string) => {
    const meta = modelMetadata.get(modelId);
    return meta?.icon ?? fallbackName.charAt(0).toUpperCase();
  };

  const getModelColor = (modelId: string) => {
    const meta = modelMetadata.get(modelId);
    return meta?.color ?? "#71717a";
  };

  const renderModelIcon = (modelId: string, name: string, size: "sm" | "md" = "sm") => {
    const icon = getModelIcon(modelId, name);
    const color = getModelColor(modelId);
    const sizeClass = size === "sm" ? "w-4 h-4 text-xs" : "w-6 h-6 text-xs";

    if (typeof icon === "string" && (icon.startsWith("http://") || icon.startsWith("https://") || icon.startsWith("/"))) {
      return (
        <img
          src={icon}
          alt={name}
          className={cn(sizeClass, "rounded object-cover")}
        />
      );
    }

    return (
      <span
        className={cn(sizeClass, "rounded flex items-center justify-center font-bold")}
        style={{ backgroundColor: color, color: "#fff" }}
      >
        {typeof icon === "string" ? icon : name.charAt(0).toUpperCase()}
      </span>
    );
  };

  useEffect(() => {
    if (!currentModel) return;

    if (currentModel.durations && !currentModel.durations.includes(duration)) {
      setDuration(currentModel.durations[0] || duration);
    }

    if (currentModel.aspectRatios && !currentModel.aspectRatios.includes(aspectRatio)) {
      setAspectRatio(currentModel.aspectRatios[0] || aspectRatio);
    }

    if (currentModel.qualities) {
      if (!currentModel.qualities.includes(quality)) {
        setQuality(currentModel.qualities[0] || quality);
      }
    }
  }, [currentModel, duration, aspectRatio, quality]);

  useEffect(() => {
    if (!availableModels.length) return;
    if (selectedModel && availableModels.some((m) => m.id === selectedModel)) {
      return;
    }
    const fallback = defaultModelId && availableModels.some((m) => m.id === defaultModelId)
      ? defaultModelId
      : availableModels[0]?.id;
    if (fallback) {
      setSelectedModel(fallback);
    }
  }, [availableModels, selectedModel, defaultModelId]);

  // Session drafts arrive after hydration. Apply each draft once and keep
  // the resulting fields editable, including clearing the prompt or image.
  useEffect(() => {
    if (initialModelId) setSelectedModel(initialModelId);
    if (initialPrompt !== undefined) setPrompt(initialPrompt);
    if (initialDuration !== undefined) setDuration(initialDuration);
    if (initialAspectRatio) setAspectRatio(initialAspectRatio);
    if (initialQuality) setQuality(initialQuality);
    if (initialImageUrl) setImageUrl(initialImageUrl);
  }, [initialModelId, initialPrompt, initialDuration, initialAspectRatio, initialQuality, initialImageUrl]);

  const estimatedCredits = useMemo(() => {
    if (!selectedModel) return 0;
    return calculateModelCredits(selectedModel, {
      duration,
      quality: currentModel?.qualities?.includes(quality) ? quality : undefined,
    });
  }, [selectedModel, duration, quality, currentModel]);

  const handleSubmit = useCallback(() => {
    if (!currentModel) return;
    const hasPrompt = prompt.trim().length > 0;
    const requiresImage = toolType !== "text-to-video";
    const hasImage = Boolean(imageFile || imageUrl);
    if (!hasPrompt || isLoading) return;
    if (requiresImage && !hasImage) return;

    const data: GeneratorData = {
      toolType,
      model: selectedModel,
      prompt: prompt.trim(),
      duration,
      aspectRatio,
      quality: currentModel?.qualities?.includes(quality) ? quality : undefined,
      outputNumber: 1,
      imageFile: imageFile || undefined,
      imageUrl: imageUrl || undefined,
      estimatedCredits,
    };

    onSubmit?.(data);
  }, [
    prompt,
    selectedModel,
    duration,
    aspectRatio,
    quality,
    imageFile,
    imageUrl,
    estimatedCredits,
    isLoading,
    toolType,
    onSubmit,
    currentModel,
  ]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageUrl(null);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImageUrl(null);
  };

  const canSubmit = hasAvailableModels &&
    Boolean(currentModel) &&
    prompt.trim().length > 0 &&
    (!((toolType !== "text-to-video") && !imageFile && !imageUrl)) &&
    !isLoading;


  // Get page title
  const getPageTitle = () => {
    return copy.titles[toolType] ?? (isChinese ? "AI 生成器" : "AI GENERATOR");
  };

  return (
    <div className="h-full flex flex-col">
      {/* Main Card - Pollo.ai Style */}
      <div className="flex-1 flex flex-col rounded-[16px] bg-transparent overflow-hidden text-foreground">
        {/* Header Bar */}
        <div className="px-1 pb-2 shrink-0">
          <h2 className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
            {getPageTitle()}
          </h2>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {!hasAvailableModels && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {copy.noModels}
            </div>
          )}

          {hasAvailableModels && (
            <>
          {/* Model Selection */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              {copy.model}
            </span>
            {currentModel && (
                <DropdownMenu open={isModelDropdownOpen} onOpenChange={setIsModelDropdownOpen}>
                <DropdownMenuTrigger asChild disabled={isLoading}>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 rounded-full bg-[var(--du-surface-2)] px-3 py-1.5 text-sm text-[var(--du-text)] transition-colors hover:bg-[var(--du-accent-hover)]"
                  >
                    {renderModelIcon(currentModel.id, currentModel.name, "sm")}
                    <span>{currentModel.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-zinc-900 border-zinc-800 w-80 max-h-[400px] overflow-y-scroll custom-scrollbar">
                  <DropdownMenuLabel className="text-zinc-400 text-xs">
                    {copy.videoModels}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-zinc-800" />
                  {availableModels.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      data-model-id={model.id}
                      onClick={() => setSelectedModel(model.id)}
                      className="flex flex-col items-start py-3 text-[var(--du-text)] hover:bg-[var(--du-surface-2)]"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {renderModelIcon(model.id, model.name, "md")}
                          <span className="font-medium">{model.name}</span>
                        </div>
                        {selectedModel === model.id && (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                      </div>
                      {model.description && (
                        <div className="text-xs text-zinc-500 mt-1 ml-8">{model.description}</div>
                      )}
                      <div className="text-xs text-zinc-400 mt-1 ml-8 flex items-center gap-2">
                        {model.maxDuration && (
                          <>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {model.maxDuration}
                            </span>
                            <span>•</span>
                          </>
                        )}
                        <span>{model.creditCost?.base ?? ""} {copy.credits}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* Prompt Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel className="mb-0">{copy.prompt}</SectionLabel>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={copy.promptPlaceholder}
              disabled={isLoading}
              className="w-full min-h-[100px] max-h-[200px] px-4 py-3 rounded-lg bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground/70 resize-none focus:outline-none focus:border-primary transition-colors text-sm leading-relaxed"
              rows={4}
              maxLength={2000}
            />
          </div>

          {/* Image Upload (for image-to-video) */}
          {(toolType === "image-to-video" || toolType === "reference-to-video") &&
            currentModel?.supportImageToVideo && (
              <div>
                <SectionLabel required={toolType === "image-to-video"}>
                  {toolType === "reference-to-video" ? copy.referenceImage : copy.imageSource}
                </SectionLabel>
                {imageFile || imageUrl ? (
                  <div className="relative group h-32 rounded-lg overflow-hidden border-2 border-zinc-700">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={copy.selected}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center p-3">
                        <span className="text-xs font-medium truncate bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border">
                          {imageFile?.name}
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-muted/80 hover:bg-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5 text-foreground" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors group">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-muted/60 group-hover:bg-muted transition-colors">
                      <ImageIcon className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-3">{copy.uploadImage}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{copy.uploadHint}</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                      disabled={isLoading}
                    />
                  </label>
                )}
              </div>
            )}


          {/* Settings Group */}
          <div className="space-y-5">
            {/* Aspect Ratio */}
            {currentModel?.aspectRatios && (
              <div>
                <SectionLabel>{copy.aspectRatio}</SectionLabel>
                <div className="grid grid-cols-3 gap-3">
                  {currentModel.aspectRatios.map((ar) => (
                    <button
                      key={ar}
                      type="button"
                      onClick={() => setAspectRatio(ar)}
                      disabled={isLoading}
                      className={cn(
                        "aspect-square w-full rounded-lg text-xs font-medium transition-all border flex items-center justify-center",
                        aspectRatio === ar
                          ? "bg-primary/10 text-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground border-border hover:border-muted-foreground/40"
                      )}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className={cn(
                          "border-2 rounded-sm",
                          aspectRatio === ar ? "border-primary" : "border-muted-foreground/50",
                          ar === "16:9" && "w-8 h-4",
                          ar === "9:16" && "w-4 h-8",
                          ar === "1:1" && "w-6 h-6",
                          ar === "4:3" && "w-6 h-4",
                          ar === "3:4" && "w-4 h-6"
                        )} />
                        <span>{ar}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Duration & Quality */}
            <div className="grid grid-cols-2 gap-4">
              {currentModel?.durations && (
                <div>
                  <SectionLabel>{copy.videoLength}</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {currentModel.durations.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setDuration(d)}
                        disabled={isLoading}
                        className={cn(
                          "h-10 rounded-lg text-sm font-medium transition-all",
                          duration === d
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                        )}
                      >
                        {d}s
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentModel?.qualities && (
                <div>
                  <SectionLabel>{copy.resolution}</SectionLabel>
                  <div className="grid grid-cols-3 gap-2">
                    {currentModel.qualities.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setQuality(q)}
                        disabled={isLoading}
                        className={cn(
                          "h-10 rounded-lg text-sm font-medium transition-all capitalize",
                          quality === q
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                        )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>

        {/* Bottom Section - Credits + Generate Button */}
        <div className="sticky bottom-0 shrink-0 space-y-3 bg-[var(--du-surface)] px-1 pb-1 pt-3">
          {/* Credits Display */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{copy.totalCredits}</span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[var(--du-accent)]" />
              <span className="text-foreground font-medium">{estimatedCredits} {copy.credits}</span>
            </div>
          </div>

          {/* Generate Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={cn(
              "w-full h-14 flex items-center justify-center gap-2 px-4 rounded-[12px] text-base font-semibold transition-all shadow-[inset_0_-3px_0_rgba(0,0,0,0.15)]",
              canSubmit
                ? "bg-[var(--du-accent)] text-[var(--du-on-accent)] hover:bg-[var(--du-accent-hover)]"
                : "cursor-not-allowed bg-[var(--du-surface-2)] text-[var(--du-text-muted)]"
            )}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                {copy.generating}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {copy.generate}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
