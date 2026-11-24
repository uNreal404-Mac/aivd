"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Coins, Film, Image as ImageIcon, Loader2, Music2, Plus, RefreshCw, Settings2, Sparkles, X } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { listGuestAssets, type PickerAsset } from "@/lib/home-media-library";
import { useSession } from "@/lib/auth/client";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { usePresence } from "@/hooks/use-presence";
import { useSegmentIndicator } from "@/hooks/use-segment-indicator";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";

// Image models that can generate; the image tab hands off to /ai/image.
const IMAGE_MODEL_IDS = marketModelsOf("image").map((model) => model.id);
import { localizedHref } from "@/lib/du-home";
import { uploadErrorText, uploadImage } from "@/lib/image-to-video";
import { STUDIO_MODELS, estimateCredits } from "@/lib/ai-video-studio";
import { HOME_TEMPLATES } from "@/lib/home-templates";
import { AUTOSTART_STORAGE_KEY } from "@/lib/autostart";
import { maxVideoReferences, prepareVideoReferencePrompt, removeVideoReferenceToken } from "@/lib/video-references";
import "./home-generator.css";

type Model = { id: string; name: string; durations: number[]; aspects: string[] };
export type HomeGeneratorPreset = { prompt: string; aspect?: string; nonce: number };
type Props = { lang: string; models: Model[]; onModelChange: (id: string) => void; preset?: HomeGeneratorPreset | null; initialKind?: "video" | "image"; initialPrompt?: string; hideKindTabs?: boolean; draftStorageKey?: string; showSuggestions?: boolean };
type Panel = "settings" | null;

// Every ratio a saved draft may hold; the panel shows only the model's own.
const VIDEO_ASPECTS = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "3:2", "2:3"];
const IMAGE_ASPECTS = ["1:1", "16:9", "3:2", "2:3", "3:4", "4:3", "9:16", "4:5", "5:4"];
// A signed-out "Generate" waits for sign-in, but only briefly and on this page.
const PENDING_TTL_MS = 10 * 60 * 1000;
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
    durations: item.durations,
    aspects: item.aspects.filter((aspect) => aspect !== "Auto"),
  })).filter((item) => item.durations.length > 0 && item.aspects.length > 0);
  return [...models, ...extra];
}

