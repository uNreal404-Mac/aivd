"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Film, Settings2, Volume2, VolumeX, X } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { IMAGE_CATALOG } from "@/lib/kie-model-catalog";
import { localizedHref } from "@/lib/du-home";
import { uploadImage, validateImageFile } from "@/lib/image-to-video";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";

type Model = { id: string; name: string; durations: number[]; aspects: string[] };
type Props = { lang: string; models: Model[]; onModelChange: (id: string) => void };
type Panel = "mode" | "settings" | null;

const VIDEO_ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"];
const IMAGE_ASPECTS = ["1:1", "16:9", "3:2", "2:3", "3:4", "4:3", "9:16", "4:5", "5:4"];
const VIDEO_MODES = ["reference", "text"] as const;

export function HomeGenerator({ lang, models, onModelChange }: Props) {
  const zh = lang.toLowerCase().startsWith("zh");
  const router = useRouter();
  const [kind, setKind] = useState<"video" | "image">("video");
  const [panel, setPanel] = useState<Panel>(null);
  const [mode, setMode] = useState<(typeof VIDEO_MODES)[number]>("text");
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const [imageModelId, setImageModelId] = useState(IMAGE_CATALOG[0]?.id ?? "");
  const [prompt, setPrompt] = useState("");
  const [startFile, setStartFile] = useState<File | null>(null);
  const [referenceImages, setReferenceImages] = useState<{ file: File; preview: string }[]>([]);
  const [aspect, setAspect] = useState(models[0]?.aspects[0] ?? "16:9");
  const [duration, setDuration] = useState(models[0]?.durations[0] ?? 4);
  const [resolution, setResolution] = useState("480p");
  const [sound, setSound] = useState(false);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const startRef = useRef<HTMLInputElement>(null);
  const referencesRef = useRef<HTMLInputElement>(null);
  const referencePreviews = useRef<string[]>([]);
  const current = models.find((item) => item.id === modelId);
  const studioModel = STUDIO_MODELS.find((item) => item.id === modelId && item.available);
  const available = Boolean(current && studioModel);
  const estimatedCredits = studioModel ? estimateCredits({ modelId, duration, resolution }) : null;
  const modeLabels = zh ? ["参考生成视频", "文字/图片生成视频"] : ["Reference to Video", "Text/Image to Video"];
  const modeIndex = VIDEO_MODES.indexOf(mode);

  useEffect(() => {
    if (!panel) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-home-popover]")) setPanel(null);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, [panel]);

  useEffect(() => () => referencePreviews.current.forEach((preview) => URL.revokeObjectURL(preview)), []);

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
    }
    setNotice("");
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const params = new URLSearchParams();
    params.set("prompt", prompt.trim());
    if (kind === "image") {
      params.set("model", imageModelId);
      params.set("aspect", aspect);
      params.set("resolution", resolution);
      router.push(`${localizedHref(lang, "/ai/image")}?${params}`);
      return;
    }
    if (!available) { setNotice(zh ? "请选择当前可用的视频模型。" : "Choose a currently available video model."); return; }
    if (mode === "reference" && !startFile) { setNotice(zh ? "请先添加参考图片。" : "Add a reference image first."); return; }
    setSubmitting(true);
    try {
      if (startFile) {
        const error = validateImageFile(startFile);
        if (error) { setNotice(error); return; }
        const uploaded = await uploadImage(startFile);
        if (!uploaded.ok) { setNotice(uploaded.message); return; }
        sessionStorage.setItem("aivd:home-start-image", uploaded.key);
        sessionStorage.setItem("aivd:home-start-image-name", startFile.name);
      }
      params.set("model", modelId);
      params.set("duration", String(duration));
      params.set("aspect", aspect);
      params.set("resolution", resolution);
      params.set("audio", String(sound));
      router.push(`${localizedHref(lang, "/ai/video")}?${params}`);
    } catch {
      setNotice(zh ? "准备参考图片失败，请重试。" : "Could not prepare the reference image. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const chip = "inline-flex min-h-9 max-w-full items-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--du-surface-2)] px-3 text-xs text-[var(--du-text)] transition-colors hover:bg-[var(--du-border-strong)] sm:text-sm";
  const plainControl = "inline-flex min-h-9 max-w-full items-center gap-1.5 whitespace-nowrap px-1 text-xs text-[var(--du-text)] transition-colors hover:text-[var(--du-accent-text)] sm:text-sm disabled:cursor-not-allowed disabled:opacity-45";
  const divider = <span aria-hidden="true" className="hidden h-5 w-px shrink-0 bg-[var(--du-border-strong)] sm:block" />;
  const segment = (value: string, selected: boolean, onClick: () => void, disabled = false) => <button key={value} type="button" disabled={disabled} onClick={onClick} aria-pressed={selected} className={`min-h-10 rounded-xl px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "bg-[var(--du-border-strong)] text-[var(--du-text)]" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{value}</button>;

  return <div className="relative z-20 mt-4 w-full max-w-[1120px]">
    <div className="mx-auto flex w-fit rounded-full border border-white/20 bg-[var(--du-surface)]/90 p-1 shadow-[0_8px_32px_rgba(0,0,0,.3)]" role="tablist" aria-label={zh ? "生成类型" : "Generation type"}>
      <button type="button" role="tab" aria-selected={kind === "video"} onClick={() => { setKind("video"); setPanel(null); setAspect(current?.aspects[0] ?? "16:9"); setResolution("480p"); }} className={`min-w-[92px] rounded-full px-5 py-2 text-sm font-medium transition-colors sm:min-w-[112px] ${kind === "video" ? "bg-[var(--du-accent)] text-[var(--du-on-accent)]" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "视频" : "Video"}</button>
      <button type="button" role="tab" aria-selected={kind === "image"} onClick={() => { setKind("image"); setPanel(null); setAspect("1:1"); setResolution("1K"); }} className={`min-w-[92px] rounded-full px-5 py-2 text-sm font-medium transition-colors sm:min-w-[112px] ${kind === "image" ? "bg-[var(--du-accent)] text-[var(--du-on-accent)]" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "图片" : "Image"}</button>
    </div>
    <form onSubmit={submit} className="du-glass relative mt-3 w-full rounded-[22px] p-3 text-left shadow-[0_20px_60px_rgba(0,0,0,.35)] sm:p-4">
    {kind === "image" ? <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-2">
      <input ref={referencesRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => { addReferences(event.target.files); event.target.value = ""; }} />
      <button type="button" onClick={() => referencesRef.current?.click()} disabled={referenceImages.length >= 5} className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-white/30 text-xs text-white/75 transition-colors hover:border-[var(--du-accent)] disabled:opacity-40" aria-label={zh ? "添加参考图片" : "Add reference images"}><span className="text-xl leading-none">+</span><span>{zh ? "参考图" : "Images"}</span></button>
      {referenceImages.map((item, index) => <div key={item.preview} className="relative h-14 w-14 shrink-0" title={item.file.name}>
        <button type="button" onClick={() => setPrompt((previous) => `${previous}${previous && !/\s$/.test(previous) ? " " : ""}@${index + 1} `)} className="h-full w-full overflow-hidden rounded-lg border border-white/20" aria-label={zh ? `在提示词中引用第 ${index + 1} 张图片` : `Reference image ${index + 1} in prompt`}><img src={item.preview} alt="" className="h-full w-full object-cover" /><span className="absolute bottom-0 left-0 rounded-tr bg-black/75 px-1 text-[10px] text-white">@{index + 1}</span></button>
        <button type="button" onClick={() => removeReference(index)} aria-label={zh ? `移除第 ${index + 1} 张图片` : `Remove image ${index + 1}`} className="absolute -right-1 -top-1 rounded-full bg-black p-0.5 text-white"><X className="h-3 w-3" /></button>
      </div>)}
      <span className="text-xs text-white/55">{zh ? "最多 5 张 · 点击缩略图可插入 @编号" : "Up to 5 · click an image to insert its @number"}</span>
    </div> : null}
    <div className="flex min-h-[74px] gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        {kind === "video" ? <div className="flex shrink-0 items-start gap-1.5">
          <input ref={startRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => setStartFile(event.target.files?.[0] ?? null)} />
          <div className="flex flex-col items-center gap-1"><button type="button" onClick={() => startRef.current?.click()} title={startFile?.name} className="flex h-[66px] w-[58px] flex-col items-center justify-center rounded-xl border border-dashed border-white/25 bg-black/25 text-xs text-white/75 transition-colors hover:border-[var(--du-accent)] hover:text-white"><span className="text-xl leading-none">{startFile ? "✓" : "+"}</span><span className="mt-1">{zh ? "起始" : "Start"}</span></button><span className="text-[10px] text-white/65">{zh ? "可选" : "Optional"}</span></div>
        </div> : null}
        <label htmlFor="home-generator-prompt" className="sr-only">{zh ? "描述创意" : "Describe your idea"}</label>
        <textarea id="home-generator-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} maxLength={2000} placeholder={zh ? "描述你的创意，选择模型开始创作……" : "Describe your idea, then choose a model…"} className="min-h-[66px] min-w-[160px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[var(--du-text)] outline-none placeholder:text-[var(--du-text-muted)] sm:text-base" />
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--du-border)] pb-3 sm:gap-x-3">
      {kind === "video" ? <div data-home-popover className="relative"><button type="button" className={chip} aria-expanded={panel === "mode"} onClick={() => setPanel(panel === "mode" ? null : "mode")}><Film className="h-4 w-4 shrink-0" />{modeLabels[modeIndex]}<ChevronDown className="h-3 w-3 shrink-0" /></button>{panel === "mode" ? <div className="absolute bottom-11 left-0 z-50 w-[min(92vw,290px)] rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] p-2 shadow-2xl">{VIDEO_MODES.map((item, index) => <button key={item} type="button" onClick={() => { setMode(item); setPanel(null); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[var(--du-text)] hover:bg-[var(--du-surface-2)]">{modeLabels[index]}{mode === item ? <Check className="h-4 w-4 text-[var(--du-accent-text)]" /> : null}</button>)}</div> : null}</div> : null}
      {kind === "video" ? divider : null}<div className={`relative min-w-0 ${kind === "image" ? "rounded-xl bg-[var(--du-surface-2)] px-2" : ""}`}><KieModelPicker kind={kind} locale={lang} value={kind === "video" ? modelId : imageModelId} onChange={kind === "video" ? selectModel : setImageModelId} connectedIds={models.map((item) => item.id)} placement="top" showConnectionStatus={false} compact /></div>
      {kind === "video" ? <>{divider}<button type="button" className={plainControl} onClick={() => setSound(!sound)} aria-pressed={sound} disabled={!studioModel?.audio}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}{sound ? (zh ? "声音开" : "Sound on") : (zh ? "声音关" : "Sound off")}</button></> : null}
      {divider}<div data-home-popover className="relative"><button type="button" className={plainControl} onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-expanded={panel === "settings"}><Settings2 className="h-4 w-4 shrink-0" />{kind === "video" ? `${aspect} / ${duration}s / ${resolution}` : `${aspect} / ${resolution}`} </button>{panel === "settings" ? <div className="absolute bottom-11 right-0 z-50 max-h-[min(42vh,320px)] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] p-4 shadow-2xl"><div className="flex items-center justify-between text-sm font-semibold"><span>{zh ? "生成设置" : "Generation settings"}</span><button type="button" onClick={() => setPanel(null)} aria-label={zh ? "关闭" : "Close"}><X className="h-4 w-4" /></button></div><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "画面比例" : "Aspect ratio"}</p><div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{(kind === "video" ? VIDEO_ASPECTS : IMAGE_ASPECTS).map((item) => segment(item, aspect === item, () => setAspect(item), kind === "video" && !current?.aspects.includes(item)))}</div>{kind === "video" ? <><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "视频时长" : "Video length"} · {duration}s</p><input type="range" min={4} max={15} value={duration} onChange={(event) => { const raw = Number(event.target.value); const allowed = current?.durations ?? [4]; setDuration(allowed.reduce((nearest, next) => Math.abs(next - raw) < Math.abs(nearest - raw) ? next : nearest, allowed[0])); }} className="mt-2 w-full accent-[var(--du-accent)]" /></> : null}<p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "分辨率" : "Resolution"}</p><div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{(kind === "video" ? ["480p", "720p", "1080p", "4K"] : ["1K", "2K", "4K"]).map((item) => segment(item, resolution === item, () => setResolution(item), kind === "video" ? !studioModel?.resolutions.includes(item) : false))}</div></div> : null}</div>
    </div>
    <div className="mt-3 flex w-full flex-wrap items-center justify-end gap-2">{kind === "image" ? <span className="text-xs text-[var(--du-text-muted)]">{zh ? "积分待模型接入后显示" : "Credits available after model connection"}</span> : null}
      <button type="submit" disabled={submitting || (kind === "video" && !available)} className="min-h-10 rounded-xl bg-[var(--du-accent)] px-6 text-sm font-bold text-[var(--du-on-accent)] shadow-[var(--du-glow)] hover:bg-[var(--du-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? (zh ? "准备中…" : "Preparing…") : kind === "video" ? (estimatedCredits !== null ? (zh ? `生成视频 · ${estimatedCredits} 积分` : `Generate · ${estimatedCredits} credits`) : (zh ? "生成视频" : "Generate video")) : (zh ? "继续创建图片" : "Continue to image")}</button></div>
    {notice ? <p role="status" className="mt-2 text-xs text-[var(--du-accent-text)]">{notice}</p> : null}
    </form>
  </div>;
}
