"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Play, RotateCcw, SlidersHorizontal, Sparkles, Square } from "lucide-react";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { useCreditReturnDraft } from "@/hooks/use-credit-return-draft";
import { usePresence } from "@/hooks/use-presence";
import { useSegmentIndicator } from "@/hooks/use-segment-indicator";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSession } from "@/lib/auth/client";
import { submitMedia, useMediaJobs } from "@/lib/media-studio";
import { prefersReducedMotion } from "@/lib/reduced-motion";
import {
  type AudioShowcaseItem,
  DETAIL_MAX,
  MODE_MODELS,
  MODE_PARAMS,
  MODES,
  type Mode,
  MUSIC_STYLE_CHIPS,
  SFX_QUICK_IDEAS,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_MODELS,
  SPEED_STEP,
  STYLE_MODELS,
  voiceTag,
} from "./audio-studio/audio-data";
import { AudioFillSlider, AudioSwitchRow } from "./audio-studio/audio-controls";
import { AudioModelMenu, AudioVoiceMenu } from "./audio-studio/audio-menus";
import { AudioStage, type HowPick, type StageTab } from "./audio-studio/audio-stage";
import { useAudioPreview } from "./audio-studio/use-audio-preview";
import "./audio-studio/audio-studio.css";

const AUDIO_MODELS = marketModelsOf("audio");

/** An unsent script set aside when the studio opens with another one. */
const EARLIER_AUDIO_DRAFT_KEY = "aivd:draft:audio:earlier";

