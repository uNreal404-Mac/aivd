"use client";

import { useMemo, useRef, useState } from "react";
import { AtSign, ChevronRight, Clapperboard, Clock, Gem, ImagePlus, Minus, Plus, RectangleHorizontal, RotateCcw, Sparkles, X } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { useSigninModal } from "@/hooks/use-signin-modal";
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

/** Small toolbar chip that cycles through its options on click. */
function CycleChip({
  icon,
  value,
  options,
  format,
  onChange,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  options: readonly string[];
  format: (option: string) => string;
  onChange: (option: string) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      className="is-chip"
      aria-label={`${label}: ${format(value)}`}
      title={label}
      onClick={() => onChange(options[(options.indexOf(value) + 1) % options.length])}
    >
      {icon}
      {format(value)}
    </button>
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
  const [modelId, setModelId] = useState(getMarketModel(initialModel)?.kind === "image" ? initialModel : IMAGE_MODELS[0].id);
  const model = getMarketModel(modelId) ?? IMAGE_MODELS[0];
  const options = model.options;
  const [prompt, setPrompt] = useState(initialPrompt);
  const [aspect, setAspect] = useState(options.aspects?.includes(initialAspect) ? initialAspect : (options.aspects?.[0] ?? "1:1"));
  const [resolution, setResolution] = useState(options.resolutions?.[0] ?? "");
  const [count, setCount] = useState(1);
  const [refs, setRefs] = useState<{ key: string; name: string; preview: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const { jobs, add } = useMediaJobs("image");
  const [viewing, setViewing] = useState<number | null>(null);

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
    promptRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
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
        setRefs((current) => [...current, { key: result.key, name: file.name, preview: URL.createObjectURL(file) }]);
      } else {
        setNotice(result.message);
      }
    }
  };

  const generate = async () => {
    if (!prompt.trim() || submitting || uploading) return;
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
      return;
    }
    add({ uuid: result.uuid, status: "queued", urls: [], prompt: prompt.trim(), model: model.id, createdAt: Date.now() });
  };
  const drop = useImageDrop((files) => void onFiles(files), !uploading);

  return (
    <main className="is-root">
      <div className="is-first">
      {jobs.length === 0 ? (
        <section className="is-hero">
          <div className="is-collage" aria-hidden="true">
            {COLLAGE.map((item) => (
              <img key={item.src} src={item.src} alt="" className={`is-photo ${item.className}`} />
            ))}
          </div>
          <h1 className="is-title">
            <span>{zh ? "用" : "Create with"}</span>
            <span className="is-title-model">{model.name}</span>
            <span>{zh ? "开始创作" : "today"}</span>
          </h1>
          <p className="is-sub">
            {zh ? "描述一个场景、角色、氛围或风格，看它即刻成真" : "Describe a scene, a character, a mood or a style and watch it appear"}
          </p>
        </section>
      ) : (
        <section className="is-results" aria-label={zh ? "生成结果" : "Results"}>
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
          <div className="is-toolbar">
            <span className="is-chip-group">
              <button
                type="button"
                className="is-chip is-chip-icon"
                disabled={maxImages === 0 || refs.length >= maxImages || uploading}
                title={maxImages === 0 ? (zh ? "该模型不支持参考图" : "This model takes no reference image") : zh ? `添加参考图（最多 ${maxImages} 张）` : `Add reference images (up to ${maxImages})`}
                aria-label={zh ? "添加参考图" : "Add reference image"}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Clock className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}
              </button>
              <span className="is-chip-sep" aria-hidden="true" />
              <button type="button" className="is-chip is-chip-icon" disabled title={zh ? "引用元素即将上线" : "Elements coming soon"} aria-label={zh ? "引用元素（即将上线）" : "Mention an element (coming soon)"}>
                <AtSign className="h-4 w-4" aria-hidden="true" />
              </button>
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(event) => {
                void onFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
            <div className="is-model">
              <KieModelPicker kind="image" locale={locale} value={modelId} connectedIds={IMAGE_MODEL_IDS} onChange={chooseModel} placement="top" compact />
              <ChevronRight className="is-model-chevron" aria-hidden="true" />
            </div>
            {options.aspects?.length ? (
              <CycleChip
                icon={<RectangleHorizontal className="h-4 w-4" aria-hidden="true" />}
                label={zh ? "画面比例" : "Aspect ratio"}
                value={aspect}
                options={options.aspects}
                format={(option) => (option === "auto" ? (zh ? "自动" : "Auto") : option)}
                onChange={setAspect}
              />
            ) : null}
            {options.resolutions?.length ? (
              <CycleChip
                icon={<Gem className="h-4 w-4" aria-hidden="true" />}
                label={zh ? "分辨率" : "Resolution"}
                value={resolution}
                options={options.resolutions}
                format={(option) => option}
                onChange={setResolution}
              />
            ) : null}
            <span className="is-stepper" title={maxCount === 1 ? (zh ? "该模型每次生成 1 张" : "This model makes one image at a time") : undefined}>
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
          </div>
        </div>
        <button type="submit" className="is-generate" disabled={!prompt.trim() || submitting || uploading}>
          <span>{submitting ? (zh ? "提交中…" : "Submitting…") : zh ? "生成" : "Generate"}</span>
          <span className="is-generate-sub">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {credits}
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
        </output>
      ) : null}
      </div>

      {/* Scrolling past the first screen: the shared homepage-style showcase */}
      <div className="is-below">
        <ImageShowcase lang={locale} />
      </div>
    </main>
  );
}