export function HomeGenerator({ lang, models: serverModels, onModelChange, preset, initialKind = "video", initialPrompt = "", hideKindTabs = false, draftStorageKey = "aivd:home-draft", showSuggestions = true }: Props) {
  const zh = lang.toLowerCase().startsWith("zh");
  const pendingStorageKey = draftStorageKey === "aivd:home-draft" ? "aivd:home-pending-generate" : `${draftStorageKey}:pending-generate`;
  const router = useRouter();
  const signIn = useSigninModal();
  const { data: session, isPending: sessionPending } = useSession();
  const models = useMemo(() => withStudioModels(serverModels), [serverModels]);
  const defaultVideoModel = models.find((item) => item.id === DEFAULT_VIDEO_MODEL_ID) ?? models[0];
  const [kind, setKind] = useState<"video" | "image" | "canvas">(initialKind);
  const [panel, setPanel] = useState<Panel>(null);
  const [modelId, setModelId] = useState(defaultVideoModel?.id ?? DEFAULT_VIDEO_MODEL_ID);
  const [imageModelId, setImageModelId] = useState(IMAGE_MODEL_IDS[0] ?? "");
  const imageModel = getMarketModel(imageModelId);
  const imageAvailable = IMAGE_MODEL_IDS.includes(imageModelId);
  const imageCredits = imageModel ? marketCredits(imageModel, { prompt: "", resolution: imageModel.options.resolutions?.[0] }) : null;
  const [prompt, setPrompt] = useState(initialPrompt.slice(0, 2000));
  const [videoReferences, setVideoReferences] = useState<PickerAsset[]>([]);
  const [referenceImages, setReferenceImages] = useState<PickerAsset[]>([]);
  // A delete in the library finishes later: it must find the image where it
  // is now, not where it was when the delete started.
  const videoReferencesRef = useRef(videoReferences);
  videoReferencesRef.current = videoReferences;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [aspect, setAspect] = useState(initialKind === "image" ? "1:1" : (defaultVideoModel?.aspects[0] ?? "16:9"));
  const [duration, setDuration] = useState(defaultVideoModel?.durations[0] ?? 4);
  const [resolution, setResolution] = useState(() => initialKind === "image" ? "1K" : (STUDIO_MODELS.find((item) => item.id === defaultVideoModel?.id)?.resolutions[0] ?? "720p"));
  const [sound, setSound] = useState(false);
  const soundChosen = useRef(false);
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [suggestionsHidden, setSuggestionsHidden] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const suggestions = [0, 1, 2, 3, 4].map((step) => HOME_TEMPLATES[(suggestionOffset + step) % HOME_TEMPLATES.length]);
  const current = models.find((item) => item.id === modelId);
  const studioModel = STUDIO_MODELS.find((item) => item.id === modelId && item.available);
  const available = Boolean(current && studioModel);
  const estimatedCredits = studioModel ? estimateCredits({ modelId, duration, resolution }, { images: videoReferences.length, audio: sound }) : null;
  const videoReferenceLimit = Math.max(1, maxVideoReferences(modelId));
  // The settings offer what the chosen model can actually do, nothing greyed out.
  const videoAspects = current?.aspects ?? [];
  const videoResolutions = studioModel?.resolutions ?? [];
  const videoDurations = current?.durations ?? [];
  const imageAspects = (imageModel?.options.aspects ?? IMAGE_ASPECTS).filter((item) => IMAGE_ASPECTS.includes(item));
  const imageResolutions = imageModel?.options.resolutions ?? [];
  const settingsPanel = usePresence(panel === "settings");
  const kindTabsRef = useSegmentIndicator<HTMLDivElement>(kind);
  // A prompt replaced by an idea or template can be brought back.
  // Undo keeps what the visitor wrote (and the ratio) even after several
  // ideas in a row: the snapshot is taken once, from their own text.
  const [replaced, setReplaced] = useState<{ prompt: string; aspect: string } | null>(null);
  const replacePrompt = (next: string) => {
    if (replaced === null) setReplaced(prompt.trim() && prompt !== next ? { prompt, aspect } : null);
    setPrompt(next);
  };
  // References trimmed by a model change can be brought back with the model.
  const [trimmed, setTrimmed] = useState<{ modelId: string; references: PickerAsset[]; prompt: string } | null>(null);
  // Escape closes the settings and puts focus back on the button that opened them.
  const settingsTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!panel) return;
    const activePanel = panel;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target as Element).closest("[data-home-popover]")) setPanel(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setPanel(null);
      requestAnimationFrame(() => {
        if (activePanel === "settings") settingsTriggerRef.current?.focus();
      });
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [panel]);

  // Local storage survives email sign-in opening a new tab; IndexedDB keeps guest file bytes.
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const saved = JSON.parse(localStorage.getItem(draftStorageKey) || "null");
        if (saved && typeof saved === "object") {
          const local = await listGuestAssets();
          const restore = (items: unknown): PickerAsset[] => Array.isArray(items) ? items.flatMap((item) => {
            if (!item || typeof item.id !== "string") return [];
            const guest = local.find((asset) => asset.id === item.id);
            return guest ? [guest] : item.key && item.url ? [item as PickerAsset] : [];
          }) : [];
          if (!live) return;
          const restoredKind = !hideKindTabs && (saved.kind === "video" || saved.kind === "image") ? saved.kind : initialKind;
          if (!hideKindTabs && (saved.kind === "video" || saved.kind === "image")) setKind(saved.kind);
          if (typeof saved.prompt === "string" && !initialPrompt) setPrompt(saved.prompt);
          const restoredVideoModelId = typeof saved.modelId === "string" ? saved.modelId : (defaultVideoModel?.id ?? DEFAULT_VIDEO_MODEL_ID);
          const restoredImageModelId = typeof saved.imageModelId === "string" ? saved.imageModelId : (IMAGE_MODEL_IDS[0] ?? "");
          if (typeof saved.modelId === "string") setModelId(saved.modelId);
          if (typeof saved.imageModelId === "string") setImageModelId(saved.imageModelId);
          const validAspects = restoredKind === "image" ? IMAGE_ASPECTS : VIDEO_ASPECTS;
          const validVideoResolutions = STUDIO_MODELS.find((item) => item.id === restoredVideoModelId)?.resolutions ?? ["480p", "720p", "1080p"];
          const validImageResolutions = getMarketModel(restoredImageModelId)?.options.resolutions ?? ["1K", "2K", "4K"];
          const validResolutions = restoredKind === "image" ? validImageResolutions : validVideoResolutions;
          if (typeof saved.aspect === "string" && validAspects.includes(saved.aspect)) setAspect(saved.aspect);
          if (typeof saved.resolution === "string" && validResolutions.includes(saved.resolution)) {
            setResolution(saved.resolution);
          } else {
            setResolution(validResolutions[0] ?? (restoredKind === "image" ? "1K" : "720p"));
          }
          if (typeof saved.duration === "number") setDuration(saved.duration);
          setSound(Boolean(saved.sound));
          setVideoReferences(restore(saved.videoReferences));
          setReferenceImages(restore(saved.referenceImages));
        }
      } catch { /* An old draft must not prevent the composer opening. */ }
      if (live) setDraftReady(true);
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const compact = (items: PickerAsset[]) => items.map(({ id, name, mimeType, key, url }) => ({ id, name, mimeType, key, url: key ? url : "" }));
    localStorage.setItem(draftStorageKey, JSON.stringify({ kind, prompt, modelId, imageModelId, aspect, resolution, duration, sound, videoReferences: compact(videoReferences), referenceImages: compact(referenceImages) }));
  }, [draftReady, kind, prompt, modelId, imageModelId, aspect, resolution, duration, sound, videoReferences, referenceImages]);

  // A "Generate" pressed while signed out continues after sign-in, if that
  // happens within a few minutes on the same page. Closing the sign-in dialog
  // without signing in drops it, so it never fires by surprise later.
  useEffect(() => {
    if (!draftReady || !session) return;
    let pending: { at?: number; path?: string } | null = null;
    try { pending = JSON.parse(localStorage.getItem(pendingStorageKey) || "null"); } catch { pending = null; }
    localStorage.removeItem(pendingStorageKey);
    if (pending && typeof pending.at === "number" && Date.now() - pending.at < PENDING_TTL_MS && pending.path === window.location.pathname) formRef.current?.requestSubmit();
  }, [draftReady, session]);

  // Only once the session is known: right after a Google or email sign-in
  // the page loads with the dialog closed and the session still loading.
  useEffect(() => {
    if (!signIn.isOpen && !session && !sessionPending) localStorage.removeItem(pendingStorageKey);
  }, [signIn.isOpen, session, sessionPending]);

  const removeVideoReference = (index: number) => {
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
    replacePrompt(preset.prompt.slice(0, 2000));
    const model = models.find((item) => item.id === modelId);
    setAspect(preset.aspect && model?.aspects.includes(preset.aspect) ? preset.aspect : (model?.aspects[0] ?? "16:9"));
    setNotice("");
    promptRef.current?.focus({ preventScroll: true });
  }, [preset?.nonce]);

  const removeReference = (index: number) => {
    setReferenceImages((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  // Changing model keeps every setting the new model also supports and
  // moves the rest to the nearest one it does, instead of resetting them.
  const selectModel = (id: string) => {
    setModelId(id);
    onModelChange(id);
    const selected = models.find((item) => item.id === id);
    if (selected) {
      if (!selected.durations.includes(duration)) setDuration(selected.durations.reduce((nearest, next) => (Math.abs(next - duration) < Math.abs(nearest - duration) ? next : nearest), selected.durations[0]));
      if (!selected.aspects.includes(aspect)) setAspect(selected.aspects[0]);
      const supported = STUDIO_MODELS.find((item) => item.id === id);
      if (supported) {
        if (!supported.resolutions.includes(resolution)) setResolution(supported.resolutions[0]);
        // Sound follows the visitor's own choice once they made one.
        setSound((current) => supported.audio && (soundChosen.current ? current : true));
      }
      const limit = Math.max(1, maxVideoReferences(id));
      if (videoReferences.length > limit) {
        // Keep the first ones, drop @图片N for the rest from the prompt (or
        // Generate would stop on a missing image), and offer the way back.
        setTrimmed({ modelId, references: videoReferences, prompt });
        setVideoReferences(videoReferences.slice(0, limit));
        let next = prompt;
        for (let index = videoReferences.length; index > limit; index -= 1) next = removeVideoReferenceToken(next, index);
        setPrompt(next);
      } else {
        setTrimmed(null);
      }
    } else {
      setSound(false);
    }
    setNotice("");
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
  // Video needs a sentence (the studio will not start from images alone);
  // an image can start from reference images.
  const hasInput = Boolean(prompt.trim()) || (kind === "image" && referenceImages.length > 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!hasInput) {
      setNotice(kind === "video" && showSuggestions && !suggestionsHidden ? (zh ? "先写一句想生成的画面，或点下面一条灵感试试" : "Describe what you want to see, or try an idea below.") : kind === "image" ? (zh ? "先写一句想生成的画面，或添加参考图" : "Describe what you want to see, or add a reference image.") : (zh ? "先写一句想生成的画面" : "Describe what you want to see."));
      setNudge((value) => value + 1);
      promptRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!session) {
      localStorage.setItem(pendingStorageKey, JSON.stringify({ at: Date.now(), path: window.location.pathname }));
      signIn.onOpenWithRedirect(`${window.location.pathname}${window.location.search}`);
      return;
    }
    const params = new URLSearchParams();
    params.set("prompt", prompt.trim());
    if (kind === "image") {
      if (!imageAvailable) { setNotice(zh ? "这个图片模型暂未开放，请换一个模型" : "This image model isn't available yet. Choose another one."); return; }
      params.set("model", imageModelId);
      params.set("aspect", aspect);
      params.set("resolution", resolution);
      setSubmitting(true);
      try {
        const uploaded = [];
        for (const item of referenceImages) {
          const result = item.key ? { ok: true as const, key: item.key, url: item.url } : item.file ? await uploadImage(item.file) : null;
          if (!result?.ok) { setNotice(uploadErrorText(result ?? "missing_item", zh)); setSubmitting(false); return; }
          uploaded.push({ key: result.key, name: item.name, url: result.url });
        }
        if (uploaded.length) sessionStorage.setItem("aivd:home-image-references", JSON.stringify(uploaded));
        router.push(`${localizedHref(lang, "/ai/image")}?${params}`);
      } catch { setNotice(zh ? "准备参考图片失败，请重试。" : "Could not prepare the reference images."); setSubmitting(false); }
      return;
    }
    if (!available) { setNotice(zh ? "这个视频模型暂未开放，请换一个模型" : "This video model isn't available yet. Choose another one."); return; }
    if (videoReferences.length > videoReferenceLimit) { setNotice(zh ? `当前模型最多使用 ${videoReferenceLimit} 张参考图，请先移除多余图片。` : `This model accepts up to ${videoReferenceLimit} reference images. Remove the extras before continuing.`); return; }
    const preparedPrompt = prepareVideoReferencePrompt(prompt.trim(), videoReferences.length);
    if (!preparedPrompt.ok) { setNotice(zh ? `找不到 @图片${preparedPrompt.index} 对应的参考图，请补传图片或删掉这个引用` : `No reference image for @Image${preparedPrompt.index}. Add one or remove it from the prompt.`); return; }
    setSubmitting(true);
    try {
      // A new task replaces anything left from an earlier handoff in this tab:
      // reference images, a start image, a draft saved for a trip to pricing.
      for (const key of ["aivd:home-video-references", "aivd:home-start-image", "aivd:home-start-image-name", "aivd:home-start-image-preview", "aivd:credit-draft:video"]) sessionStorage.removeItem(key);
      if (videoReferences.length) {
        const uploaded = [];
        for (const item of videoReferences) {
          const result = item.key ? { ok: true as const, key: item.key, url: item.url } : item.file ? await uploadImage(item.file) : null;
          if (!result?.ok) { setNotice(uploadErrorText(result ?? "missing_item", zh)); setSubmitting(false); return; }
          uploaded.push({ key: result.key, name: item.name, url: result.url });
        }
        sessionStorage.setItem("aivd:home-video-references", JSON.stringify(uploaded));
      }
      params.set("model", modelId);
      params.set("duration", String(duration));
      params.set("aspect", aspect);
      params.set("resolution", resolution);
      params.set("audio", String(sound));
      // The studio starts this generation on arrival, once: it needs this
      // one-time token from storage, deletes it, and uses it as the request's
      // idempotency key, so a reload, Back or a second tab never charges twice.
      const token = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(AUTOSTART_STORAGE_KEY, JSON.stringify({ token, at: Date.now() }));
      params.set("autostart", token);
      // Leave the button in its loading state; the studio page replaces this one.
      router.push(`${localizedHref(lang, "/ai/video")}?${params}`);
    } catch {
      setNotice(zh ? "准备参考图片失败，请重试。" : "Could not prepare the reference image. Please try again.");
      setSubmitting(false);
    }
  }

  const chip = "inline-flex h-8 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.06] px-3 text-xs font-medium text-[var(--du-text)] transition-colors hover:bg-white/[0.11] sm:text-[13px]";
  const plainControl = "inline-flex h-8 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs text-[var(--du-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--du-text)] sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-40";
  const divider = <span aria-hidden="true" className="hidden h-3.5 w-px shrink-0 bg-white/[0.08] sm:block" />;
  const segment = (value: string, selected: boolean, onClick: () => void, label = value) => <button key={value} type="button" onClick={onClick} aria-pressed={selected} className={`min-h-10 rounded-xl px-3 text-sm transition-colors ${selected ? "bg-[var(--du-border-strong)] text-[var(--du-text)]" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{label}</button>;
  const resolutionLabel = (value: string) => value.replace(/k$/, "K");
  const settingRow = (title: string, items: string[], selected: string, choose: (value: string) => void, format: (value: string) => string = (value) => value) =>
    items.length > 1 ? <>
      <p className="mt-4 text-xs text-[var(--du-text-muted)]">{title}</p>
      <div className={`mt-2 grid gap-1 rounded-xl bg-[var(--du-surface-2)] p-1 ${items.length > 4 ? "grid-cols-4" : items.length === 4 ? "grid-cols-4" : items.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>{items.map((item) => segment(item, selected === item, () => choose(item), format(item)))}</div>
    </> : items.length === 1 ? <p className="mt-4 flex justify-between text-xs text-[var(--du-text-muted)]"><span>{title}</span><span className="text-[var(--du-text)]">{format(items[0])}</span></p> : null;

  const imageRefLimit = imageModel?.options.maxImages ?? 10;

  return <div id="home-generator" className="relative z-20 w-full max-w-[1060px] scroll-mt-24">
    <HomeMediaPicker lang={lang} open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(items) => { if (kind === "video") { setVideoReferences(items); setTrimmed(null); } else setReferenceImages(items); setNotice(""); }} onDelete={(id) => { const index = videoReferencesRef.current.findIndex((item) => item.id === id); if (index >= 0) removeVideoReference(index); setReferenceImages((items) => items.filter((item) => item.id !== id)); }} maxSelected={kind === "video" ? videoReferenceLimit : imageRefLimit} selectedIds={(kind === "video" ? videoReferences : referenceImages).map((item) => item.id)} userId={session?.user?.id} />
    {hideKindTabs ? null : <div ref={kindTabsRef} className="du-composer-tabs du-seg" role="tablist" aria-label={zh ? "生成类型" : "Generation type"}>
      <button type="button" role="tab" aria-selected={kind === "video"} onClick={() => { switchKind("video"); setAspect(current?.aspects[0] ?? "16:9"); setResolution(studioModel?.resolutions[0] ?? "720p"); }} className={`du-composer-tab ${kind === "video" ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "视频" : "Video"}</button>
      <button type="button" role="tab" aria-selected={kind === "image"} onClick={() => { switchKind("image"); setAspect("1:1"); setResolution(imageModel?.options.resolutions?.[0] ?? "1K"); }} className={`du-composer-tab ${kind === "image" ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "图片" : "Image"}</button>
      <button type="button" role="tab" aria-selected={kind === "canvas"} onClick={() => switchKind("canvas")} className={`du-composer-tab ${kind === "canvas" ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "画布" : "Canvas"}</button>
    </div>}
    {kind === "canvas" ? <div className="du-canvas-entry" role="tabpanel" aria-label={zh ? "无限画布" : "Infinite Canvas"}>
      <a className="du-canvas-entry-card du-canvas-entry-new" href={localizedHref(lang, "/creative-space/canvas")}>
        <span className="du-canvas-entry-plus"><Plus aria-hidden="true" /></span>
        <span>{zh ? "新建画布" : "New canvas"}</span>
      </a>
      <a className="du-canvas-entry-card du-canvas-entry-video" href={localizedHref(lang, "/creative-space/canvas")}>
        <span className="du-canvas-entry-visual"><Film aria-hidden="true" /><span className="du-canvas-entry-line" /></span>
        <span>{zh ? "视频创作" : "Video creation"}</span>
      </a>
      <a className="du-canvas-entry-card du-canvas-entry-image" href={localizedHref(lang, "/creative-space/canvas")}>
        <span className="du-canvas-entry-visual"><ImageIcon aria-hidden="true" /><span className="du-canvas-entry-line" /></span>
        <span>{zh ? "图片创作" : "Image creation"}</span>
      </a>
    </div> : null}
    {kind !== "canvas" ?
    <form ref={formRef} onSubmit={submit} className={`du-composer${nudge ? " du-composer-nudge" : ""}`} onAnimationEnd={(event) => { if (event.target === event.currentTarget) setNudge(0); }}>
    {kind === "image" ? <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] p-2">
      <button type="button" onClick={() => setPickerOpen(true)} className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-white/70 transition-colors hover:border-[var(--du-accent)] hover:text-white" aria-label={zh ? "选择参考图片" : "Choose reference images"}><Plus className="h-4 w-4" /></button>
      {referenceImages.map((item, index) => <div key={item.id} className="relative h-12 w-12 shrink-0" title={item.name}>
        <button type="button" onClick={() => setPrompt((previous) => `${previous}${previous && !/\s$/.test(previous) ? " " : ""}@${index + 1} `)} className="h-full w-full overflow-hidden rounded-lg border border-white/15" aria-label={zh ? `在提示词中引用第 ${index + 1} 张图片` : `Reference image ${index + 1} in prompt`}><img src={item.url} alt="" className="h-full w-full object-cover" /><span className="absolute bottom-0 left-0 rounded-tr bg-black/75 px-1 text-[11px] text-white">@{index + 1}</span></button>
        <button type="button" onClick={() => removeReference(index)} aria-label={zh ? `移除第 ${index + 1} 张图片` : `Remove image ${index + 1}`} className="absolute -right-1 -top-1 rounded-full bg-black p-0.5 text-white"><X className="h-3 w-3" /></button>
      </div>)}
      <span className="text-xs text-white/45">{zh ? `最多 ${imageRefLimit} 张参考图 · 点击插入 @编号` : `Up to ${imageRefLimit} refs · click to insert @number`}</span>
    </div> : null}
    <div className="du-composer-prompt-row flex min-h-[84px] items-start gap-3.5">
      {kind === "video" ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          title={zh ? `添加参考图（这个模型最多 ${videoReferenceLimit} 张）` : `Add reference images (up to ${videoReferenceLimit} for this model)`}
          className="du-composer-ref-slot"
        >
          <Plus className="h-4 w-4 opacity-75" aria-hidden="true" />
          <span>{videoReferences.length ? `${videoReferences.length}/${videoReferenceLimit}` : (zh ? "参考图" : "Ref")}</span>
        </button>
      ) : null}
      <label htmlFor="home-generator-prompt" className="sr-only">{zh ? "描述创意" : "Describe your idea"}</label>
      <div className="relative min-w-[160px] flex-1">
        <textarea ref={promptRef} id="home-generator-prompt" value={prompt} onChange={(event) => { const next = event.target.value; setPrompt(next); if (replaced !== null) setReplaced(null); if (trimmed !== null) setTrimmed(null); setMentionOpen(kind === "video" && videoReferences.length > 0 && /@(?:图片|image)?\d*$/i.test(next.slice(0, event.target.selectionStart))); if (notice) setNotice(""); }} onKeyDown={(event) => { if (event.key === "Escape") setMentionOpen(false); if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (mentionOpen && videoReferences.length) insertVideoReference(0); else event.currentTarget.form?.requestSubmit(); } }} enterKeyHint="send" rows={3} maxLength={2000} placeholder={kind === "video" ? (zh ? "描述你想生成的画面和动作；添加参考图后，可以用 @图片1 指代它……" : "Describe the shot and the motion. After adding reference images, refer to them as @Image1…") : (zh ? "描述你想生成的画面，比如主体、场景和风格……" : "Describe the picture: the subject, the setting, the style…")} className="min-h-[80px] w-full resize-none bg-transparent py-1 text-[14px] font-normal leading-relaxed text-[var(--du-text)] outline-none placeholder:text-white/38" />
        {kind === "video" && mentionOpen ? <div className="du-composer-mentions">
          {videoReferences.map((item, index) => <button key={item.id} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertVideoReference(index)}><img src={item.url} alt="" /><span>@{zh ? "图片" : "Image"}{index + 1}</span></button>)}
        </div> : null}
      </div>
    </div>
    {kind === "video" && videoReferences.length ? <div className="du-composer-references">
      <div className="du-composer-reference-list">{videoReferences.map((item, index) => <div key={item.id} className="du-composer-reference" title={item.name}>
        <button type="button" onClick={() => insertVideoReference(index)} aria-label={zh ? `引用图片 ${index + 1}` : `Reference image ${index + 1}`}><img src={item.url} alt="" /><span>@{zh ? "图片" : "Image"}{index + 1}</span></button>
        <button type="button" onClick={() => removeVideoReference(index)} aria-label={zh ? `移除图片 ${index + 1}` : `Remove image ${index + 1}`} className="du-composer-reference-remove"><X className="h-3 w-3" /></button>
      </div>)}</div>
      <p>{zh ? `已添加 ${videoReferences.length}/${videoReferenceLimit} 张` : `${videoReferences.length}/${videoReferenceLimit} added`}</p>
    </div> : null}
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-x-3">
      <div className={`relative min-w-0 ${kind === "image" ? "rounded-xl bg-[var(--du-surface-2)] px-2" : ""}`}><KieModelPicker kind={kind} locale={lang} value={kind === "video" ? modelId : imageModelId} onChange={kind === "video" ? selectModel : (id) => { setImageModelId(id); setNotice(IMAGE_MODEL_IDS.includes(id) ? "" : (zh ? "这个图片模型暂未开放，请换一个模型" : "This image model isn't available yet. Choose another one.")); }} connectedIds={kind === "video" ? models.map((item) => item.id) : IMAGE_MODEL_IDS} placement="bottom" glass showConnectionStatus={false} catalogSet="current" compact /></div>
      {kind === "video" && studioModel?.audio ? <>{divider}<button type="button" className={plainControl} onClick={() => { soundChosen.current = true; setSound(!sound); }} aria-pressed={sound}><span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true"><Music2 className="h-4 w-4" />{!sound ? <svg data-swap className="absolute inset-0 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3 21 21" /></svg> : null}</span>{sound ? (zh ? "声音：开" : "Sound: on") : (zh ? "声音：关" : "Sound: off")}</button></> : null}
      {divider}<div data-home-popover className="relative"><button ref={settingsTriggerRef} type="button" className={plainControl} onClick={() => setPanel(panel === "settings" ? null : "settings")} aria-expanded={panel === "settings"}><Settings2 className="h-4 w-4 shrink-0" />{kind === "video" ? `${aspect} / ${duration}s / ${resolutionLabel(resolution)}` : imageResolutions.length ? `${aspect} / ${resolutionLabel(resolution)}` : aspect}</button>{settingsPanel.mounted ? <div data-presence="pop" data-state={settingsPanel.state} className="du-home-popover du-home-settings absolute top-11 right-0 z-50 max-h-[min(52vh,380px)] w-[min(92vw,420px)] origin-top-right overflow-y-auto rounded-2xl border border-[var(--du-border)] p-4 shadow-2xl"><div className="flex items-center justify-between text-sm font-semibold"><span>{zh ? "生成设置" : "Generation settings"}</span><button type="button" onClick={() => setPanel(null)} aria-label={zh ? "关闭" : "Close"}><X className="h-4 w-4" /></button></div>
        {settingRow(zh ? "画面比例" : "Aspect ratio", kind === "video" ? videoAspects : imageAspects, aspect, setAspect)}
        {kind === "video" ? (videoDurations.length > 6
          ? <><p className="mt-4 text-xs text-[var(--du-text-muted)]">{zh ? "视频时长" : "Video length"} · <span className="du-num">{duration}s</span></p><input type="range" min={videoDurations[0]} max={videoDurations.at(-1)} value={duration} onChange={(event) => { const raw = Number(event.target.value); setDuration(videoDurations.reduce((nearest, next) => (Math.abs(next - raw) < Math.abs(nearest - raw) ? next : nearest), videoDurations[0])); }} className="mt-2 w-full accent-[var(--du-accent)]" aria-label={zh ? "视频时长" : "Video length"} /></>
          : settingRow(zh ? "视频时长" : "Video length", videoDurations.map(String), String(duration), (value) => setDuration(Number(value)), (value) => `${value}s`)) : null}
        {settingRow(zh ? "分辨率" : "Resolution", kind === "video" ? videoResolutions : imageResolutions, resolution, setResolution, resolutionLabel)}
      </div> : null}</div>
      <div className="ml-auto flex items-center gap-3">
        {kind === "video" && estimatedCredits !== null ? <span className="du-composer-cost" title={zh ? `本次消耗 ${estimatedCredits} 积分` : `This generation uses ${estimatedCredits} credits`}><Coins className="h-3.5 w-3.5" aria-hidden="true" /><span className="du-num">{estimatedCredits}</span>{zh ? " 积分" : " credits"}</span> : null}
        {kind === "image" && imageCredits ? <span className="du-composer-cost" title={zh ? `每张 ${imageCredits} 积分起` : `From ${imageCredits} credits per image`}><Coins className="h-3.5 w-3.5" aria-hidden="true" /><span className="du-num">{imageCredits}</span>{zh ? " 积分" : " credits"}</span> : null}
        <button type="submit" disabled={submitting || (kind === "video" && !available) || (kind === "image" && !imageAvailable)} aria-label={submitting ? (zh ? "正在提交…" : "Starting…") : kind === "video" ? (zh ? "生成视频" : "Generate video") : (zh ? "生成图片" : "Generate image")} title={submitting ? (zh ? "正在提交…" : "Starting…") : kind === "video" ? (zh ? "生成视频（Enter）" : "Generate video (Enter)") : (zh ? "生成图片（Enter）" : "Generate image (Enter)")} aria-busy={submitting || undefined} className={`du-composer-send${submitting ? " du-composer-send-busy" : ""}`}>{submitting ? <Loader2 key="busy" data-swap className="du-composer-spinner" aria-hidden="true" /> : <ArrowUp key="go" data-swap className="h-4 w-4" aria-hidden="true" />}</button>
      </div>
    </div>
    {notice ? <output key={notice} data-presence="fade" aria-live="polite" className="mt-2 block text-xs text-[var(--du-accent-text)]">{notice}</output> : null}
    {replaced !== null && !notice ? <output data-presence="fade" className="mt-2 flex items-center gap-2 text-xs text-[var(--du-text-muted)]">{zh ? "已换成这条灵感" : "Replaced with this idea"}<button type="button" className="text-[var(--du-accent-text)] hover:underline" onClick={() => { setPrompt(replaced.prompt); setAspect(replaced.aspect); setReplaced(null); promptRef.current?.focus({ preventScroll: true }); }}>{zh ? "恢复原内容" : "Undo"}</button></output> : null}
    {trimmed !== null ? <output data-presence="fade" className="mt-2 flex items-center gap-2 text-xs text-[var(--du-text-muted)]">{zh ? `这个模型最多支持 ${videoReferenceLimit} 张参考图，已自动保留前 ${videoReferenceLimit} 张` : `This model supports up to ${videoReferenceLimit} reference image${videoReferenceLimit > 1 ? "s" : ""}. Kept the first ${videoReferenceLimit}.`}<button type="button" className="text-[var(--du-accent-text)] hover:underline" onClick={() => { const back = trimmed; setTrimmed(null); setVideoReferences(back.references); setPrompt(back.prompt); selectModel(back.modelId); }}>{zh ? "换回原模型" : "Switch back"}</button></output> : null}
    {kind === "video" && showSuggestions && !suggestionsHidden ? <div className="du-composer-suggestions">
      <span className="du-composer-suggestions-label mr-1">{zh ? "快捷灵感" : "Quick ideas"}</span>
      {suggestions.map((item) => (
        <button
          key={item.id}
          type="button"
          title={zh ? item.prompt.zh : item.prompt.en}
          onClick={() => {
            replacePrompt(zh ? item.prompt.zh : item.prompt.en);
            if (current?.aspects.includes(item.aspect)) setAspect(item.aspect);
            setNotice("");
            promptRef.current?.focus({ preventScroll: true });
          }}
          className="du-composer-suggestion"
        >
          <img src={item.image} alt="" loading="lazy" />
          <span>{zh ? item.title.zh : item.title.en}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => switchKind("canvas")}
        className="du-composer-suggestion"
      >
        <Sparkles className="h-3.5 w-3.5 text-[var(--du-accent-text)]" aria-hidden="true" />
        <span>{zh ? "试试无限画布" : "Try Canvas"}</span>
      </button>
      <button type="button" onClick={() => setSuggestionOffset((value) => (value + 3) % HOME_TEMPLATES.length)} className="du-composer-suggestions-label ml-auto" title={zh ? "换一批灵感" : "Refresh"} aria-label={zh ? "换一批灵感" : "Refresh"}><RefreshCw className="h-3 w-3" aria-hidden="true" /></button>
      <button type="button" onClick={() => setSuggestionsHidden(true)} className="du-composer-suggestions-label">{zh ? "收起" : "Hide"}</button>
    </div> : null}
    {kind === "video" && showSuggestions && suggestionsHidden ? <div className="du-composer-suggestions"><button type="button" onClick={() => setSuggestionsHidden(false)} className="du-composer-suggestions-label">{zh ? "快捷灵感" : "Quick ideas"}</button></div> : null}
    </form> : null}
  </div>;
}
