"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clapperboard, Clock, Gem, ImagePlus, Minus, Paintbrush, Plus, RectangleHorizontal, RotateCcw, Sparkles, X } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { useCreditReturnDraft } from "@/hooks/use-credit-return-draft";
import { currentUploadUrls } from "@/lib/home-media-library";
import { readyPickerImage, type PickerAsset } from "@/lib/home-media-library";
import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSession } from "@/lib/auth/client";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { uploadImage, validateImageFile } from "@/lib/image-to-video";
import { submitMedia, useMediaJobs } from "@/lib/media-studio";
import { ImageShowcase } from "@/components/hf/image-showcase";
import {
  CopyPromptButton,
  DownloadLink,
  MediaViewer,
  PendingCard,
  sendImageToVideo,
  useImageDrop,
  type ViewerItem,
} from "@/components/hf/studio-results";
import { localizedHref } from "@/lib/du-home";
import { scrollMotion } from "@/lib/reduced-motion";
import "./ai-image-studio.css";

// Tilted photo stack above the title, as on the reference image page.
const COLLAGE = [
  { src: "/home/samples/red-carpet.webp", className: "is-1" },
  { src: "/home/samples/rain-couple.webp", className: "is-2" },
  { src: "/home/samples/dancer.webp", className: "is-3" },
  { src: "/home/samples/autumn-walk.webp", className: "is-4" },
];

const IMAGE_MODELS = marketModelsOf("image");
const IMAGE_MODEL_IDS = IMAGE_MODELS.map((model) => model.id);

const IMAGE_STYLE_PRESETS = [
  { id: "cinematic", zh: "电影质感", en: "Cinematic", thumb: "/home/samples/red-carpet.webp", suffixZh: "，电影级光影，35mm 胶片颗粒，景深细腻", suffixEn: ", cinematic lighting, 35mm film grain, shallow depth of field" },
  { id: "commercial", zh: "商业棚拍", en: "Studio Product", thumb: "/home/samples/studio-room.webp", suffixZh: "，高端商业摄影棚布光，极简干净背景，8K 细节", suffixEn: ", luxury studio product photography, softbox rim light, crisp 8K detail" },
  { id: "cyber", zh: "赛博霓虹", en: "Cyber Neon", thumb: "/home/samples/rain-couple.webp", suffixZh: "，雨夜霓虹反射，青紫电影色调，高对比氛围", suffixEn: ", neon rain reflections, cyan and magenta cinema grade, atmospheric" },
  { id: "toy", zh: "3D 潮玩", en: "3D Designer Toy", thumb: "/home/samples/cosmic-bloom.webp", suffixZh: "，盲盒潮玩 3D 渲染，磨砂 PVC 材质，柔和棚拍光", suffixEn: ", 3D designer vinyl toy render, matte PVC texture, soft studio glow" },
  { id: "anime", zh: "动画电影", en: "Anime Film", thumb: "/home/samples/dancer.webp", suffixZh: "，高水准剧场版动画风格，通透光影，细腻背景", suffixEn: ", theatrical anime film key visual, luminous lighting, painterly background" },
  { id: "editorial", zh: "时尚杂志", en: "Editorial", thumb: "/home/samples/autumn-walk.webp", suffixZh: "，Vogue 时尚大片构图，自然肤质纹理，高定美学", suffixEn: ", high-fashion editorial portrait, natural skin texture, clean composition" },
];

/** Visual wireframe rectangle dimensions for Pollo-style aspect ratio tiles. */
function aspectTileSize(option: string): { w: number; h: number; auto?: boolean } {
  if (option === "auto") return { w: 18, h: 18, auto: true };
  const parts = option.split(":").map(Number);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { w: 18, h: 18 };
  const ratio = parts[0] / parts[1];
  const maxSide = 22;
  if (ratio >= 1) return { w: maxSide, h: Math.max(9, Math.round(maxSide / ratio)) };
  return { w: Math.max(9, Math.round(maxSide * ratio)), h: maxSide };
}

/**
 * Toolbar chip that opens a small menu of its options above the composer.
 * (It used to step to the next value on each click, which hid the choices.)
 * A single option reads as a plain value.
 */
