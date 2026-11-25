"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronRight, Clock, Gem, Paintbrush, Minus, Plus, Scan, Sparkles, X } from "lucide-react";
import { KieModelPicker } from "@/components/hf/kie-model-picker";
import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { useCreditReturnDraft } from "@/hooks/use-credit-return-draft";
import { imageOutputCount } from "@/lib/image-output-count";
import { currentUploadUrls } from "@/lib/home-media-library";
import { readyPickerImage, type PickerAsset } from "@/lib/home-media-library";
import { HomeMediaPicker } from "@/components/hf/home-media-picker";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSession } from "@/lib/auth/client";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { uploadErrorText, uploadImage, validateImageFile } from "@/lib/image-to-video";
import { submitMedia, useMediaJobs } from "@/lib/media-studio";
import { prepareVideoReferencePrompt, removeVideoReferenceToken } from "@/lib/video-references";
import { ImageShowcase } from "@/components/hf/image-showcase";
import { MediaViewer, sendImageToVideo, useImageDrop, type ViewerItem } from "@/components/hf/studio-results";
import { BarSelect, RatioIcon, Tip } from "@/components/hf/image-studio/bar-menu";
import { MentionMenu, mentionToken } from "@/components/hf/image-studio/mention-menu";
import { ResultsGrid } from "@/components/hf/image-studio/results-grid";
import { FilterMenu, INITIAL_FILTER, matchingHistory } from "./video-studio/history-filter";
import { DrawDialog } from "./image-studio/draw-dialog";
import { ImageMobileNavigation } from "./image-studio/mobile-navigation";
import { StudioHero } from "@/components/hf/image-studio/studio-hero";
import { ViewMenu, useImageView } from "@/components/hf/image-studio/view-menu";
import { localizedHref } from "@/lib/du-home";
import { scrollMotion } from "@/lib/reduced-motion";
import "./ai-image-studio.css";

const IMAGE_MODELS = marketModelsOf("image");
const IMAGE_MODEL_IDS = IMAGE_MODELS.map((model) => model.id);
const DEFAULT_IMAGE_MODEL = IMAGE_MODELS.find(model => model.id === "nano-banana-pro") ?? IMAGE_MODELS[0];
/** "@", "@图片" or "@图片2" right before the caret: the mention list opens. */
const MENTION_AT_CARET = /@(?:图片|image)?\d*$/i;
/** The ratio menu lists shapes in the reference's order: square, then each
 * landscape shape followed by its portrait twin, widest last. Ratios a model
 * adds beyond these keep their own order at the end. */
const RATIO_ORDER = ["auto", "1:1", "3:2", "2:3", "16:9", "9:16", "4:3", "3:4", "21:9"];
const byRatioOrder = (list: string[]) =>
  [...list].sort((a, b) => {
    const at = (value: string) => (RATIO_ORDER.includes(value) ? RATIO_ORDER.indexOf(value) : RATIO_ORDER.length + list.indexOf(value));
    return at(a) - at(b);
  });

export function AiImageStudio(props: Parameters<typeof AiImageStudioForm>[0]) {
  const { data: session, isPending } = useSession();
  return <AiImageStudioForm key={session?.user?.id ?? (isPending ? "loading" : "guest")} {...props} />;
}

