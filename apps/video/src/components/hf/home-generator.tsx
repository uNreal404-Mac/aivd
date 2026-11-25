"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, AtSign, Check, ChevronDown, Coins, Film, Image as ImageIcon, Loader2, Music2, Plus, RefreshCw, Settings2, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { HomeComposerResize } from "./home-composer-resize";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { WAN_REFERENCE_MAX_FILES } from "@/lib/wan-video-references";
import { listGuestAssets, readyPickerVideo, type PickerAsset } from "@/lib/home-media-library";
import { findHomeDraft, homeDraftKey, homeDraftReferences, rememberHomeGenerationDraft } from "@/lib/home-draft";
import { HomeKeyframes } from "./home-keyframes";
import { prepareHomeKeyframes, remapHomeKeyframeMentions } from "@/lib/home-keyframes";
import { KLING_KEYFRAME_MODEL, KLING_MAX_MIDDLE_FRAMES, mapKlingFrames, orderedKlingFrames, maxKlingFrames, type KlingKeyframes } from "@/lib/kling-keyframes";
import { imageOutputCount } from "@/lib/image-output-count";
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
import { HOME_IMAGE_IDEAS } from "@/lib/home-image-ideas";
import { MAX_HOME_REFERENCES, maxVideoReferences, prepareVideoReferencePrompt, removeVideoReferenceToken } from "@/lib/video-references";
import "./home-generator.css";

const HomeSpeech = dynamic(() => import("./home-speech").then(module => module.HomeSpeech));
const HomeAgentComposer = dynamic(() => import("./home-agent").then((module) => module.HomeAgent));

type Model = { id: string; name: string; durations: number[]; aspects: string[] };
export type HomeGeneratorPreset = { prompt: string; aspect?: string; nonce: number };
type Props = { homepage?: boolean; lang: string; models: Model[]; onModelChange: (id: string) => void; preset?: HomeGeneratorPreset | null; initialKind?: "video" | "image"; initialPrompt?: string; hideKindTabs?: boolean; draftStorageKey?: string; showSuggestions?: boolean; showImageIdeas?: boolean };
type Panel = "settings" | "mode" | null;

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

/** A small outline in the shape of an aspect ratio (dashed square for auto). */
function AspectShape({ value }: { value: string }) {
  const [w, h] = value.split(":").map(Number);
  if (!w || !h) return <span aria-hidden="true" className="du-aspect-shape is-auto" style={{ width: 14, height: 14 }} />;
  const scale = 16 / Math.max(w, h);
  return <span aria-hidden="true" className="du-aspect-shape" style={{ width: Math.max(6, Math.round(w * scale)), height: Math.max(6, Math.round(h * scale)) }} />;
}

export function HomeGenerator(props: Props) {
  const { data: session } = useSession();
  // Changing accounts unmounts the previous account's form, thumbnails and pending uploads.
  return <HomeGeneratorForm key={session?.user?.id ?? "guest"} {...props} />;
}