function MenuChip({
  icon,
  value,
  options,
  format,
  onChange,
  label,
  visualAspect = false,
}: {
  icon: React.ReactNode;
  value: string;
  options: readonly string[];
  format: (option: string) => string;
  onChange: (option: string) => void;
  label: string;
  visualAspect?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (options.length <= 1) {
    return (
      <span className="is-chip is-chip-fixed" title={label}>
        {icon}
        {format(value)}
      </span>
    );
  }

  return (
    <span ref={wrapRef} className="is-menu-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="is-chip"
        aria-label={`${label}: ${format(value)}`}
        aria-haspopup="true"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((current) => !current)}
      >
        {icon}
        {format(value)}
      </button>
      {open ? (
        <fieldset className={visualAspect ? "is-menu is-menu-aspect" : "is-menu"}>
          <legend className="is-menu-title">{label}</legend>
          <span className="is-menu-grid">
            {options.map((option) => {
              const box = visualAspect ? aspectTileSize(option) : null;
              return (
                <button
                  key={option}
                  type="button"
                  className={visualAspect ? "is-menu-item is-menu-item-aspect" : "is-menu-item"}
                  aria-pressed={option === value}
                  onClick={() => {
                    onChange(option);
                    setOpen(false);
                    buttonRef.current?.focus();
                  }}
                >
                  {box ? (
                    <span
                      className={box.auto ? "is-ratio-box is-ratio-box-auto" : "is-ratio-box"}
                      style={{ width: box.w, height: box.h }}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span>{format(option)}</span>
                </button>
              );
            })}
          </span>
        </fieldset>
      ) : null}
    </span>
  );
}

export function AiImageStudio({
  locale,
  initialPrompt = "",
  initialModel = "",
  initialAspect = "",
}: {
  locale: string;
  initialPrompt?: string;
  initialModel?: string;
  initialAspect?: string;
}) {
  const zh = locale.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  const { data: session } = useSession();
  const internalFree = process.env.NEXT_PUBLIC_IS_PREVIEW === "true" &&
    session?.user?.isAdmin === true && session.user.isSuperAccount === true;
  const [modelId, setModelId] = useState(getMarketModel(initialModel)?.kind === "image" ? initialModel : IMAGE_MODELS[0].id);
  const model = getMarketModel(modelId) ?? IMAGE_MODELS[0];
  const options = model.options;
  const [prompt, setPrompt] = useState(initialPrompt);
  const draft = usePromptDraft("image", prompt, setPrompt, Boolean(initialPrompt));
  const [aspect, setAspect] = useState(options.aspects?.includes(initialAspect) ? initialAspect : (options.aspects?.[0] ?? "1:1"));
  const [resolution, setResolution] = useState(options.resolutions?.[0] ?? "");
  const [count, setCount] = useState(1);
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(4);
  const [refs, setRefs] = useState<{ key: string; name: string; preview: string; sourceId?: string }[]>([]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  useEffect(() => {
    const handoff = sessionStorage.getItem("aivd:home-image-references");
    if (!handoff) return;
    sessionStorage.removeItem("aivd:home-image-references");
    try {
      const rows: unknown = JSON.parse(handoff);
      if (Array.isArray(rows)) setRefs(rows.filter((row): row is { key: string; name: string; url: string } =>
        typeof row?.key === "string" && typeof row?.name === "string" && typeof row?.url === "string"
      ).map((row) => ({ key: row.key, name: row.name, preview: row.url })).slice(0, maxImages));
    } catch { /* Ignore a stale handoff. */ }
  }, []);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const creditsShortfall = useCreditsShortfall(zh);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const { jobs, add } = useMediaJobs("image", Boolean(session));
  const [viewing, setViewing] = useState<number | null>(null);
  const openInCanvas = (url: string, text: string, modelName?: string) => {
    try {
      sessionStorage.setItem("aivd:canvas-handoff", JSON.stringify({ url, prompt: text, model: modelName, kind: "image" }));
    } catch { /* ignore */ }
    window.location.href = localizedHref(locale, "/creative-space/canvas");
  };
  useCreditReturnDraft("image", () => ({ modelId, prompt, aspect, resolution, count, refs }), (saved) => {
    if (getMarketModel(saved.modelId)?.kind === "image") setModelId(saved.modelId);
    setPrompt(saved.prompt ?? "");
    setAspect(saved.aspect ?? "1:1");
    setResolution(saved.resolution ?? "");
    setCount(saved.count ?? 1);
    setRefs(Array.isArray(saved.refs) ? saved.refs : []);
    void currentUploadUrls().then((urls) => setRefs((items) => items.map((item) => ({ ...item, preview: urls.get(item.key) ?? item.preview }))));
  });

  // Every finished image, in order, for the full-screen viewer.
  const gallery = useMemo<ViewerItem[]>(
    () =>
      jobs.flatMap((job) =>
        job.status === "completed"
          ? job.urls.map((url, index) => ({
              key: `${job.uuid}-${index}`,
              url,
              kind: "image" as const,
              prompt: job.prompt,
              model: getMarketModel(job.model)?.name ?? job.model,
            }))
          : [],
      ),
    [jobs],
  );

  const reuse = (text: string) => {
    setPrompt(text);
    setNotice(null);
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ block: "center", behavior: scrollMotion() });
  };
  const toVideo = (url: string) => sendImageToVideo(url, localizedHref(locale, "/ai/video"), zh ? "生成的图片" : "Generated image");

  const maxCount = options.maxCount ?? 1;
  const maxImages = options.maxImages ?? 0;
  const credits = useMemo(
    () =>
      marketCredits(model, {
        prompt,
        aspectRatio: aspect,
        resolution: resolution || undefined,
        count,
        imageUrls: refs.map((item) => item.key),
      }),
    [model, prompt, aspect, resolution, count, refs],
  );

  // Switching models keeps choices that the new model accepts.
  const chooseModel = (id: string) => {
    const next = getMarketModel(id);
    if (!next) return;
    setModelId(id);
    setAspect((current) => (next.options.aspects?.includes(current) ? current : (next.options.aspects?.[0] ?? "1:1")));
    setResolution((current) => (next.options.resolutions?.includes(current) ? current : (next.options.resolutions?.[0] ?? "")));
    setCount((current) => Math.min(current, next.options.maxCount ?? 1));
    setRefs((current) => current.slice(0, next.options.maxImages ?? 0));
  };

  const onFiles = async (files: File[]) => {
    if (maxImages === 0) {
      setNotice(zh ? "该模型不支持参考图。" : "This model takes no reference image.");
      return;
    }
    const room = maxImages - refs.length;
    for (const file of files.slice(0, Math.max(0, room))) {
      const error = validateImageFile(file);
      if (error) {
        setNotice(error);
        continue;
      }
      setUploading(true);
      const result = await uploadImage(file);
      setUploading(false);
      if (result.ok) {
        setRefs((current) => [...current, { key: result.key, name: file.name, preview: result.url, sourceId: `upload:${result.key}` }]);
      } else {
        setNotice(result.message);
      }
    }
  };

  const selectMedia = async (items: PickerAsset[]) => {
    setUploading(true);
    setNotice(null);
    try {
      const selected = await Promise.all(items.map(readyPickerImage));
      setRefs(selected.map((item) => ({ key: item.key, name: item.name, preview: item.url, sourceId: item.sourceId })));
    } catch (error) { setNotice(error instanceof Error ? error.message : (zh ? "素材上传失败，请重试。" : "Could not prepare the media. Try again.")); }
    finally { setUploading(false); }
  };

  const generate = async () => {
    if (submitting || uploading) return;
    // An empty prompt gets a hint and the cursor, not a dead button.
    if (!prompt.trim()) {
      setNotice(zh ? "先写一句提示词，描述你想要的画面。" : "Write a prompt describing the image you want.");
      promptRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setNotice(null);
    const result = await submitMedia(
      {
        model: model.id,
        prompt: prompt.trim(),
        aspectRatio: aspect,
        resolution: resolution || undefined,
        count,
        imageUrls: refs.map((item) => item.key),
      },
      zh,
    );
    setSubmitting(false);
    if (!result.ok) {
      setNotice(result.message);
      if (result.needsLogin) signIn.onOpen();
      if (result.code === "INSUFFICIENT_CREDITS") creditsShortfall.report(result.message, result.requiredCredits);
      return;
    }
    add({ uuid: result.uuid, status: "queued", urls: [], prompt: prompt.trim(), model: model.id, createdAt: Date.now() });
  };
  const drop = useImageDrop((files) => void onFiles(files), !uploading);

  return (
    <div className="is-root">
      <HomeMediaPicker
        lang={locale}
        open={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(items) => void selectMedia(items)}
        onDelete={(id) => setRefs((current) => current.filter((item) => (item.sourceId ?? `upload:${item.key}`) !== id))}
        maxSelected={maxImages}
        selectedIds={refs.map((item) => item.sourceId ?? `upload:${item.key}`)}
        userId={session?.user?.id}
      />
      <div className="is-first">
      {jobs.length === 0 ? (
        <section className="is-hero">
          <div className="is-collage" aria-hidden="true">
            {COLLAGE.map((item) => (
              <img key={item.src} src={item.src} alt="" className={`is-photo ${item.className}`} />
            ))}
          </div>
          <h1 className={zh ? "is-title is-title-inline" : "is-title"}>
            <span>{zh ? "用" : "Create with"}</span>
            <span className="is-title-model">{model.name}</span>
            <span>{zh ? "开始创作" : "today"}</span>
          </h1>
          <p className="is-sub">
            {zh ? "描述一个场景、角色、氛围或风格，看它即刻成真" : "Describe a scene, a character, a mood or a style and watch it appear"}
          </p>
        </section>
      ) : (
        <div className="is-results-wrap">
          <div className="is-results-bar">
            <span className="is-results-count">{zh ? `共 ${jobs.length} 组作品` : `${jobs.length} creations`}</span>
            <fieldset className="is-density m-0" aria-label={zh ? "网格视图密度" : "Grid view density"}>
              {([2, 3, 4] as const).map((cols) => (
                <button
                  key={cols}
                  type="button"
                  aria-pressed={gridCols === cols}
                  className={gridCols === cols ? "is-density-btn is-density-btn-on" : "is-density-btn"}
                  onClick={() => setGridCols(cols)}
                >
                  {cols} {zh ? "列" : "col"}
                </button>
              ))}
            </fieldset>
          </div>
          <section className={`is-results is-results-${gridCols}`} aria-label={zh ? "生成结果" : "Results"}>
          {jobs.map((job) =>
            job.status === "completed" && job.urls.length > 0 ? (
              job.urls.map((url, index) => {
                const position = gallery.findIndex((item) => item.key === `${job.uuid}-${index}`);
                return (
                  <figure key={`${job.uuid}-${index}`} className="sr-card is-result">
                    <img src={url} alt={job.prompt} loading="lazy" />
                    <button type="button" className="sr-card-open" aria-label={zh ? "查看大图" : "Open image"} onClick={() => setViewing(position)} />
                    <span className="sr-card-shade" aria-hidden="true" />
                    <span className="sr-card-top">
                      <CopyPromptButton prompt={job.prompt} zh={zh} />
                      <DownloadLink url={url} zh={zh} />
                    </span>
                    <span className="sr-card-bottom">
                      <span className="sr-card-prompt">{job.prompt}</span>
                      <button type="button" className="sr-icon" title={zh ? "复用提示词" : "Reuse prompt"} aria-label={zh ? "复用提示词" : "Reuse prompt"} onClick={() => reuse(job.prompt)}>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" className="sr-icon" title={zh ? "在无限画布中局部重绘 / 扩图" : "Edit in Infinite Canvas"} aria-label={zh ? "在无限画布中编辑" : "Edit in Infinite Canvas"} onClick={() => openInCanvas(url, job.prompt, getMarketModel(job.model)?.name ?? job.model)}>
                        <Paintbrush className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button type="button" className="sr-icon" title={zh ? "用这张图生成视频" : "Make a video from this"} aria-label={zh ? "用这张图生成视频" : "Make a video from this"} onClick={() => toVideo(url)}>
                        <Clapperboard className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </span>
                  </figure>
                );
              })
            ) : (
              <PendingCard
                key={job.uuid}
                className="is-result is-result-wait"
                status={job.status === "completed" ? "failed" : job.status}
                since={job.createdAt}
                prompt={job.prompt}
                message={job.status === "completed" ? (zh ? "没有返回图片" : "No image came back") : job.message}
                zh={zh}
                onReuse={() => reuse(job.prompt)}
              />
            ),
          )}
        </section>
        </div>
      )}

      <form
        {...drop.bind}
        className={`is-composer sr-drop ${drop.over ? "sr-drop-on" : ""}`}
        data-drop-label={zh ? "松开即可添加参考图" : "Drop to add reference images"}
        onSubmit={(event) => {
          event.preventDefault();
          void generate();
        }}
      >
        <div className="is-composer-main">
          {refs.length > 0 ? (
            <div className="is-refs">
              {refs.map((item) => (
                <span key={item.key} className="is-ref">
                  <img src={item.preview} alt={item.name} />
                  <button type="button" aria-label={zh ? "移除" : "Remove"} onClick={() => setRefs((current) => current.filter((ref) => ref.key !== item.key))}>
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <label htmlFor="image-prompt" className="sr-only">
            {zh ? "图片提示词" : "Image prompt"}
          </label>
          <textarea
            id="image-prompt"
            ref={promptRef}
            value={prompt}
            maxLength={5000}
            rows={2}
            onChange={(event) => {
              setPrompt(event.target.value);
              setNotice(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void generate();
            }}
            placeholder={zh ? "描述你想象中的场景" : "Describe the scene you imagine"}
          />
          {draft.restored ? (
                <p className="draft-note">
                  {zh ? "已恢复上次没生成的草稿" : "Your unsent draft is back"}
                  <button type="button" onClick={draft.discard}>
                    {zh ? "清空" : "Clear"}
                  </button>
                </p>
              ) : null}
          <div className="is-style-strip" aria-label={zh ? "风格预设" : "Style presets"}>
            {IMAGE_STYLE_PRESETS.map((preset) => {
              const suffix = zh ? preset.suffixZh : preset.suffixEn;
              const bare = suffix.replace(/^[，,\s]+/, "");
              const active = prompt.includes(bare);
              return (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={active}
                  className={active ? "is-style-pill is-style-pill-on" : "is-style-pill"}
                  onClick={() => {
                    setPrompt((cur) => {
                      if (cur.includes(suffix)) return cur.replace(suffix, "").trim();
                      if (cur.includes(bare)) return cur.replace(bare, "").replace(/^[，,\s]+|[，,\s]+$/g, "").trim();
                      return `${cur.trim()}${cur.trim() ? suffix : bare}`;
                    });
                    promptRef.current?.focus();
                  }}
                >
                  <img src={preset.thumb} alt="" className="is-style-swatch" loading="eager" />
                  <span>{zh ? preset.zh : preset.en}</span>
                </button>
              );
            })}
          </div>
          <div className="is-toolbar">
            <span className="is-chip-group">
              <button
                type="button"
                className="is-chip is-chip-icon"
                disabled={maxImages === 0 || uploading}
                title={maxImages === 0 ? (zh ? "该模型不支持参考图" : "This model takes no reference image") : zh ? `添加参考图（最多 ${maxImages} 张）` : `Add reference images (up to ${maxImages})`}
                aria-label={zh ? "添加参考图" : "Add reference image"}
                onClick={() => setMediaPickerOpen(true)}
              >
                {uploading ? <Clock className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
              </button>
            </span>
            <div className="is-model">
              <KieModelPicker kind="image" locale={locale} value={modelId} connectedIds={IMAGE_MODEL_IDS} onChange={chooseModel} placement="top" compact />
              <ChevronRight className="is-model-chevron" aria-hidden="true" />
            </div>
            {options.aspects?.length ? (
              <MenuChip
                icon={<RectangleHorizontal className="h-4 w-4" aria-hidden="true" />}
                label={zh ? "画面比例" : "Aspect ratio"}
                value={aspect}
                options={options.aspects}
                format={(option) => (option === "auto" ? (zh ? "自动" : "Auto") : option)}
                onChange={setAspect}
                visualAspect
              />
            ) : null}
            {options.resolutions?.length ? (
              <MenuChip
                icon={<Gem className="h-4 w-4" aria-hidden="true" />}
                label={zh ? "分辨率" : "Resolution"}
                value={resolution}
                options={options.resolutions}
                format={(option) => option}
                onChange={setResolution}
              />
            ) : null}
            {maxCount <= 1 ? (
              <span className="is-chip is-chip-fixed" title={zh ? "这个模型每次生成 1 张" : "This model makes one image at a time"}>
                {zh ? "1 张" : "1 image"}
              </span>
            ) : (
            <span className="is-stepper">
              <button type="button" aria-label={zh ? "减少数量" : "Fewer images"} disabled={count <= 1} onClick={() => setCount((value) => Math.max(1, value - 1))}>
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span>
                {count}/{maxCount}
              </span>
              <button type="button" aria-label={zh ? "增加数量" : "More images"} disabled={count >= maxCount} onClick={() => setCount((value) => Math.min(maxCount, value + 1))}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </span>
            )}
          </div>
        </div>
        <button type="submit" className="is-generate" disabled={submitting || uploading}>
          <span>{submitting ? (zh ? "提交中…" : "Submitting…") : zh ? "生成" : "Generate"}</span>
          <span className="is-generate-sub">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {internalFree ? 0 : credits}
          </span>
        </button>
      </form>
      {viewing !== null && gallery[viewing] ? (
        <MediaViewer
          items={gallery}
          index={viewing}
          zh={zh}
          onIndex={setViewing}
          onClose={() => setViewing(null)}
          onReuse={(item) => reuse(item.prompt)}
          onToVideo={(item) => toVideo(item.url)}
        />
      ) : null}
      {notice ? (
        <output className="is-notice" aria-live="polite">
          {notice}
          {creditsShortfall.action(notice)}
        </output>
      ) : null}
      </div>

      {/* Scrolling past the first screen: the shared homepage-style showcase */}
      <div className="is-below">
        <ImageShowcase lang={locale} />
      </div>
    </div>
  );
}