export function AiAudioStudio({
  locale,
  initialVoiceMode = "",
  initialModelId = "",
  initialPrompt = "",
}: {
  locale: string;
  initialVoiceMode?: string;
  initialModelId?: string;
  /** A script to open with ("Generate again" from My creations). */
  initialPrompt?: string;
}) {
  const zh = locale.toLowerCase().startsWith("zh");
  const signIn = useSigninModal();
  const initialModel = getMarketModel(initialModelId);
  const startMode: Mode =
    initialModel?.kind === "audio"
      ? ((Object.keys(MODE_MODELS) as Mode[]).find((key) => MODE_MODELS[key].includes(initialModel.id)) ?? "tts")
      : (MODE_PARAMS[initialVoiceMode] ?? "tts");
  const [mode, setMode] = useState<Mode>(startMode);
  const [modelId, setModelId] = useState(
    initialModel?.kind === "audio" ? initialModel.id : (MODE_MODELS[startMode][0] ?? AUDIO_MODELS[0].id),
  );
  const model = getMarketModel(modelId) ?? AUDIO_MODELS[0];
  const [voice, setVoice] = useState(model.options.voices?.[0]?.id ?? "");
  const [script, setScript] = useState(initialPrompt);
  // Opening with a script of its own must not lose an unsent draft: it is
  // kept here and offered back.
  const [earlierDraft, setEarlierDraft] = useState<string | null>(null);
  useEffect(() => {
    if (!initialPrompt) return;
    try {
      // Kept under its own key: the draft key soon holds the new script, and
      // a reload must still offer the earlier one back.
      const saved = localStorage.getItem("aivd:draft:audio");
      let earlier = localStorage.getItem(EARLIER_AUDIO_DRAFT_KEY);
      if (saved?.trim() && saved.trim() !== initialPrompt.trim()) {
        earlier = saved;
        localStorage.setItem(EARLIER_AUDIO_DRAFT_KEY, saved);
      }
      if (earlier?.trim() && earlier.trim() !== initialPrompt.trim()) setEarlierDraft(earlier);
    } catch {
      // Storage can be blocked; nothing to offer back then.
    }
  }, [initialPrompt]);
  const [speed, setSpeed] = useState(1);
  const [instrumental, setInstrumental] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const { data: session, isPending: sessionLoading } = useSession();
  const signedOut = !sessionLoading && !session;
  const internalFree = process.env.NEXT_PUBLIC_IS_PREVIEW === "true" &&
    session?.user?.isAdmin === true && session.user.isSuperAccount === true;
  const draft = usePromptDraft("audio", script, setScript, Boolean(initialPrompt));
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const creditsShortfall = useCreditsShortfall(zh);
  const { jobs, add } = useMediaJobs("audio", Boolean(session));
  const preview = useAudioPreview(zh, setNotice);
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const reuse = (text: string) => {
    setScript(text);
    setNotice(null);
    scriptRef.current?.focus();
  };
  // The reference opens on "How it works" until there is something to show.
  const [tab, setTabState] = useState<StageTab>("how");
  const tabChosen = useRef(false);
  const setTab = (next: StageTab) => {
    tabChosen.current = true;
    setTabState(next);
  };
  useEffect(() => {
    if (jobs.length > 0 && !tabChosen.current) setTabState("history");
  }, [jobs.length]);
  useCreditReturnDraft("audio", () => ({ mode, modelId, voice, script, detail, tab, speed, instrumental, customMode }), (saved) => {
    if (MODES.includes(saved.mode as Mode)) setMode(saved.mode as Mode);
    if (getMarketModel(saved.modelId)?.kind === "audio") setModelId(saved.modelId);
    setVoice(saved.voice ?? "");
    setScript(saved.script ?? "");
    setDetail(saved.detail ?? "");
    if (typeof saved.speed === "number") setSpeed(saved.speed);
    if (typeof saved.instrumental === "boolean") setInstrumental(saved.instrumental);
    if (typeof saved.customMode === "boolean") setCustomMode(saved.customMode);
    if (saved.tab === "history" || saved.tab === "how") setTab(saved.tab);
  });

  const [menu, setMenu] = useState<"model" | "voice" | null>(null);
  const modelRowRef = useRef<HTMLButtonElement>(null);
  const voiceRowRef = useRef<HTMLButtonElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const advanced = usePresence(advancedOpen);
  const advancedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (advancedOpen) advancedRef.current?.scrollIntoView({ block: "nearest", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [advancedOpen]);
  const modesRef = useSegmentIndicator<HTMLDivElement>(mode);

  const modeModels = MODE_MODELS[mode]
    .map((id) => getMarketModel(id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
  const maxScript = model.options.maxPromptLength ?? 5000;
  const supportsSpeed = SPEED_MODELS.includes(model.id);
  const supportsStyle = STYLE_MODELS.includes(model.id);
  const isSunoMusic = model.id === "suno-music";
  const isSunoSounds = model.id === "suno-sounds";
  const voices = model.options.voices ?? [];
  const currentVoice = voices.find((item) => item.id === voice) ?? voices[0];
  const hasAdvanced = supportsSpeed || isSunoMusic;
  const advancedChanged = (supportsSpeed && speed !== 1) || (isSunoMusic && (instrumental || customMode));

  const credits = useMemo(() => marketCredits(model, { prompt: script, voice, style: detail }), [model, script, voice, detail]);

  const chooseModel = (id: string) => {
    const next = getMarketModel(id);
    if (!next) return;
    setModelId(id);
    setVoice((current) => (next.options.voices?.some((item) => item.id === current) ? current : (next.options.voices?.[0]?.id ?? "")));
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    setNotice(null);
    setMenu(null);
    const first = MODE_MODELS[next][0];
    if (first && !MODE_MODELS[next].includes(modelId)) chooseModel(first);
  };

  /** Pick a voice from the how-it-works card, switching to its model if needed. */
  const pickVoice = (forModel: string, voiceId: string) => {
    if (mode !== "tts") setMode("tts");
    if (forModel !== modelId) chooseModel(forModel);
    setVoice(voiceId);
    setNotice(null);
  };

  const applyShowcasePreset = (item: AudioShowcaseItem) => {
    setMode(item.mode);
    chooseModel(item.modelId);
    // Showcase items name their voice; the request needs the voice's id.
    const voiceId = getMarketModel(item.modelId)?.options.voices?.find((option) => option.name === item.voice)?.id;
    if (voiceId) setVoice(voiceId);
    setInstrumental(Boolean(item.instrumental));
    setDetail(item.detail ?? "");
    setScript(zh ? item.scriptZh : item.scriptEn);
    setNotice(null);
    scriptRef.current?.focus();
  };

  const resetAdvanced = () => {
    setSpeed(1);
    setInstrumental(false);
    setCustomMode(false);
  };

  const t = zh
    ? {
        modes: { tts: "文本转语音", music: "音乐与音效" } as Record<Mode, string>,
        optional: "可选",
        script: isSunoMusic ? (customMode ? "歌词" : "歌曲描述") : isSunoSounds ? "音效描述" : "脚本",
        scriptHint: isSunoMusic
          ? customMode
            ? "写下完整歌词，可用 [Verse] / [Chorus] 标出段落"
            : "描述想要的歌曲情绪、主题与乐器，例如：雨夜城市的慢节奏爵士。"
          : isSunoSounds
            ? "描述想要的音效场景，例如：雨夜远雷与敲窗雨声，环境沉浸感强。"
            : "逐字写下声音要朗读的内容。",
        model: "模型",
        voice: "音色",
        voiceAuto: "按文意自动匹配",
        detail: isSunoMusic ? "曲风" : "声音详情",
        detailHint: isSunoMusic ? "例如：爵士、钢琴、慢节奏、温暖" : "例如：语速放慢，带一点笑意，像深夜电台主播",
        advanced: "高级设置",
        advancedFor: `${model.name} 设置`,
        reset: "重置",
        speed: "语速",
        instrumental: "纯音乐",
        instrumentalHint: "只要伴奏，不唱歌词",
        customMode: "自定义歌词",
        customModeHint: "脚本框里的文字按歌词来唱",
        generate: "生成",
        submitting: "提交中…",
        models: mode === "music" ? "音乐与音效模型" : "语音模型",
        voices: "音色",
      }
    : {
        modes: { tts: "Text to speech", music: "Music & SFX" } as Record<Mode, string>,
        optional: "Optional",
        script: isSunoMusic ? (customMode ? "Lyrics" : "Song description") : isSunoSounds ? "Sound description" : "Script",
        scriptHint: isSunoMusic
          ? customMode
            ? "Write your lyrics; mark parts with [Verse] / [Chorus]"
            : "Describe the song's mood, theme and instruments, e.g. slow jazz for a rainy city night."
          : isSunoSounds
            ? "Describe the sound, e.g. heavy rain on a window with distant thunder."
            : "Write exactly what the voice should read.",
        model: "Model",
        voice: "Voice",
        voiceAuto: "Matched to your script",
        detail: isSunoMusic ? "Style" : "Voice details",
        detailHint: isSunoMusic ? "e.g. jazz, piano, slow, warm" : "e.g. slower, a warm smile, late-night radio host",
        advanced: "Advanced settings",
        advancedFor: `${model.name} settings`,
        reset: "Reset",
        speed: "Speed",
        instrumental: "Instrumental",
        instrumentalHint: "Backing track only, no vocals",
        customMode: "Custom lyrics",
        customModeHint: "The script box is sung as lyrics",
        generate: "Generate",
        submitting: "Submitting…",
        models: mode === "music" ? "Music & SFX models" : "Speech models",
        voices: "Voices",
      };

  const advancedSummary = [
    supportsSpeed && speed !== 1 ? `${speed.toFixed(2)}×` : "",
    isSunoMusic && instrumental ? t.instrumental : "",
    isSunoMusic && customMode ? t.customMode : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // First how-it-works card: voices to hear and pick (speech), or styles to
  // apply (music). Every entry does what it shows.
  const pickModel = voices.length > 0 ? model : (getMarketModel("elevenlabs-v3") ?? model);
  const picks: HowPick[] =
    mode === "music"
      ? MUSIC_STYLE_CHIPS.slice(0, 3).map((chip) => ({
          key: chip.value,
          title: zh ? chip.zh : chip.en,
          sub: chip.value,
          on: isSunoMusic && detail === chip.value,
          onPick: () => {
            if (!isSunoMusic) chooseModel("suno-music");
            setDetail(chip.value);
            setNotice(null);
          },
        }))
      : (pickModel.options.voices ?? []).slice(0, 3).map((item) => ({
          key: item.id,
          title: item.name,
          sub: voiceTag(item.name, zh),
          voiceName: item.name,
          on: model.id === pickModel.id && voice === item.id,
          onPick: () => pickVoice(pickModel.id, item.id),
        }));
  const how =
    mode === "music"
      ? {
          title: zh ? "一句话写歌、做音效" : "Songs and sound effects from one line",
          sub: zh ? "可以只要纯音乐，也可以自己写歌词，还能生成场景音效" : "Instrumentals, your own lyrics, or sound effects for a scene",
          card1: zh ? "选一个曲风" : "Pick a style",
          card1Sub: zh ? "点一个曲风，切到 Suno V6 并填好曲风标签" : "Tap a style to switch to Suno V6 with its tags filled in",
          picks,
          card2: zh ? "描述并生成" : "Describe and generate",
          card2Sub: zh ? "写下情绪、乐器或场景，点生成" : "Describe the mood, instruments or scene, then generate",
          demo: zh ? "清晨的海边，轻柔的钢琴和海浪声，安静治愈。" : "A calm morning by the sea, soft piano and waves, quiet and soothing.",
        }
      : {
          title: zh ? "把文字变成自然语音" : "Turn text into natural speech",
          sub: zh ? "选好声音、写下脚本，生成后在历史记录里试听和下载" : "Pick a voice, write your script, then play and download it from History",
          card1: zh ? "挑选模型与音色" : "Pick a model and voice",
          card1Sub: zh ? "每个音色都标了性别和风格，点 ▶ 先听再选" : "Every voice is tagged; press ▶ to hear it first",
          picks,
          card2: zh ? "写下脚本，描述声音，生成" : "Write, describe, generate",
          card2Sub:
            model.id === "gemini-3-8-flash-tts"
              ? zh ? "写下台词，再用一句话说明语气" : "Write the lines, then describe the tone in a sentence"
              : zh ? "写下要朗读的文字，点生成即可" : "Type what to read and press Generate",
          demo: zh
            ? "欢迎收看本期节目。今天我们一起用 AI 为短片配上电影级旁白与背景音乐。"
            : "Welcome back to the show. Today we pair AI visuals with cinema-grade voiceovers and custom soundtracks.",
        };

  const generate = async () => {
    if (submitting) return;
    if (!script.trim()) {
      setNotice(zh ? "请先填写脚本或描述内容。" : "Write your script or description first.");
      scriptRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setNotice(null);
    const result = await submitMedia(
      {
        model: model.id,
        prompt: script.trim(),
        voice: voice || undefined,
        style: supportsStyle && detail.trim() ? detail.trim() : undefined,
        instrumental: isSunoMusic ? instrumental : undefined,
        customMode: isSunoMusic ? customMode : undefined,
        speed: supportsSpeed ? speed : undefined,
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
    add({ uuid: result.uuid, status: "queued", urls: [], prompt: script.trim(), model: model.id, createdAt: Date.now() });
    setTab("history");
  };

  const previewingCurrent = currentVoice !== undefined && preview.previewingVoice === currentVoice.name;

  return (
    <div className="au-root">
      <aside aria-label={t.modes[mode]} className="au-panel">
        <div className="au-scroll">
          <div className="au-modes-bar">
            <div ref={modesRef} role="tablist" aria-label={zh ? "音频类型" : "Audio type"} className="au-modes du-seg">
              {MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={option === mode}
                  onClick={() => chooseMode(option)}
                  className="au-mode"
                >
                  {t.modes[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="au-fields">
            <div className="au-card au-script">
              <label htmlFor="audio-script" className="au-card-label">
                {t.script}
              </label>
              <textarea
                id="audio-script"
                ref={scriptRef}
                value={script}
                maxLength={maxScript}
                placeholder={t.scriptHint}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && script.trim() && !submitting) {
                    event.preventDefault();
                    void generate();
                  }
                }}
                onChange={(event) => {
                  setScript(event.target.value);
                  setNotice(null);
                }}
              />
              {earlierDraft !== null ? (
                <p className="draft-note">
                  {zh ? "已填入作品里的文案" : "Filled in from your creation"}
                  <button
                    type="button"
                    onClick={() => {
                      setScript(earlierDraft);
                      setEarlierDraft(null);
                      try {
                        localStorage.removeItem(EARLIER_AUDIO_DRAFT_KEY);
                      } catch {
                        // Nothing kept to clear.
                      }
                    }}
                  >
                    {zh ? "换回上次没生成的草稿" : "Use your unsent draft instead"}
                  </button>
                </p>
              ) : null}
              {draft.restored ? (
                <p className="draft-note">
                  {zh ? "已恢复上次没生成的草稿" : "Your unsent draft is back"}
                  <button type="button" onClick={draft.discard}>
                    {zh ? "清空" : "Clear"}
                  </button>
                </p>
              ) : null}
              <div className="au-card-foot">
                {isSunoSounds ? (
                  <div className="au-chips" aria-label={zh ? "音效示例" : "Sound ideas"}>
                    {SFX_QUICK_IDEAS.map((item) => (
                      <button key={item.en} type="button" className="au-chip" onClick={() => reuse(zh ? item.promptZh : item.promptEn)}>
                        {zh ? item.zh : item.en}
                      </button>
                    ))}
                  </div>
                ) : null}
                <span className="au-count" data-num="">
                  {script.length}/{maxScript}
                </span>
              </div>
            </div>

            <button
              ref={modelRowRef}
              type="button"
              className="au-row"
              aria-haspopup="dialog"
              aria-expanded={menu === "model"}
              onClick={() => setMenu((open) => (open === "model" ? null : "model"))}
            >
              <span className="au-row-text">
                <span className="au-row-label">{t.model}</span>
                <span className="au-row-value">{model.name}</span>
              </span>
              <ChevronRight className="au-row-chevron" aria-hidden="true" />
            </button>
            <AudioModelMenu
              open={menu === "model"}
              onClose={() => setMenu(null)}
              anchorRef={modelRowRef}
              zh={zh}
              title={t.models}
              models={modeModels}
              value={model.id}
              onChange={(id) => {
                chooseModel(id);
                setNotice(null);
              }}
            />

            {voices.length > 0 && currentVoice ? (
              <div className="au-row-wrap">
                <button
                  ref={voiceRowRef}
                  type="button"
                  className="au-row au-row-voice"
                  aria-haspopup="dialog"
                  aria-expanded={menu === "voice"}
                  onClick={() => setMenu((open) => (open === "voice" ? null : "voice"))}
                >
                  <span className="au-row-avatar" aria-hidden="true">
                    {currentVoice.name.slice(0, 1)}
                  </span>
                  <span className="au-row-text">
                    <span className="au-row-label">{t.voice}</span>
                    <span className="au-row-value">
                      {currentVoice.name}
                      <span className="au-row-tag">{voiceTag(currentVoice.name, zh)}</span>
                    </span>
                  </span>
                  <ChevronRight className="au-row-chevron" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={previewingCurrent ? "au-play au-play-row au-play-on" : "au-play au-play-row"}
                  aria-label={
                    previewingCurrent
                      ? zh ? `停止试听 ${currentVoice.name}` : `Stop ${currentVoice.name}`
                      : zh ? `试听 ${currentVoice.name}` : `Preview ${currentVoice.name}`
                  }
                  onClick={() => preview.auditionVoice(currentVoice.name)}
                >
                  {previewingCurrent ? <Square key="stop" data-swap="" className="h-3 w-3" aria-hidden="true" /> : <Play key="play" data-swap="" className="h-3 w-3" aria-hidden="true" />}
                </button>
                <AudioVoiceMenu
                  open={menu === "voice"}
                  onClose={() => setMenu(null)}
                  anchorRef={voiceRowRef}
                  zh={zh}
                  title={t.voices}
                  voices={voices}
                  value={currentVoice.id}
                  onChange={setVoice}
                  previewing={preview.previewingVoice}
                  onPreview={preview.auditionVoice}
                />
              </div>
            ) : model.id === "suno-speech" ? (
              <div className="au-row au-row-fixed">
                <span className="au-row-text">
                  <span className="au-row-label">{t.voice}</span>
                  <span className="au-row-value">{t.voiceAuto}</span>
                </span>
              </div>
            ) : null}

            {supportsStyle ? (
              <div className="au-card au-detail">
                <span className="au-card-head">
                  <label htmlFor="audio-detail" className="au-card-label">
                    {t.detail}
                  </label>
                  <span className="au-optional">{t.optional}</span>
                </span>
                <textarea
                  id="audio-detail"
                  value={detail}
                  maxLength={DETAIL_MAX}
                  placeholder={t.detailHint}
                  onChange={(event) => setDetail(event.target.value)}
                />
                <div className="au-card-foot">
                  {isSunoMusic ? (
                    <div className="au-chips" aria-label={zh ? "曲风示例" : "Style ideas"}>
                      {MUSIC_STYLE_CHIPS.map((chip) => (
                        <button
                          key={chip.value}
                          type="button"
                          aria-pressed={detail === chip.value}
                          className="au-chip"
                          onClick={() => setDetail(chip.value)}
                        >
                          {zh ? chip.zh : chip.en}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  <span className="au-count au-count-sm" data-num="">
                    {detail.length}/{DETAIL_MAX}
                  </span>
                </div>
              </div>
            ) : null}

            {hasAdvanced ? (
              <button
                type="button"
                className="au-adv-row"
                aria-expanded={advancedOpen}
                aria-controls={advancedOpen ? "audio-advanced" : undefined}
                onClick={() => setAdvancedOpen((open) => !open)}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span className="flex-1 text-left">{t.advanced}</span>
                {advancedSummary ? <span className="au-adv-sum">{advancedSummary}</span> : null}
                <ChevronRight className="au-adv-chevron" aria-hidden="true" />
              </button>
            ) : null}
            {hasAdvanced && advanced.mounted ? (
              <div ref={advancedRef} id="audio-advanced" className="au-adv-card" data-presence="fade" data-state={advanced.state}>
                <div className="au-adv-head">
                  <span>{t.advancedFor}</span>
                  <button type="button" className="au-reset" disabled={!advancedChanged} onClick={resetAdvanced}>
                    <RotateCcw className="h-3 w-3" aria-hidden="true" />
                    {t.reset}
                  </button>
                </div>
                {supportsSpeed ? (
                  <AudioFillSlider
                    label={t.speed}
                    value={speed}
                    min={SPEED_MIN}
                    max={SPEED_MAX}
                    step={SPEED_STEP}
                    format={(value) => `${value.toFixed(2)}×`}
                    onChange={setSpeed}
                  />
                ) : null}
                {isSunoMusic ? (
                  <>
                    <AudioSwitchRow label={t.instrumental} hint={t.instrumentalHint} checked={instrumental} onChange={setInstrumental} />
                    <AudioSwitchRow label={t.customMode} hint={t.customModeHint} checked={customMode} onChange={setCustomMode} />
                  </>
                ) : null}
              </div>
            ) : null}

            {notice ? (
              <output aria-live="polite" className="au-notice">
                {notice}
                {creditsShortfall.action(notice)}
              </output>
            ) : null}
          </div>
        </div>

        <div className="au-foot">
          <button type="button" className="au-generate" disabled={submitting} onClick={() => void generate()}>
            {submitting ? t.submitting : t.generate}
            <span className="au-generate-cost" data-num="">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              {internalFree ? 0 : credits}
            </span>
          </button>
        </div>
      </aside>

      <AudioStage
        zh={zh}
        locale={locale}
        mode={mode}
        tab={tab}
        onTab={setTab}
        jobs={jobs}
        signedOut={signedOut}
        onSignIn={() => signIn.onOpen()}
        onReuse={reuse}
        playingDemoId={preview.playingDemoId}
        onPreviewShowcase={preview.previewShowcase}
        onRecreate={applyShowcasePreset}
        how={how}
        previewingVoice={preview.previewingVoice}
        onPreviewVoice={preview.auditionVoice}
      />
    </div>
  );
}
