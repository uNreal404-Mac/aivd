"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Check, ChevronDown, Coins, Film, Image as ImageIcon, Loader2, Music2, Plus, RefreshCw, Settings2, X } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";

// Image models that can generate; the image tab hands off to /ai/image.
const IMAGE_MODEL_IDS = marketModelsOf("image").map((model) => model.id);
import { localizedHref } from "@/lib/du-home";
import { uploadImage, validateImageFile } from "@/lib/image-to-video";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import { HOME_TEMPLATES } from "@/lib/home-templates";
import { MAX_HOME_VIDEO_REFERENCES, maxVideoReferences, prepareVideoReferencePrompt, removeVideoReferenceToken } from "@/lib/video-references";
import "./home-generator.css";

type Model = { id: string; name: string; durations: number[]; aspects: string[] };
export type HomeGeneratorPreset = { prompt: string; aspect?: string; nonce: number };
type Props = { lang: string; models: Model[]; onModelChange: (id: string) => void; preset?: HomeGeneratorPreset | null; initialKind?: "video" | "image"; initialPrompt?: string; hideKindTabs?: boolean };
type Panel = "mode" | "settings" | null;

const VIDEO_ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"];
const IMAGE_ASPECTS = ["1:1", "16:9", "3:2", "2:3", "3:4", "4:3", "9:16", "4:5", "5:4"];
const VIDEO_MODES = ["reference", "text"] as const;
const DEFAULT_VIDEO_MODEL_ID = "bytedance/seedance-2-5";

/**
 * The server passes the credit-config models; the studio at /ai/video also runs
 * the KIE market models. Offer both here so the home picker and the studio agree
 * on which models are ready (Seedance 2.5 and friends were shown as disabled).
 */
function withStudioModels(models: Model[]): Model[] {
  const extra = STUDIO_MODELS.filter((item) => item.available && !models.some((model) => model.id === item.id)).map((item) => ({
    id: item.id,
    name: item.name,
    durations: item.durations.filter((duration) => duration >= 4 && duration <= 15),
    aspects: item.aspects.filter((aspect) => aspect !== "Auto"),
  })).filter((item) => item.durations.length > 0 && item.aspects.length > 0);
  return [...models, ...extra];
}

