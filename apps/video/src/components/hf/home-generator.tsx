"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Check, ChevronDown, Film, Image as ImageIcon, Settings2, Shield, Volume2, VolumeX, X } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { IMAGE_CATALOG } from "@/lib/kie-model-catalog";
import { localizedHref } from "@/lib/du-home";
import { uploadImage, validateImageFile } from "@/lib/image-to-video";
import { STUDIO_MODELS } from "@/lib/ai-video-studio";

type Model = { id: string; name: string; durations: number[]; aspects: string[] };
type Props = { lang: string; models: Model[]; onModelChange: (id: string) => void };
type Panel = "mode" | "settings" | "publish" | null;

const VIDEO_ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"];
const IMAGE_ASPECTS = ["1:1", "16:9", "3:2", "2:3", "3:4", "4:3", "9:16", "4:5", "5:4"];
const VIDEO_MODES = ["reference", "text", "keyframes"] as const;

function Toggle({ checked, onChange, disabled = false }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-45 ${checked ? "bg-[var(--du-accent)]" : "bg-[var(--du-border-strong)]"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} /></button>;
}

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
  const [endFile, setEndFile] = useState<File | null>(null);
  const [aspect, setAspect] = useState(models[0]?.aspects[0] ?? "16:9");
  const [duration, setDuration] = useState(models[0]?.durations[0] ?? 4);
  const [resolution, setResolution] = useState("480p");
  const [quality, setQuality] = useState("Basic");
  const [outputs, setOutputs] = useState(1);
  const [sound, setSound] = useState(false);
  const [publicVisible, setPublicVisible] = useState(true);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const current = models.find((item) => item.id === modelId);
  const studioModel = STUDIO_MODELS.find((item) => item.id === modelId && item.available);
  const available = Boolean(current && studioModel);
  const estimatedCredits = studioModel ? Math.ceil(duration * studioModel.creditsPerSecond * (resolution === "1080p" ? 1.5 : 1) * (sound ? 1.2 : 1)) : null;
  const modeLabels = zh ? ["参考生成视频", "文字/图片生成视频", "关键帧生成视频"] : ["Reference to Video", "Text/Image to Video", "Keyframes to Video"];
  const modeIndex = VIDEO_MODES.indexOf(mode);

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
      params.set("count", String(outputs));
      router.push(`${localizedHref(lang, "/ai/image")}?${params}`);
      return;
    }
    if (!available) { setNotice(zh ? "请选择当前可用的视频模型。" : "Choose a currently available video model."); return; }
    if (endFile || mode === "keyframes") { setNotice(zh ? "当前生成接口仅接收一张起始参考图，结束帧暂不能提交。" : "The current generation API accepts one start image; an end frame cannot be submitted yet."); return; }
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
      sessionStorage.setItem("aivd:home-public-visibility", String(publicVisible));
      router.push(`${localizedHref(lang, "/ai/video")}?${params}`);
    } catch {
      setNotice(zh ? "准备参考图片失败，请重试。" : "Could not prepare the reference image. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const chip = "inline-flex h-9 items-center gap-2 rounded-xl bg-[var(--du-surface-2)] px-3 text-xs text-[var(--du-text)] transition-colors hover:bg-[var(--du-border-strong)] sm:text-sm";
  const segment = (value: string, selected: boolean, onClick: () => void, disabled = false) => <button key={value} type="button" disabled={disabled} onClick={onClick} aria-pressed={selected} className={`min-h-10 rounded-xl px-3 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${selected ? "bg-[var(--du-border-strong)] text-[var(--du-text)]" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{value}</button>;

  return <form onSubmit={submit} className="du-glass relative z-20 mt-5 w-full max-w-[1120px] rounded-[22px] p-3 text-left shadow-[0_20px_60px_rgba(0,0,0,.35)] sm:p-4">
    <div className="mb-3 flex w-fit rounded-xl bg-[var(--du-surface-2)] p-1" role="tablist" aria-label={zh ? "生成类型" : "Generation type"}>
      <button type="button" role="tab" aria-selected={kind === "video"} onClick={() => { setKind("video"); setPanel(null); setAspect(current?.aspects[0] ?? "16:9"); setResolution("480p"); }} className={`rounded-lg px-5 py-1.5 text-sm ${kind === "video" ? "bg-[var(--du-border-strong)] text-[var(--du-text)]" : "text-[var(--du-text-muted)]"}`}>{zh ? "视频" : "Video"}</button>
      <button type="button" role="tab" aria-selected={kind === "image"} onClick={() => { setKind("image"); setPanel(null); setAspect("1:1"); setResolution("1K"); }} className={`rounded-lg px-5 py-1.5 text-sm ${kind === "image" ? "bg-[var(--du-border-strong)] text-[var(--du-text)]" : "text-[var(--du-text-muted)]"}`}>{zh ? "图片" : "Image"}</button>
    </div>
    <div className="flex min-h-[74px] gap-3">
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-2">
        {kind === "video" ? <div className="flex shrink-0 gap-2">
          <input ref={startRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => setStartFile(event.target.files?.[0] ?? null)} />
          <input ref={endRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(event) => setEndFile(event.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => startRef.current?.click()} title={startFile?.name} className="flex h-[66px] w-[65px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--du-border-strong)] text-xs text-[var(--du-text-muted)]"><span className="text-xl">{startFile ? "✓" : "+"}</span>{zh ? "起始" : "Start"}<span className="text-[9px]">{zh ? "可选" : "Optional"}</span></button>
          <button type="button" onClick={() => endRef.current?.click()} title={endFile?.name} className="flex h-[66px] w-[65px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--du-border-strong)] text-xs text-[var(--du-text-muted)]"><span className="text-xl">{endFile ? "✓" : "+"}</span>{zh ? "结尾" : "End"}<span className="text-[9px]">{zh ? "可选" : "Optional"}</span></button>
        </div> : <div className="flex h-[66px] w-[65px] shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--du-border-strong)] text-xs text-[var(--du-text-muted)]"><ImageIcon className="mb-1 h-5 w-5" />{zh ? "参考图" : "Image"}</div>}
        <label htmlFor="home-generator-prompt" className="sr-only">{zh ? "描述创意" : "Describe your idea"}</label>
        <textarea id="home-generator-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} maxLength={2000} placeholder={zh ? "描述你的创意，选择模型开始创作……" : "Describe your idea, then choose a model…"} className="min-h-[66px] min-w-[160px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-[var(--du-text)] outline-none placeholder:text-[var(--du-text-muted)] sm:text-base" />
      </div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {kind === "video" ? <div className="relative"><button type="button" className={chip} aria-expanded={panel === "mode"} onClick={() => setPanel(panel === "mode" ? null : "mode")}><Film className="h-4 w-4" />{modeLabels[modeIndex]}<ChevronDown className="h-3 w-3" /></button>{panel === "mode" ? <div className="absolute bottom-11 left-0 z-50 w-[min(92vw,290px)] rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] p-2 shadow-2xl">{VIDEO_MODES.map((item, index) => <button key={item} type="button" onClick={() => { setMode(item); setPanel(null); }} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[var(--du-text)] hover:bg-[var(--du-surface-2)]">{modeLabels[index]}{mode === item ? <Check className="h-4 w-4 text-[var(--du-accent-text)]" /> : null}</button>)}</div> : null}</div> : null}
      <div className="relative min-w-[155px] max-w-[230px] flex-1"><KieModelPicker kind={kind} locale={lang} value={kind === "video" ? modelId : imageModelId} onChange={kind === "video" ? selectModel : setImageModelId} connectedIds={models.map((item) => item.id)} placement="top" showConnectionStatus={false} /></div>
      {kind === "video" ? <button type="button" className={chip} onClick={() => setSound(!sound)} aria-pressed={sound} disabled={!studioModel?.audio}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}{sound ? (zh ? "声音开" : "Sound on") : (zh ? "声音关" : "Sound off")}</button> : null}
      <div className="relative"><button type="button" className={chip} onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-expanded={panel === "settings"}><Settings2 className="h-4 w-4" />{kind === "video" ? `${aspect} / ${duration}s / ${resolution}` : `${aspect} / ${resolution} / ${outputs}`} </button>{panel === "settings" ? <div className="absolute bottom-11 right-0 z-50 max-h-[min(65vh,520px)] w-[min(92vw,420px)] overflow-y-auto rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] p-4 shadow-2xl"><div className="flex items-center justify-between text-sm font-semibold"><span>{zh ? "生成设置" : "Generation settings"}</span><button type="button" onClick={() => setPanel(null)} aria-label={zh ? "关闭" : "Close"}><X className="h-4 w-4" /></button></div><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "画面比例" : "Aspect ratio"}</p><div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{(kind === "video" ? VIDEO_ASPECTS : IMAGE_ASPECTS).map((item) => segment(item, aspect === item, () => setAspect(item), kind === "video" && !current?.aspects.includes(item)))}</div>{kind === "video" ? <><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "视频时长" : "Video length"} · {duration}s</p><input type="range" min={4} max={15} value={duration} onChange={(event) => { const raw = Number(event.target.value); const allowed = current?.durations ?? [4]; setDuration(allowed.reduce((nearest, next) => Math.abs(next - raw) < Math.abs(nearest - raw) ? next : nearest, allowed[0])); }} className="mt-2 w-full accent-[var(--du-accent)]" /></> : null}<p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "分辨率" : "Resolution"}</p><div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{(kind === "video" ? ["480p", "720p", "1080p", "4K"] : ["1K", "2K", "4K"]).map((item) => segment(item, resolution === item, () => setResolution(item), kind === "video" ? !studioModel?.resolutions.includes(item) : false))}</div><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "模式" : "Mode"}</p><div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{["Basic", "Pro"].map((item) => segment(item, quality === item, () => setQuality(item), item === "Pro"))}</div><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "生成数量" : "Output number"}</p><div className="mt-2 grid grid-cols-4 gap-1 rounded-xl bg-[var(--du-surface-2)] p-1">{[1, 2, 3, 4].map((item) => segment(String(item), outputs === item, () => setOutputs(item), item > 1))}</div></div> : null}</div>
      <div className="relative"><button type="button" className={chip} onClick={() => setPanel(panel === "publish" ? null : "publish")} aria-expanded={panel === "publish"}><Shield className="h-4 w-4" />{zh ? "发布设置" : "Publish settings"}<ChevronDown className="h-3 w-3" /></button>{panel === "publish" ? <div className="absolute bottom-11 right-0 z-50 w-[min(92vw,390px)] rounded-2xl border border-[var(--du-border)] bg-[var(--du-surface)] p-4 shadow-2xl"><div className="flex items-center justify-between text-sm font-semibold"><span>{zh ? "发布设置" : "Publish settings"}</span><button type="button" onClick={() => setPanel(null)} aria-label={zh ? "关闭" : "Close"}><X className="h-4 w-4" /></button></div><div className="mt-4 flex items-center justify-between gap-4"><div><p className="text-sm">Web Search</p><p className="text-xs text-[var(--du-text-muted)]">{zh ? "模型支持时可参考最新信息；当前生成流程暂不提供。" : "Can use current information when supported; unavailable in this generation flow."}</p></div><Toggle checked={false} onChange={() => {}} disabled /></div><div className="mt-5 flex items-center justify-between gap-4"><div><p className="text-sm">{zh ? "公开展示" : "Public visibility"}</p><p className="text-xs text-[var(--du-text-muted)]">{zh ? "生成完成后可发布到社区；发布前仍需确认。" : "Share to the community after generation; confirmation is still required."}</p></div><Toggle checked={publicVisible} onChange={() => setPublicVisible(!publicVisible)} /></div><div className="mt-5 flex items-center justify-between gap-4"><div><p className="text-sm">{zh ? "版权保护" : "Copy protection"}</p><p className="text-xs text-[var(--du-text-muted)]">{zh ? "受保护 Prompt 仅支持超级账号在发布时设置。" : "Protected prompts are available to super accounts when publishing."}</p></div><Toggle checked={false} onChange={() => {}} disabled /></div></div> : null}</div>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2"><span className="text-xs text-[var(--du-text-muted)]">{estimatedCredits !== null && kind === "video" ? (zh ? `预计 ${estimatedCredits} 积分 · 以工作台为准` : `≈ ${estimatedCredits} credits · final in studio`) : (zh ? "积分待模型接入后显示" : "Credits available after model connection")}</span>
      <button type="submit" disabled={submitting || (kind === "video" && !available)} className="min-h-10 rounded-xl bg-[var(--du-accent)] px-6 text-sm font-bold text-[var(--du-on-accent)] shadow-[var(--du-glow)] hover:bg-[var(--du-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? (zh ? "准备中…" : "Preparing…") : kind === "video" ? (zh ? "生成视频" : "Generate video") : (zh ? "继续创建图片" : "Continue to image")}</button></div>
    </div>
    {notice ? <p role="status" className="mt-2 text-xs text-[var(--du-accent-text)]">{notice}</p> : null}
  </form>;
}
