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
import { cn } from "@/components/ui";
import { DEFAULT_VIDEO_MODELS } from "@/components/video-generator";
import { getAvailableModels, calculateModelCredits } from "@/config/credits";
import { X, Sparkles, Image as ImageIcon, Check } from "lucide-react";

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
  availableCredits?: number | null;
  locale?: string;
}

const UNKNOWN_VALUE = "—";

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
  availableCredits,
  locale = "en",
}: GeneratorPanelProps) {
  const models = getAvailableModels();
  const [prompt, setPrompt] = useState(initialPrompt || "");
  const [selectedModel, setSelectedModel] = useState(initialModelId || defaultModelId || models[0]?.id || "");
  const [duration, setDuration] = useState(initialDuration || 10);
  const [aspectRatio, setAspectRatio] = useState(initialAspectRatio || "16:9");
  const [quality, setQuality] = useState(initialQuality || "standard");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(initialImageUrl || null);

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

  useEffect(() => {
    if (initialPrompt && !prompt) {
      setPrompt(initialPrompt);
    }
    if (initialImageUrl && !imageFile && !imageUrl) {
      setImageUrl(initialImageUrl);
    }
  }, [initialPrompt, initialImageUrl, prompt, imageFile, imageUrl]);

  useEffect(() => {
    if (!currentModel) return;
    if (initialDuration && currentModel.durations?.includes(initialDuration)) {
      setDuration(initialDuration);
    }
    if (initialAspectRatio && currentModel.aspectRatios?.includes(initialAspectRatio)) {
      setAspectRatio(initialAspectRatio);
    }
    if (initialQuality && currentModel.qualities?.includes(initialQuality)) {
      setQuality(initialQuality);
    }
  }, [currentModel, initialDuration, initialAspectRatio, initialQuality]);

  const estimatedCredits = useMemo(() => {
    if (!selectedModel) return 0;
    return calculateModelCredits(selectedModel, {
      duration,
      quality: currentModel?.qualities?.includes(quality) ? quality : undefined,
    });
  }, [selectedModel, duration, quality, currentModel]);

  const modelDetails = useMemo(() => {
    return new Map(
      availableModels.map((model) => {
        const metadata = modelMetadata.get(model.id);
        const configRecord = model as unknown as Record<string, unknown>;
        const metadataRecord = (metadata?.metadata ?? {}) as Record<string, unknown>;
        const speedValue =
          configRecord.speed ??
          configRecord.latency ??
          configRecord.estimatedTime ??
          configRecord.estimated_time ??
          metadataRecord.speed ??
          metadataRecord.latency ??
          metadataRecord.estimatedTime ??
          metadataRecord.estimated_time;
        const speed = speedValue === undefined || speedValue === null || speedValue === ""
          ? UNKNOWN_VALUE
          : String(speedValue);
        const qualities = model.qualities?.length ? model.qualities.join(" / ") : UNKNOWN_VALUE;
        const audio = metadata?.supportsAudio === undefined
          ? UNKNOWN_VALUE
          : metadata.supportsAudio
            ? "Yes"
            : "No";
        const unitPrice = model.creditCost?.perExtraSecond !== undefined
          ? `${model.creditCost.perExtraSecond} cr/s`
          : model.creditCost?.base !== undefined
            ? `${model.creditCost.base} cr`
            : UNKNOWN_VALUE;

        return [model.id, { speed, qualities, audio, unitPrice }] as const;
      })
    );
  }, [availableModels, modelMetadata]);

  const canSubmit = hasAvailableModels &&
    Boolean(currentModel) &&
    prompt.trim().length > 0 &&
    (!((toolType !== "text-to-video") && !imageFile && !imageUrl)) &&
    !isLoading;

  const handleSubmit = useCallback(() => {
    if (!canSubmit || !currentModel) return;

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
    canSubmit,
  ]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.repeat ||
        event.isComposing ||
        event.key !== "Enter" ||
        (!event.ctrlKey && !event.metaKey)
      ) return;
      event.preventDefault();
      handleSubmit();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [handleSubmit]);

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

  // Get page title
  const getPageTitle = () => {
    if (toolType === "image-to-video") return "IMAGE TO VIDEO";
    if (toolType === "text-to-video") return "TEXT TO VIDEO";
    if (toolType === "reference-to-video") return "REFERENCE TO VIDEO";
    return "AI GENERATOR";
  };

  const balanceLabel = availableCredits ?? UNKNOWN_VALUE;
  const costText = locale.startsWith("zh")
    ? `本次扣 ${estimatedCredits} 积分 · 余额 ${balanceLabel}`
    : `This run: ${estimatedCredits} credits · Balance ${balanceLabel}`;
  const loadingCostText = locale.startsWith("zh")
    ? `生成中 · ${estimatedCredits} 积分 · 余额 ${balanceLabel}`
    : `Generating · ${estimatedCredits} credits · Balance ${balanceLabel}`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Main Card - Pollo.ai Style */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[16px] bg-transparent text-foreground">
        {/* Header Bar */}
        <div className="px-1 pb-2 shrink-0">
          <h2 className="text-sm text-muted-foreground font-medium uppercase tracking-wide">
            {getPageTitle()}
          </h2>
        </div>

        {/* Scrollable Content */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
          {!hasAvailableModels && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              No models are currently available for this tool under the active AI
              provider configuration.
            </div>
          )}

          {hasAvailableModels && (
            <>
          {/* Model Selection */}
          <div>
            <SectionLabel>MODEL</SectionLabel>
            <div className="space-y-2">
              {availableModels.map((model) => {
                const details = modelDetails.get(model.id);
                const selected = selectedModel === model.id;

                return (
                  <button
                    key={model.id}
                    type="button"
                    data-model-id={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    disabled={isLoading}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-all",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        {renderModelIcon(model.id, model.name, "md")}
                        <span className="truncate text-sm font-semibold text-foreground">{model.name}</span>
                      </div>
                      {selected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-muted-foreground">
                      <span>Speed <strong className="font-medium text-foreground">{details?.speed ?? UNKNOWN_VALUE}</strong></span>
                      <span>Quality <strong className="font-medium text-foreground">{details?.qualities ?? UNKNOWN_VALUE}</strong></span>
                      <span>Audio <strong className="font-medium text-foreground">{details?.audio ?? UNKNOWN_VALUE}</strong></span>
                      <span>Price <strong className="font-medium text-foreground">{details?.unitPrice ?? UNKNOWN_VALUE}</strong></span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          {/* Prompt Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <SectionLabel className="mb-0">PROMPT</SectionLabel>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the video you want to create, e.g., A cat playing in a sunny garden with natural lighting and fresh atmosphere..."
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
                  {toolType === "reference-to-video" ? "REFERENCE IMAGE" : "IMAGE SOURCE"}
                </SectionLabel>
                {imageFile || imageUrl ? (
                  <div className="relative group h-32 rounded-lg overflow-hidden border-2 border-zinc-700">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt="Selected"
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
                    <p className="text-sm text-muted-foreground mt-3">Upload image</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">JPG, PNG, WEBP • Max 10MB</p>
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
                <SectionLabel>ASPECT RATIO</SectionLabel>
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
                  <SectionLabel>VIDEO LENGTH</SectionLabel>
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
                  <SectionLabel>RESOLUTION</SectionLabel>
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
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Credits:</span>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              <span className="text-foreground font-medium">{estimatedCredits} Credits</span>
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
                ? "bg-[#D1FE17] hover:bg-[#D1FE17]/90 text-[#1A1A1A]"
                : "bg-white/10 text-white/40 cursor-not-allowed"
            )}
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                {loadingCostText}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {costText}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