function HomeGeneratorForm({ homepage = false, lang, models: serverModels, onModelChange, preset, initialKind = "video", initialPrompt = "", hideKindTabs = false, draftStorageKey = "aivd:home-draft", showSuggestions = true, showImageIdeas = false }: Props) {
  const zh = lang.toLowerCase().startsWith("zh");
  const pendingStorageKey = draftStorageKey === "aivd:home-draft" ? "aivd:home-pending-generate" : `${draftStorageKey}:pending-generate`;
  const router = useRouter();
  const signIn = useSigninModal();
  const { data: session, isPending: sessionPending } = useSession();
  const owner = session?.user?.id;
  const scopedDraftKey = homeDraftKey(draftStorageKey, owner);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const models = useMemo(() => withStudioModels(serverModels), [serverModels]);
  const defaultVideoModel = models.find((item) => item.id === DEFAULT_VIDEO_MODEL_ID) ?? models[0];
  const [editorSize, setEditorSize] = useState({ width: 1010, height: 158 });
  const [speechMode, setSpeechMode] = useState(false);
  useEffect(() => {
    if (!homepage || !owner) return;
    try {
      if (sessionStorage.getItem("aivd:home-speech:resume") === "guest") setSpeechMode(true);
    } catch { /* Optional guest resume. */ }
  }, [owner, homepage]);
  const [agentVisited, setAgentVisited] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);
  const [mentionAnchor, setMentionAnchor] = useState<HTMLButtonElement | null>(null);
  const [kind, setKind] = useState<"video" | "image" | "canvas" | "agent">(initialKind);
  const chosenTab = useRef<typeof kind | null>(null);
  const resumedGuestRequest = useRef(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [modelId, setModelId] = useState(defaultVideoModel?.id ?? DEFAULT_VIDEO_MODEL_ID);
  const [keyframeMode, setKeyframeMode] = useState(false);
  const [keyframes, setKeyframes] = useState<KlingKeyframes<PickerAsset>>({});
  const useKeys = homepage && kind === "video" && keyframeMode && modelId === KLING_KEYFRAME_MODEL;
  const keyframeImages = orderedKlingFrames(keyframes);
  const [wanClipMode, setWanClipMode] = useState(false);
  const clipMode = homepage && kind === "video" && modelId === "wan2.6" && wanClipMode;
  const [imageModelId, setImageModelId] = useState(IMAGE_MODEL_IDS[0] ?? "");
  const imageModel = getMarketModel(imageModelId);
  const [imageCount, setImageCount] = useState(1);
  const maxImageCount = homepage ? imageModel?.options.maxCount ?? 1 : 1;
  const imageAvailable = IMAGE_MODEL_IDS.includes(imageModelId);
  const [prompt, setPrompt] = useState(initialPrompt.slice(0, 2000));
  const [videoReferences, setVideoReferences] = useState<PickerAsset[]>([]);
  const [referenceImages, setReferenceImages] = useState<PickerAsset[]>([]);
  // A delete in the library finishes later: it must find the image where it
  // is now, not where it was when the delete started.
  const activeRefs = useKeys ? keyframeImages : videoReferences;
  const videoReferencesRef = useRef(videoReferences);
  videoReferencesRef.current = videoReferences;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftStore = useRef<Storage | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [aspect, setAspect] = useState(initialKind === "image" ? "1:1" : (defaultVideoModel?.aspects[0] ?? "16:9"));
  const [duration, setDuration] = useState(defaultVideoModel?.durations[0] ?? 4);
  const [resolution, setResolution] = useState(() => initialKind === "image" ? "1K" : (STUDIO_MODELS.find((item) => item.id === defaultVideoModel?.id)?.resolutions[0] ?? "720p"));
  // What one image will freeze: the chosen resolution and the attached
  // reference images, priced as the image studio and the server price it.
  const imageCredits = imageModel ? marketCredits(imageModel, { prompt: "", aspectRatio: aspect, resolution: imageModel.options.resolutions?.includes(resolution) ? resolution : imageModel.options.resolutions?.[0], count: imageCount, imageUrls: referenceImages.map((item) => item.url ?? item.id) }) : null;
  // Sound starts as the studio starts it: on for models that make sound.
  const [sound, setSound] = useState(() => Boolean(STUDIO_MODELS.find((item) => item.id === (defaultVideoModel?.id ?? DEFAULT_VIDEO_MODEL_ID))?.audio));
  const soundChoice = useRef<boolean | null>(null);
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
  const estimatedCredits = studioModel ? estimateCredits({ modelId, duration, resolution }, { images: clipMode || useKeys ? 0 : videoReferences.length, audio: sound }) : null;
  const videoReferenceLimit = clipMode ? WAN_REFERENCE_MAX_FILES : homepage ? MAX_HOME_REFERENCES : Math.max(1, maxVideoReferences(modelId));
  // The settings offer what the chosen model can actually do, nothing greyed out.
  const videoAspects = current?.aspects ?? [];
  const videoResolutions = studioModel?.resolutions ?? [];
  const videoDurations = current?.durations ?? [];
  const imageAspects = (imageModel?.options.aspects ?? IMAGE_ASPECTS).filter((item) => IMAGE_ASPECTS.includes(item));
  const imageResolutions = imageModel?.options.resolutions ?? [];
  const settingsPanel = usePresence(panel === "settings");
  const modePanel = usePresence(panel === "mode");
  const modelPanel = usePresence(modelOpen);
  const functionMenuOpen = modePanel.mounted || settingsPanel.mounted || modelPanel.mounted;
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
  const modeTriggerRef = useRef<HTMLButtonElement>(null);
  // "Text only" hides the reference slot (Pollo's mode switch). Choosing it
  // with images attached takes them off, and that can be undone.
  // Per tab: the video and image tabs keep their own references and mode.
  const [textOnlyByKind, setTextOnlyByKind] = useState({ video: false, image: false });
  // "Try these" prompts under the Image tab (Pollo); hidden for good on request.
  const [imageIdeaOffset, setImageIdeaOffset] = useState(0);
  const [imageIdeasHidden, setImageIdeasHidden] = useState(true);
  useEffect(() => {
    try {
      setImageIdeasHidden(localStorage.getItem("aivd:home-image-ideas-hidden") === "1");
    } catch {
      setImageIdeasHidden(false);
    }
  }, []);
  const textOnly = kind === "image" ? textOnlyByKind.image : kind === "video" ? textOnlyByKind.video : false;
  const setTextOnly = (value: boolean) => setTextOnlyByKind((previous) => (kind === "image" ? { ...previous, image: value } : kind === "video" ? { ...previous, video: value } : previous));
  const [clearedRefs, setClearedRefs] = useState<{ kind: "video" | "image"; references: PickerAsset[]; prompt: string } | null>(null);

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
        else if (activePanel === "mode") modeTriggerRef.current?.focus();
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
    if (sessionPending || draftReady) return;
    let live = true;
    void (async () => {
      try {
        const pending = JSON.parse(localStorage.getItem(pendingStorageKey) || "null");
        const resume = Boolean(owner && pending?.path === window.location.pathname && Date.now() - pending.at < PENDING_TTL_MS);
        const deviceDraft = findHomeDraft(localStorage, draftStorageKey, owner, resume);
        const continuingGuest = resume && deviceDraft?.key === homeDraftKey(draftStorageKey);
        const tabDraft = !continuingGuest && sessionStorage.getItem(scopedDraftKey) ? findHomeDraft(sessionStorage, draftStorageKey, owner, false) : null;
        const draft = tabDraft ?? deviceDraft;
        const source = tabDraft ? sessionStorage : localStorage;
        if (draft) {
          const { saved } = draft;
          const hasLocalFiles = homeDraftReferences(saved).some(item => item.id && !(item.key && item.url));
          const local = hasLocalFiles ? await listGuestAssets(owner) : [];
          const restore = (items: unknown): PickerAsset[] => Array.isArray(items) ? items.flatMap((item) => {
            if (!item || typeof item.id !== "string") return [];
            const guest = local.find((asset) => asset.id === item.id);
            if (item.key && item.url && owner && (!String(item.key).startsWith("uploads/") || String(item.key).startsWith(`uploads/${owner}/`))) return [item as PickerAsset];
            return guest ? [guest] : [];
          }) : [];
          if (!live) return;
          const restoredKind = chosenTab.current ?? (!hideKindTabs && (saved.kind === "video" || saved.kind === "image") ? saved.kind : initialKind);
          if (!chosenTab.current && !hideKindTabs && (saved.kind === "video" || saved.kind === "image")) setKind(saved.kind);
          resumedGuestRequest.current = continuingGuest && !chosenTab.current;
          if (typeof saved.prompt === "string" && !initialPrompt) setPrompt(saved.prompt);
          // The visitor's own text replaced by an idea can still be brought back after a reload.
          if (!initialPrompt && saved.replaced && typeof saved.replaced.prompt === "string" && typeof saved.replaced.aspect === "string") setReplaced({ prompt: saved.replaced.prompt, aspect: saved.replaced.aspect });
          const restoredVideoModelId = typeof saved.modelId === "string" ? saved.modelId : (defaultVideoModel?.id ?? DEFAULT_VIDEO_MODEL_ID);
          const restoredImageModelId = typeof saved.imageModelId === "string" ? saved.imageModelId : (IMAGE_MODEL_IDS[0] ?? "");
          if (typeof saved.modelId === "string") setModelId(saved.modelId);
          if (typeof saved.imageModelId === "string") setImageModelId(saved.imageModelId);
          setImageCount(imageOutputCount(saved.imageCount, homepage ? getMarketModel(restoredImageModelId)?.options.maxCount : 1));
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
          const restored = restore(saved.videoReferences).filter((item) => homepage || !item.mimeType?.startsWith("video/"));
          setVideoReferences(restored);
          setWanClipMode(homepage && restoredVideoModelId === "wan2.6" && (saved.wanClipMode === true || restored.some((item) => item.mimeType?.startsWith("video/"))));
          setReferenceImages(restore(saved.referenceImages));
          if (homepage && saved.keyframes && typeof saved.keyframes === "object") {
            setKeyframes({ first: restore([saved.keyframes.first])[0], middle: restore(saved.keyframes.middle), last: restore([saved.keyframes.last])[0] });
          }
          setKeyframeMode(homepage && restoredVideoModelId === KLING_KEYFRAME_MODEL && saved.keyframeMode === true);
          const accountRaw = localStorage.getItem(scopedDraftKey);
          // A guest continuation must not overwrite an existing account draft.
          // Keep it editable and reloadable in this signed-in tab instead.
          draftStore.current = tabDraft || (accountRaw !== null && (draft.key !== scopedDraftKey || accountRaw !== draft.raw)) ? sessionStorage : localStorage;
          if (draft.key !== scopedDraftKey && source.getItem(draft.key) === draft.raw) {
            const imported = JSON.stringify({ ...saved, owner });
            draftStore.current.setItem(scopedDraftKey, imported);
            if (draftStore.current === source && source.getItem(scopedDraftKey) === imported && source.getItem(draft.key) === draft.raw) source.removeItem(draft.key);
          }
        } else {
          draftStore.current = localStorage.getItem(scopedDraftKey) === null ? localStorage : sessionStorage;
        }
      } catch { /* An old draft must not prevent the composer opening. */ }
      if (live) setDraftReady(true);
    })();
    return () => { live = false; };
  }, [sessionPending, draftReady, owner, scopedDraftKey, draftStorageKey, pendingStorageKey]);

  useEffect(() => {
    if (sessionPending || !draftReady || !draftStore.current) return;
    const compactAsset = ({ id, name, mimeType, key, url, size }: PickerAsset) => ({ id, name, mimeType, key, size, url: key ? url : "" });
    const compact = (items: PickerAsset[]) => items.map(compactAsset);
    draftStore.current.setItem(scopedDraftKey, JSON.stringify({ owner, kind, prompt, modelId, imageModelId, imageCount, wanClipMode, keyframeMode, keyframes: mapKlingFrames(keyframes, compactAsset), aspect, resolution, duration, sound, videoReferences: compact(videoReferences), referenceImages: compact(referenceImages), replaced }));
  }, [sessionPending, draftReady, owner, scopedDraftKey, kind, prompt, modelId, imageModelId, imageCount, wanClipMode, keyframeMode, keyframes, aspect, resolution, duration, sound, videoReferences, referenceImages, replaced]);

  // A "Generate" pressed while signed out continues after sign-in, if that
  // happens within a few minutes on the same page. Closing the sign-in dialog
  // without signing in drops it, so it never fires by surprise later.
  useEffect(() => {
    if (!draftReady || !session) return;
    let pending: { at?: number; path?: string } | null = null;
    try { pending = JSON.parse(localStorage.getItem(pendingStorageKey) || "null"); } catch { pending = null; }
    localStorage.removeItem(pendingStorageKey);
    if (resumedGuestRequest.current && pending && typeof pending.at === "number" && Date.now() - pending.at < PENDING_TTL_MS && pending.path === window.location.pathname) formRef.current?.requestSubmit();
  }, [draftReady, session]);

  // Only once the session is known: right after a Google or email sign-in
  // the page loads with the dialog closed and the session still loading.
  useEffect(() => {
    if (!signIn.isOpen && !session && !sessionPending) localStorage.removeItem(pendingStorageKey);
  }, [signIn.isOpen, session, sessionPending]);

  const removeVideoReference = (index: number) => {
    setVideoReferences((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    // Removing one by hand ends the offer to go back to the trimmed set.
    setTrimmed(null);
    setPrompt((previous) => removeVideoReferenceToken(previous, index + 1));
    setNotice("");
    setMentionOpen(false);
  };

  const insertVideoReference = (index: number) => {
    const field = promptRef.current;
    const start = field?.selectionStart ?? prompt.length;
    const end = field?.selectionEnd ?? start;
    const before = prompt.slice(0, start);
    const mention = before.match(/@(?:图片|image|视频|video)?\d*$/i);
    const from = mention ? start - mention[0].length : start;
    const prefix = prompt.slice(0, from);
    const spacing = prefix && !/\s$/.test(prefix) ? " " : "";
    const label = clipMode ? (zh ? "视频" : "Video") : (zh ? "图片" : "Image");
    const insertion = `${spacing}@${label}${index + 1} `;
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
    if ((useKeys && id === modelId) || (clipMode && id === modelId)) return;
    if (id !== "wan2.6" && videoReferences.some((item) => item.mimeType?.startsWith("video/"))) {
      setNotice(zh ? "请先移除参考视频，再切换到这个模型。" : "Remove the reference videos before switching to this model.");
      return;
    }
    if (id !== "wan2.6") setWanClipMode(false);
    setModelId(id);
    onModelChange(id);
    const selected = models.find((item) => item.id === id);
    if (selected) {
      if (!selected.durations.includes(duration)) setDuration(selected.durations.reduce((nearest, next) => (Math.abs(next - duration) < Math.abs(nearest - duration) ? next : nearest), selected.durations[0]));
      if (!selected.aspects.includes(aspect)) setAspect(selected.aspects[0]);
      const supported = STUDIO_MODELS.find((item) => item.id === id);
      if (supported) {
        if (!supported.resolutions.includes(resolution)) setResolution(supported.resolutions[0]);
        // Sound follows the visitor's own choice once they made one, even
        // after passing through a model without sound.
        setSound(supported.audio && (soundChoice.current ?? true));
      }
      // Keep the home composition intact when changing models. The selected
      // model's API limit is checked before generation instead.
      setTrimmed(null);
    } else {
      setSound(false);
    }
    setNotice("");
  };

  const [nudge, setNudge] = useState(0);
  const selectImageModel = (id: string) => {
    const options = getMarketModel(id)?.options;
    setImageModelId(id);
    setImageCount((count) => imageOutputCount(count, homepage ? options?.maxCount : 1));
    if (options?.resolutions?.length && !options.resolutions.includes(resolution)) setResolution(options.resolutions[0]);
    if (options?.aspects?.length && !options.aspects.includes(aspect)) setAspect(options.aspects[0]);
    setNotice(IMAGE_MODEL_IDS.includes(id) ? "" : (zh ? "这个图片模型暂未开放，请换一个模型" : "This image model isn't available yet. Choose another one."));
  };

  // Switching tabs starts clean: an error from the other tab (an unconnected
  // video model, say) must not follow the visitor to the image tab.
  const switchKind = (next: "video" | "image" | "canvas" | "agent") => {
    setSpeechMode(false);
    chosenTab.current = next;
    // An undo for a replaced prompt belongs to the tab it was made on.
    if (next !== kind) setReplaced(null);
    if (next === "agent") setAgentVisited(true);
    setKind(next);
    setMobileExpanded(false);
    setPanel(null);
    setModelOpen(false);
    setMentionOpen(false);
    setNotice("");
    setNudge(0);
  };

  // An empty prompt gets a nudge instead of a silent no-op. A start image or
  // reference images alone are enough to go on.
  // Video needs a sentence (the studio will not start from images alone);
  // an image can start from reference images.
  const hasInput = Boolean(prompt.trim()) || (kind === "image" && referenceImages.length > 0);

  // A new task replaces anything an earlier handoff left in this tab: its
  // reference images, a start image, and a draft saved for a trip to pricing.
  const clearHandoff = (target: "video" | "image") => {
    const keys = target === "video"
      ? ["aivd:home-video-keyframes", "aivd:home-video-references", "aivd:home-video-reference-owner", "aivd:home-start-image", "aivd:home-start-image-name", "aivd:home-start-image-preview", "aivd:credit-draft:video"]
      : ["aivd:home-image-references", "aivd:home-image-reference-owner", "aivd:credit-draft:image"];
    for (const key of keys) sessionStorage.removeItem(key);
    if (owner) sessionStorage.removeItem(`aivd:credit-draft:${target}:${owner}`);
  };

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
      const modelLimit = imageModel?.options.maxImages ?? 0;
      if (referenceImages.length > modelLimit) {
        setNotice(zh ? `已添加 ${referenceImages.length} 个参考元素；当前图片模型生成时最多支持 ${modelLimit} 个，请先移除多余素材或切换模型。` : `${referenceImages.length} reference elements are attached. This image model supports ${modelLimit} at generation; remove extras or choose another model.`);
        return;
      }
      params.set("model", imageModelId);
      if (homepage) params.set("count", String(imageCount));
      params.set("aspect", aspect);
      params.set("resolution", resolution);
      setSubmitting(true);
      try {
        const uploaded = [];
        for (const item of referenceImages) {
          if (!alive.current) return;
          const result = item.key ? { ok: true as const, key: item.key, url: item.url } : item.file ? await uploadImage(item.file, fetch, session.user.id) : null;
          if (!result?.ok) { setNotice(uploadErrorText(result ?? "missing_item", zh)); setSubmitting(false); return; }
          uploaded.push({ key: result.key, name: item.name, url: result.url });
        }
        if (!alive.current) return;
        clearHandoff("image");
        if (uploaded.length) {
          sessionStorage.setItem("aivd:home-image-reference-owner", session.user.id);
          sessionStorage.setItem("aivd:home-image-references", JSON.stringify(uploaded));
        }
        const handoff = crypto.randomUUID();
        sessionStorage.setItem("aivd:home-image-handoff", handoff);
        params.set("handoff", handoff);
        rememberHomeGenerationDraft(sessionStorage, { token: handoff, kind: "image", owner: session.user.id, base: draftStorageKey, draftKey: scopedDraftKey, prompt: prompt.trim() }, [localStorage, sessionStorage]);
        router.push(`${localizedHref(lang, "/ai/image")}?${params}`);
      } catch { setNotice(zh ? "准备参考图片失败，请重试。" : "Could not prepare the reference images."); setSubmitting(false); }
      return;
    }
    if (!available) { setNotice(zh ? "这个视频模型暂未开放，请换一个模型" : "This video model isn't available yet. Choose another one."); return; }
    if (useKeys && (!keyframeImages.length || keyframeImages.length > maxKlingFrames(duration) || (keyframes.middle?.length ?? 0) > KLING_MAX_MIDDLE_FRAMES)) {
      setNotice(zh ? `请选择 1 至 ${maxKlingFrames(duration)} 张关键帧，其中中间帧最多 8 张。` : `Choose 1–${maxKlingFrames(duration)} frames, including up to 8 middle frames.`); return;
    }
    if (clipMode && videoReferences.length === 0) { setNotice(zh ? "请先添加一个参考视频。" : "Add a reference video first."); return; }
    if (videoReferences.some((item) => Boolean(item.mimeType?.startsWith("video/")) !== clipMode)) {
      setNotice(zh ? "请单独选择图片或视频参考，再提交。" : "Choose either image or video references before submitting."); return;
    }
    const generationReferenceLimit = clipMode ? WAN_REFERENCE_MAX_FILES : maxVideoReferences(modelId);
    if (videoReferences.length > generationReferenceLimit) {
      setNotice(clipMode
        ? (zh ? `最多使用 ${generationReferenceLimit} 段参考视频，请先移除多余视频。` : `Choose up to ${generationReferenceLimit} reference videos.`)
        : (zh ? `已添加 ${videoReferences.length} 个参考元素；当前视频模型生成时最多支持 ${generationReferenceLimit} 个，请先移除多余素材或切换模型。` : `${videoReferences.length} reference elements are attached. This video model supports ${generationReferenceLimit} at generation; remove extras or choose another model.`));
      return;
    }
    const duplicateClip = clipMode && videoReferences.some((item, index) => videoReferences.slice(0, index).some((prior) => prior.id === item.id || (prior.key && prior.key === item.key)));
    if (duplicateClip) {
      setNotice(zh ? "同一段参考视频只能添加一次，请移除重复项。" : "Remove duplicate clips before submitting.");
      return;
    }
    const preparedPrompt = prepareVideoReferencePrompt(prompt.trim(), activeRefs.length, clipMode ? "video" : "image");
    if (!preparedPrompt.ok) { setNotice(zh ? `找不到 @${clipMode ? "视频" : "图片"}${preparedPrompt.index} 对应的素材，请补传或删掉这个引用` : `No reference for @${clipMode ? "Video" : "Image"}${preparedPrompt.index}. Add one or remove it from the prompt.`); return; }
    setSubmitting(true);
    try {
      if (useKeys) {
        const frames = await prepareHomeKeyframes(keyframes, session.user.id, () => alive.current, (asset, uploaded) => {
          const merge = (item: PickerAsset) => item.id === asset.id ? { ...item, ...uploaded } : item;
          setKeyframes((previous) => mapKlingFrames(previous, merge));
          const saved = JSON.parse(draftStore.current?.getItem(scopedDraftKey) || "null");
          if (saved?.owner === owner && saved.keyframes) {
            saved.keyframes = mapKlingFrames(saved.keyframes as KlingKeyframes<PickerAsset>, merge);
            draftStore.current?.setItem(scopedDraftKey, JSON.stringify(saved));
          }
        });
        if (!alive.current) return;
        clearHandoff("video");
        sessionStorage.setItem("aivd:home-video-keyframes", JSON.stringify({ ...frames, ownerId: session.user.id }));
        params.set("input", "keyframes");
      } else if (videoReferences.length) {
        const uploaded: Array<{key: string; name: string; url: string; sourceId?: string; mimeType?: string}> = [];
        for (const item of videoReferences) {
          if (!alive.current) return;
          if (clipMode) {
            const prepared = await readyPickerVideo(item, session.user.id);
            if (!alive.current) return;
            if (uploaded.some((other) => other.key === prepared.key)) {
              setNotice(zh ? "同一段参考视频只能添加一次，请移除重复项。" : "Remove duplicate clips before submitting.");
              setSubmitting(false);
              return;
            }
            uploaded.push(prepared);
            if (!item.key) {
              const updated = { ...item, key: prepared.key, url: prepared.url, size: item.file?.size ?? item.size };
              setVideoReferences((current) => current.map((ref) => ref.id === item.id ? updated : ref));
              // Save this successful upload before attempting the next one.
              // A partial failure or refresh can then reuse its server key.
              const saved = JSON.parse(draftStore.current?.getItem(scopedDraftKey) || "null");
              if (saved?.owner === owner && Array.isArray(saved.videoReferences)) {
                saved.videoReferences = saved.videoReferences.map((ref: PickerAsset) => ref.id === item.id ? { ...ref, key: prepared.key, url: prepared.url, size: updated.size } : ref);
                draftStore.current?.setItem(scopedDraftKey, JSON.stringify(saved));
              }
            }
            continue;
          }
          const result = item.key ? { ok: true as const, key: item.key, url: item.url } : item.file ? await uploadImage(item.file, fetch, session.user.id) : null;
          if (!result?.ok) { setNotice(uploadErrorText(result ?? "missing_item", zh)); setSubmitting(false); return; }
          uploaded.push({ key: result.key, name: item.name, url: result.url });
        }
        // Uploads done: only now does this task replace what an earlier
        // handoff left in the tab (a failed upload keeps everything as it was).
        if (!alive.current) return;
        clearHandoff("video");
        sessionStorage.setItem("aivd:home-video-reference-owner", session.user.id);
        sessionStorage.setItem("aivd:home-video-references", JSON.stringify(uploaded));
      } else {
        clearHandoff("video");
      }
      params.set("model", modelId);
      params.set("duration", String(duration));
      if (!clipMode && !useKeys) { params.set("aspect", aspect); params.set("audio", String(sound)); }
      params.set("resolution", resolution);
      // The studio starts this generation on arrival, once: it needs this
      // one-time token from storage, deletes it, and uses it as the request's
      // idempotency key, so a reload, Back or a second tab never charges twice.
      const token = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(AUTOSTART_STORAGE_KEY, JSON.stringify({ token, at: Date.now() }));
      params.set("autostart", token);
      rememberHomeGenerationDraft(sessionStorage, { token, kind: "video", owner: session.user.id, base: draftStorageKey, draftKey: scopedDraftKey, prompt: prompt.trim() }, [localStorage, sessionStorage]);
      // Leave the button in its loading state; the studio page replaces this one.
      router.push(`${localizedHref(lang, "/ai/video")}?${params}`);
    } catch {
      setNotice(clipMode ? (zh ? "准备参考视频失败，请重试。" : "Could not prepare the reference video. Please try again.") : (zh ? "准备参考图片失败，请重试。" : "Could not prepare the reference image. Please try again."));
      setSubmitting(false);
    }
  }

  const chip = "inline-flex h-8 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full bg-white/[0.06] px-3 text-xs font-medium text-[var(--du-text)] transition-colors hover:bg-white/[0.11] sm:text-[13px]";
  const plainControl = "inline-flex h-8 max-w-full items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs text-[var(--du-text-muted)] transition-colors hover:bg-white/[0.06] hover:text-[var(--du-text)] sm:text-[13px] disabled:cursor-not-allowed disabled:opacity-40";
  const divider = <span aria-hidden="true" className="du-composer-divider hidden h-3.5 w-px shrink-0 bg-white/[0.08] sm:block" />;
  const resolutionLabel = (value: string) => value.replace(/k$/, "K");

  const imageRefLimit = homepage ? MAX_HOME_REFERENCES : imageModel?.options.maxImages ?? 10;
  const references = kind === "video" ? videoReferences : referenceImages;
  const referenceLimit = kind === "video" ? videoReferenceLimit : imageRefLimit;
  const canReference = homepage || (kind === "video" ? (clipMode || maxVideoReferences(modelId) > 0) : imageRefLimit > 0);
  // Some video models only work from an image: no text-only choice for them.
  const needsImage = kind === "video" && Boolean(getMarketModel(modelId)?.options.requiresImage);
  const showRefSlot = canReference && (!textOnly || needsImage);
  const offerKeyframes = homepage && kind === "video" && models.some(item => item.id === KLING_KEYFRAME_MODEL);
  const keysLabel = zh ? "关键帧生视频" : "Keyframes to video";
  const chooseKeyframes = () => {
    setPanel(null);
    if (useKeys) return;
    if (videoReferences.length) { setNotice(zh ? "请先移除当前参考素材，再切换到关键帧。" : "Remove current references before switching to keyframes."); return; }
    selectModel(KLING_KEYFRAME_MODEL);
    setKeyframeMode(true);
    setWanClipMode(false);
    setTextOnly(false);
    setDuration(10);
    setResolution("1080p");
    setNotice("");
  };
  const switchAwayFromFrames = () => {
    if (!useKeys) return true;
    if (keyframeImages.length) { setNotice(zh ? "请先移除关键帧，再切换模式。" : "Remove the keyframes before switching modes."); return false; }
    setKeyframeMode(false);
    return true;
  };
  const offerClip = homepage && kind === "video" && models.some((item) => item.id === "wan2.6");
  const clipLabel = zh ? "视频参考 · Wan 2.6" : "Video reference · Wan 2.6";
  const chooseClipMode = () => {
    setPanel(null);
    if (clipMode || !switchAwayFromFrames()) return;
    if (videoReferences.length) {
      setNotice(zh ? "请先移除参考图，再切换为视频参考。" : "Remove your images before switching to video references.");
      return;
    }
    selectModel("wan2.6");
    setWanClipMode(true);
    setTextOnly(false);
    setNotice("");
  };
  const modeLabel = (text: boolean) => kind === "video"
    ? (text ? (zh ? "文生视频" : "Text to video") : (zh ? "参考生视频" : "Reference to video"))
    : (text ? (zh ? "文生图" : "Text to image") : (zh ? "参考生图" : "Reference to image"));
  const modeHint = (text: boolean) => text
    ? (zh ? "只用文字描述，不加参考图" : "Words only, no reference images")
    : kind === "video" ? (zh ? "加参考图，用 @ 指定人物或场景" : "Add images and @ them for people, objects or places") : (zh ? "加参考图，在提示词里 @ 引用" : "Add images and @ them in the prompt");
  const chooseMode = (text: boolean) => {
    setPanel(null);
    if (!switchAwayFromFrames()) return;
    if (clipMode) {
      if (videoReferences.length) { setNotice(zh ? "请先移除参考视频，再切换模式。" : "Remove the reference videos before switching modes."); return; }
      setWanClipMode(false);
      setTextOnly(text);
      return;
    }
    if (text === !showRefSlot) return;
    if (text && references.length) {
      setClearedRefs({ kind: kind === "video" ? "video" : "image", references, prompt });
      if (kind === "video") { setVideoReferences([]); setPrompt((previous) => previous.replace(/@(?:图片|image)\d+\s?/gi, "")); }
      else { setReferenceImages([]); setPrompt((previous) => previous.replace(/@(?:图片|image)?\d+\s?/gi, "")); }
      setTrimmed(null);
    }
    setTextOnly(text);
  };
  // The @ in the empty prompt hint mentions the first attached image, or
  // opens the library when there is none yet.
  const mentionFirst = () => {
    if (!references.length) { setPickerOpen(true); return; }
    if (kind === "video") insertVideoReference(0);
    else setPrompt((previous) => `${previous}${previous && !/\s$/.test(previous) ? " " : ""}@${zh ? "图片" : "Image"}1 `);
    promptRef.current?.focus({ preventScroll: true });
  };
  const hint: [string, string?] = useKeys ? [zh ? "上传关键帧，并" : "Upload keyframes and ", zh ? "引用它们来描述镜头。" : " them to guide your shot."] : clipMode ? [zh ? "添加 1–3 段参考视频，并" : "Add 1–3 reference videos and", zh ? "引用它们来描述镜头。" : "them to guide your shot."] : kind === "video"
    ? (showRefSlot ? [zh ? "上传参考图，并" : "Add reference images and", zh ? "它们作为参考，描述你想生成的视频。" : "them to guide the video."] : [zh ? "描述你想生成的画面和动作，例如：雨夜霓虹街头，镜头缓缓推近。" : "Describe the shot and the motion, e.g. a neon street on a rainy night, slow push-in."])
    : (showRefSlot ? [zh ? "描述你想生成的画面，可以" : "Describe the picture; you can", zh ? "已添加的参考图。" : "a reference image you added."] : [zh ? "描述你想生成的画面，比如主体、场景和风格。" : "Describe the picture: the subject, the setting, the style."]);
  const referenceIntro = homepage && showRefSlot && !clipMode && !useKeys ? (zh ? "最多添加12个参考元素。 " : "Add up to 12 reference elements. ") : "";

  const speechLabel = zh ? "文字转语音" : "Text to speech";
  const modeControl = canReference || offerClip || offerKeyframes || speechMode ? <div data-home-popover className="relative">
        <button ref={modeTriggerRef} type="button" className="du-composer-mode" aria-expanded={panel === "mode"} onClick={() => { setModelOpen(false); setPanel(panel === "mode" ? null : "mode"); }}>{speechMode ? speechLabel : useKeys ? keysLabel : clipMode ? clipLabel : modeLabel(!showRefSlot)}<ChevronDown className="h-3 w-3" aria-hidden="true" /></button>
        {modePanel.mounted ? <div data-presence="pop" data-state={modePanel.state} className="du-home-popover du-mode-menu">
          {(canReference ? (needsImage ? [false] : [false, true]) : [true]).map((text) => <button key={String(text)} type="button" aria-pressed={!speechMode && !useKeys && !clipMode && !showRefSlot === text} title={modeHint(text)} onClick={() => { setSpeechMode(false); chooseMode(text); }}>{modeLabel(text)}{!speechMode && !useKeys && !clipMode && !showRefSlot === text && <Check size={14} aria-hidden="true" />}</button>)}
          {offerKeyframes ? <button type="button" aria-pressed={!speechMode && useKeys} onClick={() => { setSpeechMode(false); chooseKeyframes(); }}>{keysLabel}{!speechMode && useKeys && <Check size={14}/>}</button> : null}
          {offerClip ? <button type="button" aria-pressed={!speechMode && clipMode} onClick={() => { setSpeechMode(false); chooseClipMode(); }}>{clipLabel}{!speechMode && clipMode && <Check size={14} aria-hidden="true" />}</button> : null}
          {homepage && kind === "video" ? <button type="button" aria-pressed={speechMode} onClick={() => { setPanel(null); setSpeechMode(true); }}>{speechLabel}{speechMode && <Check size={14} aria-hidden="true" />}</button> : null}
        </div> : null}
      </div> : null;

  return <div id="home-generator" data-function-menu-open={functionMenuOpen || undefined} className="relative z-20 w-full max-w-[1060px] scroll-mt-24" style={homepage ? { "--du-editor-width": editorSize.width + "px", "--du-editor-height": editorSize.height + "px" } as React.CSSProperties : undefined}>
    <HomeMediaPicker lang={lang} homepage={homepage} wanVideoOnly={clipMode} acceptedTypes={clipMode ? ["video"] : ["image"]} mentionAnchor={mentionAnchor} initialTab={mentionAnchor ? "elements" : undefined} open={pickerOpen} onClose={() => { setPickerOpen(false); setMentionAnchor(null); }} onMention={mentionAnchor ? (item) => {
      const index = references.findIndex((asset) => asset.id === item.id);
      if (index < 0 && references.length >= referenceLimit) return;
      if (index < 0) { const updated = [...references, item]; if (kind === "video") setVideoReferences(updated); else setReferenceImages(updated); }
      const number = index < 0 ? references.length + 1 : index + 1;
      setPrompt((value) => value + (value && !/\s$/.test(value) ? " " : "") + "@" + (zh ? "图片" : "Image") + number + " ");
      setNotice(""); setPickerOpen(false); setMentionAnchor(null);
      requestAnimationFrame(() => promptRef.current?.focus({ preventScroll: true }));
    } : undefined} onSelect={(items) => { if (kind === "video") { setVideoReferences(items); setTrimmed(null); } else setReferenceImages(items); if (items.length) { setTextOnly(false); setClearedRefs(null); } setNotice(""); }} onDelete={(id) => { const index = videoReferencesRef.current.findIndex((item) => item.id === id); if (index >= 0) removeVideoReference(index); setReferenceImages((items) => items.filter((item) => item.id !== id)); }} maxSelected={kind === "video" ? videoReferenceLimit : imageRefLimit} selectedIds={(kind === "video" ? videoReferences : referenceImages).map((item) => item.id)} userId={session?.user?.id} />
    {hideKindTabs ? null : <div ref={kindTabsRef} className="du-composer-tabs du-seg" role="tablist" aria-label={zh ? "生成类型" : "Generation type"}>
      <button type="button" role="tab" aria-selected={kind === "video"} onClick={() => { switchKind("video"); setAspect(current?.aspects[0] ?? "16:9"); setResolution(studioModel?.resolutions[0] ?? "720p"); }} className={`du-composer-tab ${kind === "video" ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "视频" : "Video"}</button>
      <button type="button" role="tab" aria-selected={kind === "image"} onClick={() => { switchKind("image"); setAspect("1:1"); setResolution(imageModel?.options.resolutions?.[0] ?? "1K"); }} className={`du-composer-tab ${kind === "image" ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{zh ? "图片" : "Image"}</button>
      <button type="button" role="tab" aria-selected={kind === (homepage ? "agent" : "canvas")} onClick={() => switchKind(homepage ? "agent" : "canvas")} className={`du-composer-tab ${kind === (homepage ? "agent" : "canvas") ? "du-composer-tab-active" : "text-[var(--du-text-muted)] hover:text-[var(--du-text)]"}`}>{homepage ? "Agent" : zh ? "画布" : "Canvas"}</button>
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
    {agentVisited ? <HomeAgentComposer lang={lang} active={kind === "agent"} onResize={setEditorSize} /> : null}
    {homepage && kind === "video" && speechMode ? <HomeSpeech lang={lang} modeControl={modeControl} onResize={setEditorSize} /> : kind === "video" || kind === "image" ?
    <form ref={formRef} onSubmit={submit} className={`du-composer${nudge ? " du-composer-nudge" : ""}`} onAnimationEnd={(event) => { if (event.target === event.currentTarget) setNudge(0); }}>
    {homepage ? <HomeComposerResize zh={zh} onResize={setEditorSize} /> : null}
    <div className="du-composer-prompt-row flex min-h-[84px] items-start gap-3.5">
      {useKeys ? <HomeKeyframes frames={keyframes} lang={lang} duration={duration} userId={owner} onChange={next => {
        setPrompt(value => remapHomeKeyframeMentions(value, keyframes, next));
        setKeyframes(next);
        setNotice("");
        setMentionOpen(false);
      }}/> : showRefSlot ? (
        <div className="du-composer-reference-well"><button
          type="button"
          onClick={() => setPickerOpen(true)}
          title={clipMode ? (zh ? "添加参考视频（最多 3 段，每段 10 MB）" : "Add reference videos (up to 3, 10 MB each)") : homepage ? (zh ? "最多添加12个参考元素" : "Add up to 12 reference elements") : zh ? `添加参考图（这个模型最多 ${referenceLimit} 张）` : `Add reference images (up to ${referenceLimit} for this model)`}
          className="du-composer-ref-slot"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {references.length ? <span className="du-composer-ref-label du-num">{`${references.length}/${referenceLimit}`}</span> : <span className="sr-only du-ref-action-label">{clipMode ? (zh ? "添加参考视频" : "Add reference videos") : zh ? "添加参考图" : "Add reference images"}</span>}
        </button>
      </div>) : null}
      <label htmlFor="home-generator-prompt" className="sr-only">{zh ? "描述创意" : "Describe your idea"}</label>
      <div className="relative min-w-[160px] flex-1">
        <textarea ref={promptRef} id="home-generator-prompt" value={prompt} onChange={(event) => { const next = event.target.value; setPrompt(next); if (replaced !== null) setReplaced(null); if (trimmed !== null) setTrimmed(null); if (clearedRefs !== null) setClearedRefs(null); setMentionOpen(kind === "video" && activeRefs.length > 0 && /@(?:图片|image|视频|video)?\d*$/i.test(next.slice(0, event.target.selectionStart))); if (notice) setNotice(""); }} onKeyDown={(event) => { if (event.key === "Escape") setMentionOpen(false); if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (mentionOpen && videoReferences.length) insertVideoReference(0); else event.currentTarget.form?.requestSubmit(); } }} enterKeyHint="send" rows={3} maxLength={2000} placeholder={hint.length > 1 ? `${referenceIntro}${hint[0]} @ ${hint[1]}` : `${referenceIntro}${hint[0]}`} className="du-composer-input min-h-[80px] w-full resize-none bg-transparent py-1 text-[14px] font-normal leading-relaxed text-[var(--du-text)] outline-none" />
        {!prompt ? <div className="du-composer-placeholder">{referenceIntro}{hint[0]}{hint.length > 1 ? <><button type="button" aria-label={zh ? "引用素材" : "Mention an asset"} className="du-composer-at" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { if (useKeys) { if (keyframeImages.length) setMentionOpen(true); else setNotice(zh ? "先选择首帧、中间帧或尾帧，再引用图片。" : "Choose a keyframe before mentioning it."); } else if (homepage && !clipMode) { setMentionAnchor(event.currentTarget); setPickerOpen(true); } else mentionFirst(); }}><AtSign aria-hidden="true" /></button>{hint[1]}</> : null}</div> : null}
        {kind === "video" && mentionOpen ? <div className="du-composer-mentions">
          {activeRefs.map((item, index) => <button key={item.id + index} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => insertVideoReference(index)}>{clipMode ? <video src={item.url} muted playsInline preload="metadata" /> : <img src={item.url} alt="" />}<span>@{clipMode ? (zh ? "视频" : "Video") : (zh ? "图片" : "Image")}{index + 1}</span></button>)}
        </div> : null}
      </div>
    </div>
    {kind === "video" && videoReferences.length ? <div className="du-composer-references">
      <div className="du-composer-reference-list">{videoReferences.map((item, index) => <div key={item.id} className="du-composer-reference" title={item.name}>
        <button type="button" onClick={() => insertVideoReference(index)} aria-label={clipMode ? (zh ? `引用视频 ${index + 1}` : `Mention video ${index + 1}`) : zh ? `引用图片 ${index + 1}` : `Reference image ${index + 1}`}>{clipMode ? <video src={item.url} muted playsInline preload="metadata" /> : <img src={item.url} alt="" />}<span>@{clipMode ? (zh ? "视频" : "Video") : (zh ? "图片" : "Image")}{index + 1}</span></button>
        <button type="button" onClick={() => removeVideoReference(index)} aria-label={clipMode ? (zh ? `移除视频 ${index + 1}` : `Remove video ${index + 1}`) : zh ? `移除图片 ${index + 1}` : `Remove image ${index + 1}`} className="du-composer-reference-remove"><X className="h-3 w-3" /></button>
      </div>)}</div>
      <p>{zh ? `已添加 ${videoReferences.length}/${videoReferenceLimit} ${clipMode ? "段" : "张"}` : `${videoReferences.length}/${videoReferenceLimit} added`}</p>
    </div> : null}
    {kind === "image" && referenceImages.length ? <div className="du-composer-references">
      <div className="du-composer-reference-list">{referenceImages.map((item, index) => <div key={item.id} className="du-composer-reference" title={item.name}>
        <button type="button" onClick={() => setPrompt((previous) => `${previous}${previous && !/\s$/.test(previous) ? " " : ""}@${zh ? "图片" : "Image"}${index + 1} `)} aria-label={zh ? `在提示词中引用第 ${index + 1} 张图片` : `Reference image ${index + 1} in prompt`}><img src={item.url} alt="" /><span>@{zh ? "图片" : "Image"}{index + 1}</span></button>
        <button type="button" onClick={() => removeReference(index)} aria-label={zh ? `移除第 ${index + 1} 张图片` : `Remove image ${index + 1}`} className="du-composer-reference-remove"><X className="h-3 w-3" /></button>
      </div>)}</div>
      <p>{zh ? `已添加 ${referenceImages.length}/${imageRefLimit} 张` : `${referenceImages.length}/${imageRefLimit} added`}</p>
    </div> : null}
    <div data-expanded={mobileExpanded || undefined} className="du-composer-bar mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
      {modeControl}
      <div className="du-composer-model relative min-w-0"><KieModelPicker kind={kind} locale={lang} value={kind === "video" ? modelId : imageModelId} onChange={kind === "video" ? selectModel : selectImageModel} connectedIds={useKeys ? [KLING_KEYFRAME_MODEL] : kind === "video" ? models.map((item) => item.id) : IMAGE_MODEL_IDS} placement="bottom" open={modelOpen} onOpenChange={(open) => { setModelOpen(open); if (open) { setPanel(null); setMentionOpen(false); } }} showConnectionStatus={false} catalogSet="current" compact /></div>
      {clipMode ? <>{divider}<span className="du-wan-sound"><Music2 size={16} aria-hidden="true" />{zh ? "有声" : "With sound"}</span></> : null}
      {kind === "video" && !clipMode && !useKeys && studioModel && !studioModel.audio ? <>{divider}<button type="button" className={plainControl} disabled title={zh ? "这个模型生成的视频没有声音，换成支持声音的模型（如 Seedance 2.5）即可开启" : "This model makes silent videos; pick one with sound (e.g. Seedance 2.5) to turn it on"} aria-label={zh ? "声音：这个模型不支持" : "Sound: not available for this model"}><span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true"><Music2 className="h-4 w-4" /><svg className="absolute inset-0 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3 21 21" /></svg></span>{zh ? "无声" : "Silent"}</button></> : null}
      {kind === "video" && !useKeys && studioModel?.audio ? <>{divider}<button type="button" className={plainControl} onClick={() => { soundChoice.current = !sound; setSound(!sound); }} aria-pressed={sound} aria-label={zh ? (sound ? "声音：开启" : "声音：关闭") : (sound ? "Sound: on" : "Sound: off")}><span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center" aria-hidden="true"><Music2 className="h-4 w-4" />{!sound ? <svg data-swap className="absolute inset-0 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3 21 21" /></svg> : null}</span>{sound ? (zh ? "开启" : "On") : (zh ? "关闭" : "Off")}</button></> : null}
      {divider}<div data-home-popover className="relative"><button ref={settingsTriggerRef} type="button" className={`${plainControl} du-composer-settings`} onClick={() => { setModelOpen(false); setPanel(panel === "settings" ? null : "settings"); }} aria-expanded={panel === "settings"} aria-label={zh ? "生成设置" : "Generation settings"}>{homepage && <span className="du-composer-mobile-aspect du-num">{clipMode || useKeys ? duration + "s" : aspect}</span>}<span className="du-num du-composer-settings-summary">{(kind === "video" ? (clipMode || useKeys ? [`${duration}s`, resolutionLabel(resolution)] : [aspect, `${duration}s`, resolutionLabel(resolution)]) : [aspect, ...(imageResolutions.length ? [resolutionLabel(resolution)] : []), ...(maxImageCount > 1 ? [String(imageCount)] : [])]).join(" / ")}</span><span aria-hidden="true" className="du-composer-divider" /><Settings2 className="h-4 w-4 shrink-0" aria-hidden="true" /></button>{settingsPanel.mounted ? <div data-presence="pop" data-state={settingsPanel.state} className="du-home-popover du-home-settings">
        {useKeys ? <p className="du-set-label">{zh ? "画幅跟随第一张关键帧" : "Aspect ratio follows the first keyframe"}</p> : null}
        {!useKeys && !clipMode && (kind === "video" ? videoAspects : imageAspects).length ? <section>
          <p className="du-set-label">{zh ? "画面比例" : "Aspect ratio"}</p>
          <div className="du-set-track du-set-aspects">{(kind === "video" ? videoAspects : imageAspects).map((item) => <button key={item} type="button" aria-pressed={aspect === item} onClick={() => setAspect(item)}><AspectShape value={item} /><span>{item === "auto" ? (zh ? "自动" : "Auto") : item}</span></button>)}</div>
        </section> : null}
        {kind === "video" && videoDurations.length ? <section>
          <p className="du-set-label">{zh ? "视频时长" : "Video length"}</p>
          {videoDurations.length > 1 ? <div className="du-set-slider">
            <input type="range" min={0} max={videoDurations.length - 1} step={1} value={Math.max(0, videoDurations.indexOf(duration))} onChange={(event) => {
              const next = videoDurations[Number(event.target.value)] ?? videoDurations[0];
              if (useKeys && keyframeImages.length > maxKlingFrames(next)) { setNotice(zh ? "请先减少关键帧，再缩短时长。" : "Remove keyframes before shortening this clip."); return; }
              setDuration(next); setNotice("");
            }} aria-label={zh ? "视频时长" : "Video length"} aria-valuetext={`${duration}s`} style={{ "--fill": `${(Math.max(0, videoDurations.indexOf(duration)) / Math.max(1, videoDurations.length - 1)) * 100}%` } as React.CSSProperties} />
            <span className="du-num">{duration}s</span>
          </div> : <p className="du-set-fixed du-num">{videoDurations[0]}s</p>}
        </section> : null}
        {(kind === "video" ? videoResolutions : imageResolutions).length ? <section>
          <p className="du-set-label">{zh ? "分辨率" : "Resolution"}</p>
          <div className="du-set-track">{(kind === "video" ? videoResolutions : imageResolutions).map((item) => <button key={item} type="button" aria-pressed={resolution === item} onClick={() => setResolution(item)}>{resolutionLabel(item)}</button>)}</div>
        </section> : null}
        {kind === "image" && maxImageCount > 1 ? <section aria-label={zh ? "输出张数" : "Output number"}>
          <p className="du-set-label">{zh ? "输出张数" : "Output number"}</p>
          <div className="du-set-track du-set-count">{Array.from({ length: maxImageCount }, (_, index) => index + 1).map((count) => <button type="button" aria-pressed={imageCount === count} key={count} onClick={() => setImageCount(count)}>{count}</button>)}</div>
        </section> : null}
      </div> : null}</div>
      {homepage ? <button type="button" className="du-composer-expand" aria-label={zh ? "更多生成选项" : "More generation options"} aria-expanded={mobileExpanded} onClick={() => { setMobileExpanded(!mobileExpanded); setPanel(null); }}><ChevronDown size={14} aria-hidden="true" /></button> : null}
      <div className="ml-auto flex items-center gap-2">
        {kind === "video" && estimatedCredits !== null ? <span className="du-composer-cost" title={zh ? `本次消耗 ${estimatedCredits} 积分` : `This generation uses ${estimatedCredits} credits`}><Coins className="h-3 w-3" aria-hidden="true" /><span className="du-num">{estimatedCredits}</span><span className="sr-only">{zh ? " 积分" : " credits"}</span></span> : null}
        {kind === "image" && imageCredits ? <span className="du-composer-cost" title={zh ? `本次 ${imageCount} 张，共 ${imageCredits} 积分` : `${imageCredits} credits for ${imageCount} image${imageCount === 1 ? "" : "s"}`}><Coins className="h-3 w-3" aria-hidden="true" /><span className="du-num">{imageCredits}</span><span className="sr-only">{zh ? ` 积分，共 ${imageCount} 张` : ` credits for ${imageCount} image${imageCount === 1 ? "" : "s"}`}</span></span> : null}
        <button type="submit" disabled={submitting || (kind === "video" && !available) || (kind === "image" && !imageAvailable)} aria-label={submitting ? (zh ? "正在提交…" : "Starting…") : kind === "video" ? (zh ? "生成视频" : "Generate video") : (zh ? "生成图片" : "Generate image")} title={submitting ? (zh ? "正在提交…" : "Starting…") : kind === "video" ? (zh ? "生成视频（Enter）" : "Generate video (Enter)") : (zh ? "生成图片（Enter）" : "Generate image (Enter)")} aria-busy={submitting || undefined} data-ready={hasInput || undefined} className={`du-composer-send${submitting ? " du-composer-send-busy" : ""}`}>{submitting ? <Loader2 key="busy" data-swap className="du-composer-spinner" aria-hidden="true" /> : <ArrowUp key="go" data-swap className="h-4 w-4" aria-hidden="true" />}</button>
      </div>
    </div>
    {notice ? <output key={notice} data-presence="fade" aria-live="polite" className="mt-2 block text-xs text-[var(--du-accent-text)]">{notice}</output> : null}
    {replaced !== null && !notice ? <output data-presence="fade" className="mt-2 flex items-center gap-2 text-xs text-[var(--du-text-muted)]">{zh ? "已换成这条灵感" : "Replaced with this idea"}<button type="button" className="text-[var(--du-accent-text)] hover:underline" onClick={() => { setPrompt(replaced.prompt); setAspect(replaced.aspect); setReplaced(null); promptRef.current?.focus({ preventScroll: true }); }}>{zh ? "恢复原内容" : "Undo"}</button></output> : null}
    {clearedRefs !== null && clearedRefs.kind === kind ? <output data-presence="fade" className="mt-2 flex items-center gap-2 text-xs text-[var(--du-text-muted)]">{zh ? `已移除 ${clearedRefs.references.length} 张参考图` : `Removed ${clearedRefs.references.length} reference image${clearedRefs.references.length > 1 ? "s" : ""}`}<button type="button" className="text-[var(--du-accent-text)] hover:underline" onClick={() => { const back = clearedRefs; setClearedRefs(null); setTextOnly(false); if (back.kind === "video") setVideoReferences(back.references); else setReferenceImages(back.references); setPrompt(back.prompt); }}>{zh ? "撤销" : "Undo"}</button></output> : null}
    {trimmed !== null ? <output data-presence="fade" className="mt-2 flex items-center gap-2 text-xs text-[var(--du-text-muted)]">{zh ? `这个模型最多支持 ${videoReferenceLimit} 张参考图，已自动保留前 ${videoReferenceLimit} 张` : `This model supports up to ${videoReferenceLimit} reference image${videoReferenceLimit > 1 ? "s" : ""}. Kept the first ${videoReferenceLimit}.`}<button type="button" className="text-[var(--du-accent-text)] hover:underline" onClick={() => { const back = trimmed; setTrimmed(null); setVideoReferences(back.references); setPrompt(back.prompt); selectModel(back.modelId); }}>{zh ? "换回原模型" : "Switch back"}</button></output> : null}
    {kind === "video" && showSuggestions && !suggestionsHidden && !functionMenuOpen ? <div className="du-composer-suggestions">
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
    {kind === "video" && showSuggestions && suggestionsHidden && !functionMenuOpen ? <div className="du-composer-suggestions"><button type="button" onClick={() => setSuggestionsHidden(false)} className="du-composer-suggestions-label">{zh ? "快捷灵感" : "Quick ideas"}</button></div> : null}
    </form> : null}
    {kind === "image" && showImageIdeas && !imageIdeasHidden && !functionMenuOpen ? <div className="du-image-ideas" data-presence="fade">
      <div className="du-image-ideas-head">
        <span>{zh ? "试试这些提示" : "Try these prompts"}</span>
        <button type="button" onClick={() => setImageIdeaOffset((value) => (value + 3) % HOME_IMAGE_IDEAS.length)} aria-label={zh ? "换一批" : "Show others"} title={zh ? "换一批" : "Show others"}><RefreshCw aria-hidden="true" /></button>
        <button type="button" className="ml-auto" onClick={() => { setImageIdeasHidden(true); try { localStorage.setItem("aivd:home-image-ideas-hidden", "1"); } catch { /* storage blocked: hidden for this visit */ } }}>{zh ? "不再显示" : "Don't show again"}</button>
      </div>
      {[0, 1, 2].map((step) => HOME_IMAGE_IDEAS[(imageIdeaOffset + step) % HOME_IMAGE_IDEAS.length]).map((idea) => (
        <button key={idea.id} type="button" className="du-image-idea" onClick={() => { replacePrompt(zh ? idea.prompt.zh : idea.prompt.en); setNotice(""); promptRef.current?.focus({ preventScroll: true }); }}>
          <img src={idea.image} alt="" loading="lazy" />
          <span>{zh ? idea.prompt.zh : idea.prompt.en}</span>
        </button>
      ))}
    </div> : null}
  </div>;
}