export function HomeGenerator({ lang, models: serverModels, onModelChange, preset, initialKind = "video", initialPrompt = "", hideKindTabs = false }: Props) {
  const zh = lang.toLowerCase().startsWith("zh");
  const router = useRouter();
  const models = useMemo(() => withStudioModels(serverModels), [serverModels]);
  const defaultVideoModel = models.find((item) => item.id === DEFAULT_VIDEO_MODEL_ID) ?? models[0];
  const [kind, setKind] = useState<"video" | "image" | "canvas">(initialKind);
  const [panel, setPanel] = useState<Panel>(null);
  const [mode, setMode] = useState<(typeof VIDEO_MODES)[number]>("text");
  const [modelId, setModelId] = useState(defaultVideoModel?.id ?? DEFAULT_VIDEO_MODEL_ID);
  const [imageModelId, setImageModelId] = useState(IMAGE_MODEL_IDS[0] ?? "");
  const imageModel = getMarketModel(imageModelId);
  const imageAvailable = IMAGE_MODEL_IDS.includes(imageModelId);
  const imageCredits = imageModel ? marketCredits(imageModel, { prompt: "", resolution: imageModel.options.resolutions?.[0] }) : null;
  const [prompt, setPrompt] = useState(initialPrompt.slice(0, 2000));
  const [videoReferences, setVideoReferences] = useState<{ file: File; preview: string }[]>([]);
  const [referenceImages, setReferenceImages] = useState<{ file: File; preview: string }[]>([]);
  const [aspect, setAspect] = useState(initialKind === "image" ? "1:1" : (defaultVideoModel?.aspects[0] ?? "16:9"));
  const [duration, setDuration] = useState(defaultVideoModel?.durations[0] ?? 4);
  const [resolution, setResolution] = useState(() => initialKind === "image" ? "1K" : (STUDIO_MODELS.find((item) => item.id === defaultVideoModel?.id)?.resolutions[0] ?? "720p"));
  const [sound, setSound] = useState(false);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const startRef = useRef<HTMLInputElement>(null);
  const videoPreviews = useRef<string[]>([]);
  const referencesRef = useRef<HTMLInputElement>(null);
  const referencePreviews = useRef<string[]>([]);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const suggestions = [0, 1, 2].map((step) => HOME_TEMPLATES[(suggestionOffset + step) % HOME_TEMPLATES.length]);
  const current = models.find((item) => item.id === modelId);
  const studioModel = STUDIO_MODELS.find((item) => item.id === modelId && item.available);
  const available = Boolean(current && studioModel);
  const estimatedCredits = studioModel ? estimateCredits({ modelId, duration, resolution }) : null;
  const modeLabels = zh ? ["参考生成视频", "文字/图片生成视频"] : ["Reference to Video", "Text/Image to Video"];
  const modeIndex = VIDEO_MODES.indexOf(mode);
  const videoReferenceLimit = maxVideoReferences(modelId);

  useEffect(() => {
    if (!panel) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-home-popover]")) setPanel(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [panel]);

  useEffect(() => () => referencePreviews.current.forEach((preview) => URL.revokeObjectURL(preview)), []);
  useEffect(() => () => videoPreviews.current.forEach((preview) => URL.revokeObjectURL(preview)), []);

  const addVideoReferences = (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    const invalid = selected.map(validateImageFile).find(Boolean);
    if (invalid) { setNotice(invalid); return; }
    const remaining = MAX_HOME_VIDEO_REFERENCES - videoReferences.length;
    if (remaining <= 0) { setNotice(zh ? "最多添加 12 张参考图片。" : "Add up to 12 reference images."); return; }
    const added = selected.slice(0, remaining).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    videoPreviews.current.push(...added.map((item) => item.preview));
    setVideoReferences((previous) => [...previous, ...added]);
    setNotice(selected.length > remaining ? (zh ? "只保留了前 12 张参考图片。" : "Only the first 12 reference images were kept.") : "");
  };

  const removeVideoReference = (index: number) => {
    const removed = videoReferences[index];
    if (removed) {
      URL.revokeObjectURL(removed.preview);
      videoPreviews.current = videoPreviews.current.filter((preview) => preview !== removed.preview);
    }
    setVideoReferences((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setPrompt((previous) => removeVideoReferenceToken(previous, index + 1));
    setNotice("");
    setMentionOpen(false);
  };

  const insertVideoReference = (index: number) => {
    const field = promptRef.current;
    const start = field?.selectionStart ?? prompt.length;
    const end = field?.selectionEnd ?? start;
    const before = prompt.slice(0, start);
    const mention = before.match(/@(?:图片|image)?\d*$/i);
    const from = mention ? start - mention[0].length : start;
    const prefix = prompt.slice(0, from);
    const spacing = prefix && !/\s$/.test(prefix) ? " " : "";
    const insertion = `${spacing}@${zh ? "图片" : "Image"}${index + 1} `;
    const next = `${prefix}${insertion}${prompt.slice(end)}`.slice(0, 2000);
    setPrompt(next);
    setMentionOpen(false);
    setNotice("");
    requestAnimationFrame(() => {
      field?.focus({ preventScroll: true });
      field?.setSelectionRange(from + insertion.length, from + insertion.length);
    });
  };

  // An idea picked below the hero loads its prompt here. Keyed on the nonce so
  // picking the same idea twice still applies after the visitor edited it.
  useEffect(() => {
    if (!preset) return;
    setKind("video");
    setPanel(null);
    setPrompt(preset.prompt.slice(0, 2000));
    const model = models.find((item) => item.id === modelId);
    setAspect(preset.aspect && model?.aspects.includes(preset.aspect) ? preset.aspect : (model?.aspects[0] ?? "16:9"));
    setNotice("");
    promptRef.current?.focus({ preventScroll: true });
  }, [preset?.nonce]);

  const addReferences = (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files);
    const invalid = selected.map(validateImageFile).find(Boolean);
    if (invalid) { setNotice(invalid); return; }
    const remaining = 5 - referenceImages.length;
    if (remaining <= 0) { setNotice(zh ? "最多上传 5 张参考图。" : "Add up to 5 reference images."); return; }
    const added = selected.slice(0, remaining).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    referencePreviews.current.push(...added.map((item) => item.preview));
    setReferenceImages((previous) => [...previous, ...added]);
    if (selected.length > remaining) setNotice(zh ? "最多保留 5 张参考图。" : "Only the first 5 reference images were kept.");
    else setNotice("");
  };

  const removeReference = (index: number) => {
    const removed = referenceImages[index];
    if (removed) {
      URL.revokeObjectURL(removed.preview);
      referencePreviews.current = referencePreviews.current.filter((preview) => preview !== removed.preview);
    }
    setReferenceImages((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const selectModel = (id: string) => {
    setModelId(id);
    onModelChange(id);
    const selected = models.find((item) => item.id === id);
    if (selected) {
      setDuration(selected.durations[0]);
      setAspect(selected.aspects[0]);
      const supported = STUDIO_MODELS.find((item) => item.id === id);
      if (supported) { setResolution(supported.resolutions[0]); setSound(supported.audio); }
    } else {
      setSound(false);
    }
    setNotice(selected ? "" : (zh ? "当前模型暂不可生成，请选择已接入的模型。" : "This model cannot generate yet. Choose a connected model."));
  };

  const [nudge, setNudge] = useState(0);

  // Switching tabs starts clean: an error from the other tab (an unconnected
  // video model, say) must not follow the visitor to the image tab.
  const switchKind = (next: "video" | "image" | "canvas") => {
    setKind(next);
    setPanel(null);
    setMentionOpen(false);
    setNotice("");
    setNudge(0);
  };

  // An empty prompt gets a nudge instead of a silent no-op. A start image or
  // reference images alone are enough to go on.
  const hasInput = Boolean(prompt.trim()) || (kind === "video" ? videoReferences.length > 0 : referenceImages.length > 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!hasInput) {
      setNotice(zh ? "先写一句想生成的画面，或点下面的提示试试。" : "Describe what you want to see, or pick a prompt below.");
      setNudge((value) => value + 1);
      promptRef.current?.focus({ preventScroll: true });
      return;
    }
    const params = new URLSearchParams();
    params.set("prompt", prompt.trim());
    if (kind === "image") {
      if (!imageAvailable) { setNotice(zh ? "当前图片模型的生成接口尚未接入，请选择其他模型。" : "This image model's generation endpoint is not connected yet. Choose another model."); return; }
      params.set("model", imageModelId);
      params.set("aspect", aspect);
      params.set("resolution", resolution);
      // Stays on until the studio replaces this page.
      setSubmitting(true);
      router.push(`${localizedHref(lang, "/ai/image")}?${params}`);
      return;
    }
    if (!available) { setNotice(zh ? "请选择当前可用的视频模型。" : "Choose a currently available video model."); return; }
    if (mode === "reference" && videoReferences.length === 0) { setNotice(zh ? "请先添加参考图片。" : "Add a reference image first."); return; }
    if (videoReferences.length > videoReferenceLimit) { setNotice(zh ? `当前模型最多使用 ${videoReferenceLimit} 张参考图，请先移除多余图片。` : `This model accepts up to ${videoReferenceLimit} reference images. Remove the extras before continuing.`); return; }
    const preparedPrompt = prepareVideoReferencePrompt(prompt.trim(), videoReferences.length);
    if (!preparedPrompt.ok) { setNotice(zh ? `@图片${preparedPrompt.index} 没有对应的素材，请检查引用。` : `@Image${preparedPrompt.index} has no matching image. Check the reference.`); return; }
    setSubmitting(true);
    try {
      if (videoReferences.length) {
        const uploaded = [];
        for (const item of videoReferences) {
          const result = await uploadImage(item.file);
          if (!result.ok) { setNotice(result.message); setSubmitting(false); return; }
          uploaded.push({ key: result.key, name: item.file.name, url: result.url });
        }
        sessionStorage.setItem("aivd:home-video-references", JSON.stringify(uploaded));
      }
      params.set("model", modelId);
      params.set("duration", String(duration));
      params.set("aspect", aspect);
      params.set("resolution", resolution);
      params.set("audio", String(sound));
      // Leave the button in its loading state; the studio page replaces this one.
      router.push(`${localizedHref(lang, "/ai/video")}?${params}`);
    } catch {
      setNotice(zh ? "准备参考图片失败，请重试。" : "Could not prepare the reference image. Please try again.");
      setSubmitting(false);
    }
  }

  const chip = "inline-flex min-h-9 max-sm:min-h-11 max-w-full items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--du-surface-2)] px-3 text-xs text-[var(--du-text)] transition-colors hover:bg-[var(--du-border-strong)] sm:text-sm";
  const plainControl = "inline-flex min-h-9 max-sm:min-h-11 max-w-full items-center gap-1.5 whitespace-nowrap px-1 text-xs text-[var(--du-text)] transition-colors hover:text-[var(--du-accent-text)] sm:text-sm disabled:cursor-not-allowed disabled:opacity-45";
  const divider = <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-[var(--du-border-strong)] sm:block" />;
  const segment = (value: string, selected: boolean, onClick: () => void, disabled = false) => <button key={value} type="button" disabled={disabled} onClick={onClick} aria-pressed={selected} className={`min-h-10 rounded-xl px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "bg-[var(--du-border-strong)] text-[var(--du-text)]" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{value}</button>;

  return <div id="home-generator" className="relative z-20 w-full max-w-[720px] scroll-mt-24">
    {hideKindTabs ? null : <div className="du-composer-tabs" role="tablist" aria-label={zh ? "生成类型" : "Generation type"}>
      <button type="button" role="tab" aria-selected={kind === "video"} onClick={() => { switchKind("video"); setAspect(current?.aspects[0] ?? "16:9"); setResolution(studioModel?.resolutions[0] ?? "720p"); }} className={`du-composer-tab ${kind === "video" ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "视频" : "Video"}</button>
      <button type="button" role="tab" aria-selected={kind === "image"} onClick={() => { switchKind("image"); setAspect("1:1"); setResolution("1K"); }} className={`du-composer-tab ${kind === "image" ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "图片" : "Image"}</button>
      <button type="button" role="tab" aria-selected={kind === "canvas"} onClick={() => switchKind("canvas")} className={`du-composer-tab ${kind === "canvas" ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "无限画布" : "Infinite Canvas"}</button>
    </div>}
    {kind === "canvas" ? <div className="du-canvas-entry" role="tabpanel" aria-label={zh ? "无限画布" : "Infinite Canvas"}>
      <a className="du-canvas-entry-card du-canvas-entry-new" href={localizedHref(lang, "/creative-space/canvas")}>
        <span className="du-canvas-entry-plus"><Plus aria-hidden="true" /></span>
        <span>{zh ? "新建画布" : "New canvas"}</span>
      </a>
      <a className="du-canvas-entry-card du-canvas-entry-video" href={localizedHref(lang, "/creative-space")}>
        <span className="du-canvas-entry-visual"><Film aria-hidden="true" /><span className="du-canvas-entry-line" /></span>
        <span>{zh ? "视频创作" : "Video creation"}</span>
      </a>
      <a className="du-canvas-entry-card du-canvas-entry-image" href={localizedHref(lang, "/creative-space")}>
        <span className="du-canvas-entry-visual"><ImageIcon aria-hidden="true" /><span className="du-canvas-entry-line" /></span>
        <span>{zh ? "图像创作" : "Image creation"}</span>
      </a>
    </div> : null}
    {kind !== "canvas" ?
    <form onSubmit={submit} className={`du-composer${nudge ? " du-composer-nudge" : ""}`} onAnimationEnd={(event) => { if (event.target === event.currentTarget) setNudge(0); }}>
    {kind === "image" ? <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
      <input ref={referencesRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { addReferences(event.target.files); event.target.value = ""; }} />
      <button type="button" onClick={() => referencesRef.current?.click()} disabled={referenceImages.length >= 5} className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-white/30 text-xs text-white/75 transition-colors hover:border-[var(--du-accent)] disabled:opacity-40" aria-label={zh ? "添加参考图片" : "Add reference images"}><span className="text-xl leading-none">+</span><span>{zh ? "参考图" : "Images"}</span></button>
      {referenceImages.map((item, index) => <div key={item.preview} className="relative h-14 w-14 shrink-0" title={item.file.name}>
        <button type="button" onClick={() => setPrompt((previous) => `${previous}${previous && !/\s$/.test(previous) ? " " : ""}@${index + 1} `)} className="h-full w-full overflow-hidden rounded-lg border border-white/20" aria-label={zh ? `在提示词中引用第 ${index + 1} 张图片` : `Reference image ${index + 1} in prompt`}><img src={item.preview} alt="" className="h-full w-full object-cover" /><span className="absolute bottom-0 left-0 rounded-tr bg-black/75 px-1 text-[10px] text-white">@{index + 1}</span></button>
        <button type="button" onClick={() => removeReference(index)} aria-label={zh ? `移除第 ${index + 1} 张图片` : `Remove image ${index + 1}`} className="absolute -right-1 -top-1 rounded-full bg-black p-0.5 text-white"><X className="h-3 w-3" /></button>
      </div>)}
      <span className="text-xs text-white/55">{zh ? "最多 5 张 · 点击缩略图可插入 @编号" : "Up to 5 · click an image to insert its @number"}</span>
    </div> : null}
    <div className="du-composer-prompt-row flex min-h-[72px] gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        {kind === "video" ? <div className="flex shrink-0 items-start gap-1.5">
          <input ref={startRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { addVideoReferences(event.target.files); event.target.value = ""; }} />
          <div className="flex flex-col items-center gap-1"><button type="button" onClick={() => startRef.current?.click()} disabled={videoReferences.length >= MAX_HOME_VIDEO_REFERENCES} title={zh ? "添加参考图片" : "Add reference images"} className="flex h-[56px] w-[46px] flex-col items-center justify-center rounded-xl border border-dashed border-white/25 bg-black/25 text-xs text-white/75 transition-colors hover:border-[var(--du-accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"><span className="text-xl leading-none">+</span><span className="mt-1">{zh ? "参考" : "Ref"}</span></button><span className="text-[10px] text-white/65">{videoReferences.length ? `${videoReferences.length}/12` : (zh ? "可选" : "Optional")}</span></div>
        </div> : null}
        <label htmlFor="home-generator-prompt" className="sr-only">{zh ? "描述创意" : "Describe your idea"}</label>
        <div className="relative min-w-[160px] flex-1">
          <textarea ref={promptRef} id="home-generator-prompt" value={prompt} onChange={(event) => { const next = event.target.value; setPrompt(next); setMentionOpen(kind === "video" && videoReferences.length > 0 && /@(?:图片|image)?\d*$/i.test(next.slice(0, event.target.selectionStart))); if (notice) setNotice(""); }} onKeyDown={(event) => { if (event.key === "Escape") setMentionOpen(false); if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (mentionOpen && videoReferences.length) insertVideoReference(0); else event.currentTarget.form?.requestSubmit(); } }} enterKeyHint="send" rows={2} maxLength={2000} placeholder={kind === "video" ? (zh ? "最多添加 12 张参考图片，输入文字或用 @图片1、@图片2 引用素材，自由组合画面与动作。" : "Add up to 12 reference images. Write a prompt and use @Image1, @Image2 to combine them into a scene.") : (zh ? "描述你的创意，选择模型开始创作……" : "Describe your idea, then choose a model…")} className="min-h-[64px] w-full resize-none bg-transparent px-2 py-1.5 text-[12px] font-light text-[var(--du-text)] outline-none placeholder:text-[var(--du-text-muted)] sm:text-[14px]" />
          {kind === "video" && mentionOpen ? <div className="du-composer-mentions">
            {videoReferences.map((item, index) => <button key={item.preview} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertVideoReference(index)}><img src={item.preview} alt="" /><span>@{zh ? "图片" : "Image"}{index + 1}</span></button>)}
          </div> : null}
        </div>
      </div>
    </div>
    {kind === "video" && videoReferences.length ? <div className="du-composer-references">
      <div className="du-composer-reference-list">{videoReferences.map((item, index) => <div key={item.preview} className="du-composer-reference" title={item.file.name}>
        <button type="button" onClick={() => insertVideoReference(index)} aria-label={zh ? `引用图片 ${index + 1}` : `Reference image ${index + 1}`}><img src={item.preview} alt="" /><span>@{zh ? "图片" : "Image"}{index + 1}</span></button>
        <button type="button" onClick={() => removeVideoReference(index)} aria-label={zh ? `移除图片 ${index + 1}` : `Remove image ${index + 1}`} className="du-composer-reference-remove"><X className="h-3 w-3" /></button>
      </div>)}</div>
      <p>{zh ? `已添加 ${videoReferences.length}/12 张 · 当前模型每次最多使用 ${videoReferenceLimit} 张` : `${videoReferences.length}/12 added · This model accepts up to ${videoReferenceLimit} per generation`}</p>
    </div> : null}
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
      {kind === "video" ? <div data-home-popover className="relative"><button type="button" className={chip} aria-expanded={panel === "mode"} onClick={() => setPanel(panel === "mode" ? null : "mode")}><Film className="h-4 w-4 shrink-0" />{modeLabels[modeIndex]}<ChevronDown className="h-3 w-3 shrink-0" /></button>{panel === "mode" ? <div className="du-home-popover absolute top-11 left-0 z-50 w-[min(92vw,290px)] rounded-2xl border border-[var(--du-border)] p-2 shadow-2xl">{VIDEO_MODES.map((item, index) => <button key={item} type="button" onClick={() => { setMode(item); setPanel(null); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[var(--du-text)] hover:bg-[var(--du-surface-2)]">{modeLabels[index]}{mode === item ? <Check className="h-4 w-4 text-[var(--du-accent-text)]" /> : null}</button>)}</div> : null}</div> : null}
      {kind === "video" ? divider : null}<div className={`relative min-w-0 ${kind === "image" ? "rounded-xl bg-[var(--du-surface-2)] px-2" : ""}`}><KieModelPicker kind={kind} locale={lang} value={kind === "video" ? modelId : imageModelId} onChange={kind === "video" ? selectModel : (id) => { setImageModelId(id); setNotice(IMAGE_MODEL_IDS.includes(id) ? "" : (zh ? "当前图片模型的生成接口尚未接入，请选择其他模型。" : "This image model's generation endpoint is not connected yet. Choose another model.")); }} connectedIds={kind === "video" ? models.map((item) => item.id) : IMAGE_MODEL_IDS} placement="bottom" glass allowUnconnectedSelection={kind === "video"} showConnectionStatus={false} catalogSet={kind === "video" ? "backup" : "current"} compact /></div>
      {kind === "video" ? <>{divider}<button type="button" className={plainControl} onClick={() => setSound(!sound)} aria-pressed={sound} disabled={!studioModel?.audio}><Music2 className="h-4 w-4" />{sound ? (zh ? "声音开" : "Sound on") : (zh ? "声音关" : "Sound off")}</button></> : null}
      {divider}<div data-home-popover className="relative"><button type="button" className={plainControl} onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-expanded={panel === "settings"}><Settings2 className="h-4 w-4 shrink-0" />{kind === "video" ? `${aspect} / ${duration}s / ${resolution}` : `${aspect} / ${resolution}`} </button>{panel === "settings" ? <div className="du-home-popover du-home-settings absolute top-11 right-0 z-50 max-h-[min(42vh,320px)] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border border-[var(--du-border)] p-4 shadow-2xl"><div className="flex items-center justify-between text-sm font-semibold"><span>{zh ? "生成设置" : "Generation settings"}</span><button type="button" onClick={() => setPanel(null)} aria-label={zh ? "关闭" : "Close"}><X className="h-4 w-4" /></button></div><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "画面比例" : "Aspect ratio"}</p><div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{(kind === "video" ? VIDEO_ASPECTS : IMAGE_ASPECTS).map((item) => segment(item, aspect === item, () => setAspect(item), kind === "video" && !current?.aspects.includes(item)))}</div>{kind === "video" ? <><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "视频时长" : "Video length"} · {duration}s</p><input type="range" min={4} max={15} value={duration} onChange={(event) => { const raw = Number(event.target.value); const allowed = current?.durations ?? [4]; setDuration(allowed.reduce((nearest, next) => Math.abs(next - raw) < Math.abs(nearest - raw) ? next : nearest, allowed[0])); }} className="mt-2 w-full accent-[var(--du-accent)]" /></> : null}<p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "分辨率" : "Resolution"}</p><div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{(kind === "video" ? ["480p", "720p", "1080p", "4K"] : ["1K", "2K", "4K"]).map((item) => segment(item, resolution === item, () => setResolution(item), kind === "video" ? !studioModel?.resolutions.includes(item) : false))}</div></div> : null}</div>
      <div className="ml-auto flex items-center gap-3">
        {kind === "video" && estimatedCredits !== null ? <span className="du-composer-cost" title={zh ? `本次消耗 ${estimatedCredits} 积分` : `This generation uses ${estimatedCredits} credits`}><Coins className="h-3.5 w-3.5" aria-hidden="true" />{estimatedCredits}<span className="sr-only">{zh ? " 积分" : " credits"}</span></span> : null}
        {kind === "image" && imageCredits ? <span className="du-composer-cost" title={zh ? `每张 ${imageCredits} 积分起` : `From ${imageCredits} credits per image`}><Coins className="h-3.5 w-3.5" aria-hidden="true" />{imageCredits}<span className="sr-only">{zh ? " 积分" : " credits"}</span></span> : null}
        <button type="submit" disabled={submitting || (kind === "video" && !available) || (kind === "image" && !imageAvailable)} aria-label={submitting ? (zh ? "正在进入创作台..." : "Opening studio...") : kind === "video" ? (zh ? "生成视频" : "Generate video") : (zh ? "继续创建图片" : "Continue to image")} title={submitting ? (zh ? "正在进入创作台..." : "Opening studio...") : kind === "video" ? (zh ? "生成视频（Enter）" : "Generate video (Enter)") : (zh ? "继续创建图片（Enter）" : "Continue to image (Enter)")} aria-busy={submitting || undefined} className={`du-composer-send${submitting ? " du-composer-send-busy" : ""}`}>{submitting ? <><Loader2 className="du-composer-spinner" aria-hidden="true" /><span>{zh ? "正在进入创作台..." : "Opening studio..."}</span></> : <ArrowUp className="h-4 w-4" aria-hidden="true" />}</button>
      </div>
    </div>
    {notice ? <output className="mt-2 block text-xs text-[var(--du-accent-text)]">{notice}</output> : null}
    {kind === "video" && !suggestionsHidden ? <div className="du-composer-suggestions">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setSuggestionOffset((value) => (value + 3) % HOME_TEMPLATES.length)} className="du-composer-suggestions-label">{zh ? "试试这些提示" : "Try these prompts"}<RefreshCw className="h-3 w-3" aria-hidden="true" /></button>
        <button type="button" onClick={() => setSuggestionsHidden(true)} className="du-composer-suggestions-label">{zh ? "不再显示" : "Hide"}</button>
      </div>
      {suggestions.map((item) => <button key={item.id} type="button" onClick={() => { setPrompt(zh ? item.prompt.zh : item.prompt.en); if (current?.aspects.includes(item.aspect)) setAspect(item.aspect); setNotice(""); promptRef.current?.focus({ preventScroll: true }); }} className="du-composer-suggestion"><img src={item.image} alt="" loading="lazy" /><span>{zh ? item.prompt.zh : item.prompt.en}</span></button>)}
    </div> : null}
    </form> : null}
  </div>;
}