function AiImageStudioForm({
  locale,
  initialPrompt = "",
  initialModel = "",
  initialAspect = "",
  initialResolution = "",
  initialCount = 1,
}: {
  locale: string;
  initialPrompt?: string;
  initialModel?: string;
  initialCount?: number | string;
  initialAspect?: string;
  /** Resolution chosen on the homepage, used when this model offers it. */
  initialResolution?: string;
}) {
  const zh = locale.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  const { data: session, isPending: sessionLoading } = useSession();
  const draftScope = session?.user?.id ? `image:${session.user.id}` : sessionLoading ? "image:loading" : "image";
  const internalFree = process.env.NEXT_PUBLIC_IS_PREVIEW === "true" &&
    session?.user?.isAdmin === true && session.user.isSuperAccount === true;
  const [modelId, setModelId] = useState(getMarketModel(initialModel)?.kind === "image" ? initialModel : DEFAULT_IMAGE_MODEL.id);
  const model = getMarketModel(modelId) ?? IMAGE_MODELS[0];
  const options = model.options;
  const [mobileComposer, setMobileComposer] = useState(Boolean(initialPrompt || initialModel || initialAspect || initialResolution));
  const [drawOpen, setDrawOpen] = useState(false);
  const [showGuide, setShowGuide] = useState(true);
  useEffect(() => {
    try { setShowGuide(localStorage.getItem("aivd:image-studio-guide-dismissed") !== "1"); } catch { /* Storage is optional. */ }
  }, []);
  const [prompt, setPrompt] = useState(initialPrompt);
  const draft = usePromptDraft(draftScope, prompt, setPrompt, Boolean(initialPrompt));
  const [aspect, setAspect] = useState(options.aspects?.includes(initialAspect) ? initialAspect : (model.id === DEFAULT_IMAGE_MODEL.id && options.aspects?.includes("3:4") ? "3:4" : options.aspects?.[0] ?? "1:1"));
  const [resolution, setResolution] = useState(options.resolutions?.includes(initialResolution) ? initialResolution : (options.resolutions?.[0] ?? ""));
  const [count, setCount] = useState(() => imageOutputCount(initialCount, options.maxCount));
  const [view, setView] = useImageView();
  const [historyFilter, setHistoryFilter] = useState(INITIAL_FILTER);
  const [refs, setRefs] = useState<{ key: string; name: string; preview: string; sourceId?: string }[]>([]);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  // Which shelf of the library opens: "@" can open it on the saved elements.
  const [pickerTab, setPickerTab] = useState<"upload" | "elements">("upload");
  const openPicker = (tab: "upload" | "elements") => {
    setPickerTab(tab);
    setMediaPickerOpen(true);
  };
  const [mentionOpen, setMentionOpen] = useState(false);
  useEffect(() => {
    if (sessionLoading) return;
    const handoff = sessionStorage.getItem("aivd:home-image-references");
    const owner = sessionStorage.getItem("aivd:home-image-reference-owner");
    sessionStorage.removeItem("aivd:home-image-reference-owner");
    if (!handoff) return;
    sessionStorage.removeItem("aivd:home-image-references");
    if (owner && owner !== session?.user?.id) return;
    try {
      const rows: unknown = JSON.parse(handoff);
      if (Array.isArray(rows)) setRefs(rows.filter((row): row is { key: string; name: string; url: string } =>
        typeof row?.key === "string" && typeof row?.name === "string" && typeof row?.url === "string" &&
        (!row.key.startsWith("uploads/") || row.key.startsWith(`uploads/${session?.user?.id}/`))
      ).map((row) => ({ key: row.key, name: row.name, preview: row.url })).slice(0, maxImages));
    } catch { /* Ignore a stale handoff. */ }
  }, [sessionLoading, session?.user?.id]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const creditsShortfall = useCreditsShortfall(zh);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const { jobs, add } = useMediaJobs("image", Boolean(session));
  const [viewing, setViewing] = useState<number | null>(null);
  // The card that opened the viewer gets focus back when it closes.
  const viewerOpener = useRef<HTMLElement | null>(null);
  const openViewer = (index: number) => {
    viewerOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setViewing(index);
  };
  const closeViewer = useCallback(() => {
    setViewing(null);
    const opener = viewerOpener.current;
    viewerOpener.current = null;
    requestAnimationFrame(() => {
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    });
  }, []);
  const openInCanvas = (url: string, text: string, modelName?: string, uuid?: string, index?: number) => {
    try {
      sessionStorage.setItem("aivd:canvas-handoff", JSON.stringify({ url, prompt: text, model: modelName, kind: "image", uuid, index, ownerId: session?.user?.id }));
    } catch { /* ignore */ }
    window.location.href = localizedHref(locale, "/creative-space/canvas");
  };
  useCreditReturnDraft(draftScope, () => ({ modelId, prompt, aspect, resolution, count, refs }), (saved) => {
    if (getMarketModel(saved.modelId)?.kind === "image") setModelId(saved.modelId);
    setPrompt(saved.prompt ?? "");
    setAspect(saved.aspect ?? "1:1");
    setResolution(saved.resolution ?? "");
    setCount(imageOutputCount(saved.count ?? 1, getMarketModel(saved.modelId)?.options.maxCount));
    setRefs(Array.isArray(saved.refs) ? saved.refs : []);
    void currentUploadUrls().then((urls) => setRefs((items) => items.map((item) => ({ ...item, preview: urls.get(item.key) ?? item.preview }))));
  });

  const modelName = (id?: string) => (id ? (getMarketModel(id)?.name ?? id) : "");
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
              model: getMarketModel(job.model ?? "")?.name ?? job.model,
            }))
          : [],
      ),
    [jobs],
  );

  const reuse = (text: string) => {
    setMobileComposer(true);
    setPrompt(text);
    setNotice(null);
    promptRef.current?.focus();
    promptRef.current?.scrollIntoView({ block: "center", behavior: scrollMotion() });
  };
  const toVideo = (url: string) => sendImageToVideo(url, localizedHref(locale, "/ai/video"), zh ? "生成的图片" : "Generated image", session?.user?.id);

  const maxCount = options.maxCount ?? 1;
  const maxImages = options.maxImages ?? 0;
  const creditsFor = (overrides: { resolution?: string }) =>
    marketCredits(model, {
      prompt,
      aspectRatio: aspect,
      resolution: (overrides.resolution ?? resolution) || undefined,
      count,
      imageUrls: refs.map((item) => item.key),
    });
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
      const error = validateImageFile(file, zh ? "zh" : "en");
      if (error) {
        setNotice(error);
        continue;
      }
      setUploading(true);
      const result = await uploadImage(file, fetch, session?.user?.id);
      setUploading(false);
      if (result.ok) {
        setRefs((current) => [...current, { key: result.key, name: file.name, preview: result.url, sourceId: `upload:${result.key}` }]);
      } else {
        setNotice(uploadErrorText(result, zh));
      }
    }
  };

  const selectMedia = async (items: PickerAsset[]) => {
    setUploading(true);
    setNotice(null);
    try {
      const selected = await Promise.all(items.map(item => readyPickerImage(item, session?.user?.id)));
      setRefs([...new Map(selected.map(item => [item.key, item])).values()].map((item) => ({ key: item.key, name: item.name, preview: item.url, sourceId: item.sourceId })));
    } catch (error) { setNotice(uploadErrorText(error, zh)); }
    finally { setUploading(false); }
  };

  // Removing a reference also drops its @mention and renumbers the later ones.
  const removeRef = (index: number) => {
    setRefs((current) => current.filter((_, at) => at !== index));
    setPrompt((current) => removeVideoReferenceToken(current, index + 1));
  };

  const insertMention = (index: number) => {
    const field = promptRef.current;
    const start = field?.selectionStart ?? prompt.length;
    const end = field?.selectionEnd ?? start;
    const before = prompt.slice(0, start);
    const typed = before.match(MENTION_AT_CARET);
    const from = typed ? start - typed[0].length : start;
    const head = prompt.slice(0, from);
    const insertion = `${head && !/\s$/.test(head) ? " " : ""}${mentionToken(index, zh)} `;
    const next = `${head}${insertion}${prompt.slice(end)}`;
    // Never cut the visitor's text to make room for a mention.
    if (next.length > 5000) {
      setNotice(zh ? "提示词已到 5000 字上限，先删掉一些再引用图片。" : "The prompt is at its 5,000-character limit. Shorten it before adding a reference.");
      return;
    }
    setPrompt(next);
    setMentionOpen(false);
    setNotice(null);
    requestAnimationFrame(() => {
      field?.focus({ preventScroll: true });
      field?.setSelectionRange(from + insertion.length, from + insertion.length);
    });
  };
  const closeMention = useCallback((open: boolean) => setMentionOpen(open), []);

  const generate = async () => {
    if (submitting || uploading) return;
    // An empty prompt gets a hint and the cursor, not a dead button.
    if (!prompt.trim()) {
      setNotice(zh ? "先写一句提示词，描述你想要的画面。" : "Write a prompt describing the image you want.");
      promptRef.current?.focus();
      return;
    }
    // "@图片2" with only one picture attached would send the model a reference
    // that is not there.
    const prepared = prepareVideoReferencePrompt(prompt.trim(), refs.length);
    if (!prepared.ok) {
      setNotice(zh ? `找不到 @图片${prepared.index} 对应的参考图，请添加图片或删掉这个引用。` : `No reference image for @Image${prepared.index}. Add one or remove it from the prompt.`);
      promptRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setNotice(null);
    const result = await submitMedia(
      {
        model: model.id,
        prompt: prepared.prompt,
        aspectRatio: aspect,
        resolution: resolution || undefined,
        count,
        imageUrls: refs.map((item) => item.key),
      },
      zh,
      undefined,
      session?.user?.id,
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

  const hasResults = jobs.length > 0;
  const shownJobs = matchingHistory(jobs, historyFilter, Date.now(), job => Boolean(job.urls.length));
  const filtered = Boolean(historyFilter.model || historyFilter.range !== "all" || historyFilter.hideFailed);
  const noRefsNote = zh ? "该模型不支持参考图" : "This model takes no reference image";

  return (
    <div className="is-root" data-composer-open={mobileComposer || undefined}>
      <ImageMobileNavigation locale={locale} zh={zh} open={mobileComposer} onToggle={() => setMobileComposer(open => !open)} />
      {drawOpen ? <DrawDialog open onClose={() => setDrawOpen(false)} locale={locale} userId={session?.user?.id} signIn={() => { setDrawOpen(false); signIn.onOpen(); }} /> : null}
      <HomeMediaPicker
        lang={locale}
        open={mediaPickerOpen}
        initialTab={pickerTab}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(items) => void selectMedia(items)}
        onDelete={(id) => setRefs((current) => current.filter((item) => (item.sourceId ?? `upload:${item.key}`) !== id))}
        maxSelected={maxImages}
        selectedIds={refs.map((item) => item.sourceId ?? `upload:${item.key}`)}
        userId={session?.user?.id}
      />
      <div className={hasResults ? "is-first is-first-results" : "is-first"}>
        {/* "View" sits top right whether or not there are results yet, as on
            the reference; the choice is remembered for when they arrive. */}
        <div className="is-topbar">
          {filtered ? <button type="button" className="is-clear-filter" onClick={() => setHistoryFilter(INITIAL_FILTER)}>{zh ? "清除筛选" : "Clear filters"}</button> : null}
          <FilterMenu zh={zh} filter={historyFilter} onChange={setHistoryFilter} models={IMAGE_MODELS} />
          <ViewMenu zh={zh} view={view} onChange={setView} />
        </div>
        {!hasResults && showGuide ? (
          <div className="is-guide">
            <BookOpen aria-hidden="true" />
            <a href={localizedHref(locale, "/help")}>{zh ? "查看创作指南" : "Explore the creation guides"}<ChevronRight aria-hidden="true" /></a>
            <button type="button" aria-label={zh ? "关闭指南提示" : "Dismiss guide"} onClick={() => {
              setShowGuide(false);
              try { localStorage.setItem("aivd:image-studio-guide-dismissed", "1"); } catch { /* Still dismissed for this visit. */ }
            }}><X aria-hidden="true" /></button>
          </div>
        ) : null}
        {hasResults && !shownJobs.length ? <p className="is-filter-empty">{zh ? "没有符合筛选条件的作品。" : "No creations match your filters."}</p> : hasResults ? (
          <ResultsGrid
            jobs={shownJobs}
            view={view}
            zh={zh}
            modelName={modelName}
            onOpen={(key) => openViewer(gallery.findIndex((item) => item.key === key))}
            onReuse={reuse}
            onCanvas={openInCanvas}
            onVideo={toVideo}
          />
        ) : (
          <StudioHero zh={zh} modelName={model.name} />
        )}

        <div className="is-dock" id="image-composer">
          {/* Floats just above the bar, so a message never moves the page. */}
          {notice ? (
            <output className="is-notice" aria-live="polite">
              {notice}
              {creditsShortfall.action(notice)}
            </output>
          ) : null}
          <form
            {...drop.bind}
            className={`is-bar sr-drop ${drop.over ? "sr-drop-on" : ""}`}
            data-drop-label={zh ? "松开即可添加参考图" : "Drop to add reference images"}
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            <div className="is-bar-inner">
              <div className="is-bar-main">
                {refs.length > 0 ? (
                  <div className="is-refs">
                    {refs.map((item, index) => (
                      <span key={item.key} className="is-ref">
                        <button
                          type="button"
                          className="is-ref-mention"
                          title={zh ? `在提示词里引用 ${mentionToken(index, zh)}` : `Mention ${mentionToken(index, zh)} in the prompt`}
                          aria-label={zh ? `在提示词里引用 ${mentionToken(index, zh)}` : `Mention ${mentionToken(index, zh)} in the prompt`}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => insertMention(index)}
                        >
                          <img src={item.preview} alt={item.name} />
                          <span className="is-ref-index">{index + 1}</span>
                        </button>
                        <button type="button" className="is-ref-remove" aria-label={zh ? `移除第 ${index + 1} 张参考图` : `Remove reference ${index + 1}`} onClick={() => removeRef(index)}>
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : null}
                {draft.restored ? (
                  <p className="draft-note">
                    {zh ? "已恢复上次没生成的草稿" : "Your unsent draft is back"}
                    <button type="button" onClick={draft.discard}>
                      {zh ? "清空" : "Clear"}
                    </button>
                  </p>
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
                    const next = event.target.value;
                    setPrompt(next);
                    setNotice(null);
                    setMentionOpen(refs.length > 0 && MENTION_AT_CARET.test(next.slice(0, event.target.selectionStart)));
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Escape" && mentionOpen) {
                      // Close the list but stay in the prompt.
                      event.stopPropagation();
                      setMentionOpen(false);
                    }
                    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) void generate();
                  }}
                  placeholder={zh ? "写下你想看到的画面" : "Describe the image you have in mind"}
                />
                <div className="is-controls">
                  <span className="is-icon-group">
                    <Tip id="is-add-tip" text={maxImages === 0 ? noRefsNote : zh ? `添加参考图（最多 ${maxImages} 张）` : `Add reference images (up to ${maxImages})`}>
                      <button
                        type="button"
                        className="is-icon-btn"
                        disabled={maxImages === 0 || uploading}
                        aria-label={zh ? "添加参考图" : "Add reference images"}
                        aria-describedby="is-add-tip"
                        onClick={() => openPicker("upload")}
                      >
                        {uploading ? <Clock className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </Tip>
                    <span className="is-icon-sep" aria-hidden="true" />
                    <MentionMenu
                      zh={zh}
                      refs={refs}
                      open={mentionOpen}
                      onOpenChange={closeMention}
                      onPick={insertMention}
                      onAdd={() => openPicker("upload")}
                      onElements={() => openPicker("elements")}
                      disabled={maxImages === 0}
                      disabledNote={noRefsNote}
                    />
                  </span>
                  <div className="is-model">
                    <KieModelPicker kind="image" locale={locale} value={modelId} connectedIds={IMAGE_MODEL_IDS} onChange={chooseModel} placement="top" compact />
                    <ChevronRight className="is-model-chevron" aria-hidden="true" />
                  </div>
                  {options.aspects?.length ? (
                    <BarSelect
                      id="is-aspect"
                      title={zh ? "画面比例" : "Aspect ratio"}
                      icon={<Scan className="h-4 w-4" aria-hidden="true" />}
                      value={aspect}
                      options={byRatioOrder(options.aspects).map((option) => ({
                        value: option,
                        label: option === "auto" ? (zh ? "自动" : "Auto") : option,
                        icon: option === "auto" ? <Scan className="h-4 w-4" aria-hidden="true" /> : <RatioIcon ratio={option} />,
                      }))}
                      onChange={setAspect}
                      fixedNote={zh ? "这个模型只有这一种比例" : "This model has one aspect ratio"}
                    />
                  ) : null}
                  {options.resolutions?.length ? (
                    <BarSelect
                      id="is-resolution"
                      title={zh ? "分辨率" : "Resolution"}
                      icon={<Gem className="h-4 w-4" aria-hidden="true" />}
                      value={resolution}
                      wide
                      side="right"
                      options={options.resolutions.map((option) => ({
                        value: option,
                        label: option,
                        sub: zh ? `${internalFree ? 0 : creditsFor({ resolution: option })} 积分` : `${internalFree ? 0 : creditsFor({ resolution: option })} credits`,
                      }))}
                      onChange={setResolution}
                      fixedNote={zh ? "这个模型只有这一档分辨率" : "This model has one resolution"}
                    />
                  ) : null}
                  <Tip id="is-count-tip" text={zh ? `每次生成张数（最多 ${maxCount} 张）` : `Images per run (up to ${maxCount})`}>
                      <fieldset className="is-stepper" aria-label={zh ? "每次生成张数" : "Images per run"} aria-describedby="is-count-tip">
                        <button type="button" aria-label={zh ? "减少一张" : "One fewer"} disabled={count <= 1} onClick={() => setCount((value) => Math.max(1, value - 1))}>
                          <Minus className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <output className="is-stepper-value" aria-live="polite">
                          {count}
                          <span>/{maxCount}</span>
                        </output>
                        <button type="button" aria-label={zh ? "增加一张" : "One more"} disabled={count >= maxCount} onClick={() => setCount((value) => Math.min(maxCount, value + 1))}>
                          <Plus className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </fieldset>
                  </Tip>
                  <button type="button" className="is-chip" onClick={() => setDrawOpen(true)}><Paintbrush aria-hidden="true" />{zh ? "绘制" : "Draw"}</button>
                </div>
              </div>
              <button type="submit" className="is-generate" disabled={submitting || uploading}>
                <span>{submitting ? (zh ? "提交中…" : "Submitting…") : zh ? "生成" : "Generate"}</span>
                <span className="is-generate-cost">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="du-num">{internalFree ? 0 : credits}</span>
                  <span className="sr-only">{zh ? "积分" : "credits"}</span>
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
      {viewing !== null && gallery[viewing] ? (
        <MediaViewer
          items={gallery}
          index={viewing}
          zh={zh}
          onIndex={setViewing}
          onClose={closeViewer}
          onReuse={(item) => reuse(item.prompt)}
          onToVideo={(item) => toVideo(item.url)}
        />
      ) : null}

      {/* Below an empty studio: the shared homepage-style showcase. Once there
          are results the page is a workspace (results under a pinned bar),
          as on the reference, and the showcase steps aside. */}
      {hasResults ? null : (
        <div className="is-below">
          <ImageShowcase lang={locale} />
        </div>
      )}
    </div>
  );
}
