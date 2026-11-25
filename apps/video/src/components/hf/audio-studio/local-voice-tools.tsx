"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AudioLines, ChevronRight, Download, Plus, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { ELEVENLABS_VOICES, getMarketModel, marketCredits } from "@/ai/kie-market";
import { renderVoiceEffect, type VoiceEffect } from "@/lib/audio-effects";
import { browserTranslator, decodeClip, MAX_CLIP_BYTES, runLanguageWorker } from "@/lib/audio-language";
import { translationModel, WHISPER, modelWeightsCached } from "@/lib/audio-models";
import {
  LANGUAGE_NAMES,
  submittedVoiceSettings,
  VOICE_LANGUAGES,
  type VoiceLanguage,
  type VoiceSettings,
} from "@/lib/audio-voice-settings";
import type { SubmitBody } from "@/lib/media-studio";
import { ElevenControls } from "./eleven-controls";
import { AudioFillSlider } from "./audio-controls";

export type LocalVoiceTool = "change-voice" | "translate";
const languages = VOICE_LANGUAGES.map((code) => (
  <option key={code} value={code}>
    {LANGUAGE_NAMES[code]}
  </option>
));
const voiceModel = getMarketModel("elevenlabs-v3")!;
const translateModel = getMarketModel("elevenlabs-multilingual-v2")!;

type Props = {
  tool: LocalVoiceTool;
  active: boolean;
  zh: boolean;
  foot: HTMLDivElement | null;
  internalFree: boolean;
  submitting: boolean;
  onGenerate: (body: SubmitBody) => Promise<boolean>;
};

export function AudioClipForm({ tool, active, zh, foot, internalFree, submitting, onGenerate }: Props) {
  const translating = tool === "translate";
  const label = (cn: string, en: string) => (zh ? cn : en);
  const [file, setFile] = useState<File | null>(null);
  const [inputType, setInputType] = useState<"clip" | "script">("clip");
  const [source, setSource] = useState<VoiceLanguage>(zh ? "zh" : "en");
  const [target, setTarget] = useState<VoiceLanguage>(zh ? "en" : "es");
  const [script, setScript] = useState("");
  const [prepared, setPrepared] = useState("");
  const [ready, setReady] = useState(false);
  const [output, setOutput] = useState("");
  const [effect, setEffect] = useState<VoiceEffect>("broadcast");
  const [amount, setAmount] = useState(1);
  const [voice, setVoice] = useState(ELEVENLABS_VOICES[0].id);
  const [localEffect, setLocalEffect] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [native, setNative] = useState("checking");
  const fileInput = useRef<HTMLInputElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const pending = useRef<AbortController | null>(null);
  const [clipUrl, setClipUrl] = useState("");

  useEffect(() => {
    if (!active) {
      pending.current?.abort();
      form.current?.querySelectorAll("audio").forEach((player) => player.pause());
    }
  }, [active]);
  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );
  useEffect(() => {
    if (!file) {
      setClipUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setClipUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(
    () => () => {
      if (output) URL.revokeObjectURL(output);
    },
    [output],
  );
  useEffect(() => {
    let current = true;
    const factory = browserTranslator();
    setNative("checking");
    if (translating && source !== target && factory) {
      void factory
        .availability({ sourceLanguage: source, targetLanguage: target })
        .then((value) => {
          if (current) setNative(value);
        })
        .catch(() => {
          if (current) setNative("unavailable");
        });
    } else setNative("unavailable");
    return () => {
      current = false;
    };
  }, [source, target, translating]);

  const clear = () => {
    setPrepared("");
    setReady(false);
    setOutput("");
    setNotice("");
  };
  const chooseFile = (next: File | null) => {
    if (busy) return;
    if (next && (!next.size || next.size > MAX_CLIP_BYTES)) {
      setNotice(label("请选择非空、32 MB 以内的片段。", "Choose a non-empty clip of up to 32 MB."));
      return;
    }
    clear();
    setFile(next);
  };
  const model = translating ? translateModel : voiceModel;
  const request: SubmitBody = {
    model: model.id,
    prompt: prepared.trim(),
    voice,
    voiceSettings: submittedVoiceSettings(model.id, {
      ...voiceSettings,
      language: translating ? target : source,
    }),
  };
  const quote = internalFree ? 0 : marketCredits(model, request);
  const sameLanguage = translating && source === target;
  const blocked =
    submitting ||
    busy ||
    sameLanguage ||
    (ready
      ? !prepared.trim() || prepared.trim().length > 5000
      : inputType === "script"
        ? !script.trim()
        : !file);
  const changeOnly = !translating && localEffect;
  const useNative = translating && native !== "unavailable" && native !== "checking";
  const audioToEnglish = translating && inputType === "clip" && target === "en";
  const offlineModel = useMemo(() => translationModel(source, target), [source, target]);
  const [cacheState, setCacheState] = useState({ speech: false, translation: "" });
  useEffect(() => {
    if (!active) return;
    let current = true;
    void Promise.all([modelWeightsCached(WHISPER), modelWeightsCached(offlineModel)]).then(
      ([speech, translation]) => {
        if (current) setCacheState({ speech, translation: translation ? offlineModel.revision : "" });
      },
    );
    return () => {
      current = false;
    };
  }, [active, busy, offlineModel]);
  let downloadHint = "";
  if (!ready && !changeOnly && inputType === "clip") {
    downloadHint = cacheState.speech
      ? label(
          "语音模型已缓存，音轨在本机处理。",
          "The speech weights are cached. The clip stays on this device.",
        )
      : label(
          "语音模型未缓存时需下载约 41 MB 及运行组件。音轨在本机处理。",
          "Uncached speech weights require about 41 MB plus the runtime. The clip stays on this device.",
        );
  }
  let translationHint = "";
  if (translating && !ready && !audioToEnglish && !sameLanguage) {
    if (native === "checking") {
      translationHint = label("正在检查可用的本机语言包…", "Checking on-device language packs…");
    } else if (useNative) {
      if (native !== "available")
        translationHint = label(
          "首次使用将下载浏览器语言包。",
          "The browser language pack will download on first use.",
        );
    } else {
      translationHint =
        cacheState.translation === offlineModel.revision
          ? label("翻译模型已缓存。", "The translation weights are cached.")
          : label(
              `翻译模型未缓存时需下载约 ${offlineModel.mb} MB。`,
              `The translation weights require about ${offlineModel.mb} MB if uncached.`,
            );
    }
  }

  const perform = async () => {
    if (blocked || pending.current) return;
    if (translating && !ready && !audioToEnglish && native === "checking") return;
    const job = new AbortController();
    pending.current = job;
    const { signal } = job;
    setBusy(true);
    setNotice("");
    setProgress("");
    const update = (percent: number, name = "") => {
      if (!signal.aborted) setProgress(`${label("载入模型", "Loading model")} ${name} ${percent}%`);
    };
    let translator:
      | Awaited<ReturnType<NonNullable<ReturnType<typeof browserTranslator>>["create"]>>
      | undefined;
    try {
      if (ready) {
        await onGenerate(request);
        return;
      }
      if (changeOnly && file) {
        const result = await renderVoiceEffect(file, effect, amount);
        if (!signal.aborted) setOutput(URL.createObjectURL(result));
        return;
      }
      const factory = useNative && !audioToEnglish ? browserTranslator() : undefined;
      // Chrome needs the click's user activation to start a language-pack download.
      if (factory)
        translator = await factory.create({
          sourceLanguage: source,
          targetLanguage: target,
          signal,
          monitor: (m) =>
            m.addEventListener("downloadprogress", (e) =>
              update(Math.round((e as ProgressEvent).loaded * 100)),
            ),
        });
      let text = script.trim();
      if (inputType === "clip" && file) {
        setProgress(label("正在读取和识别音轨…", "Reading and transcribing the audio…"));
        const pcm = await decodeClip(file);
        signal.throwIfAborted();
        text = await runLanguageWorker(
          { kind: "speech", pcm, source, toEnglish: audioToEnglish },
          signal,
          update,
        );
      }
      if (translating && !audioToEnglish) {
        setProgress(label("正在翻译…", "Translating…"));
        text = translator
          ? await translator.translate(text, { signal })
          : await runLanguageWorker({ kind: "translate", text, source, target }, signal, update);
      }
      signal.throwIfAborted();
      if (!text.trim()) throw new Error("EMPTY_TEXT");
      setPrepared(text.trim());
      setReady(true);
    } catch (error) {
      if (signal.aborted) return;
      const code = error instanceof Error ? error.message : "";
      setNotice(
        code === "CLIP_LIMIT" || code === "limit"
          ? label("请选择 3 分钟、32 MB 以内的音轨。", "Choose a clip up to 3 minutes and 32 MB.")
          : code === "LOCAL_MODEL"
            ? label(
                "本机模型未能完成。请检查网络、浏览器存储与内存后重试。",
                "The on-device model could not finish. Check your network, browser storage and available memory, then retry.",
              )
            : label(
                "本次处理未完成。请检查音轨、语言和下载状态后重试。",
                "Processing could not finish. Check the clip, language and download status, then retry.",
              ),
      );
    } finally {
      translator?.destroy();
      if (pending.current === job) {
        pending.current = null;
        setBusy(false);
        setProgress("");
      }
    }
  };
  let cta = label("识别片段台词", "Transcribe clip");
  if (busy || submitting) cta = label("处理中…", "Working…");
  else if (ready) cta = label("生成配音", "Generate voiceover");
  else if (changeOnly) cta = label("生成本机音频", "Render audio on device");
  else if (translating) {
    cta =
      inputType === "clip"
        ? label("识别并翻译", "Transcribe and translate")
        : label("翻译脚本", "Translate script");
  }
  const id = `audio-form-${tool}`;
  const button = (
    <button
      className="au-generate"
      type="submit"
      form={id}
      disabled={blocked || (translating && !ready && !audioToEnglish && native === "checking")}
    >
      {cta}
      {ready ? (
        <span className="au-generate-cost">
          <Sparkles size={15} />
          {quote}
        </span>
      ) : null}
    </button>
  );
  return (
    <form
      ref={form}
      id={id}
      className="au-fields au-local"
      onSubmit={(e) => {
        e.preventDefault();
        void perform();
      }}
    >
      <fieldset disabled={busy || submitting}>
        {translating ? (
          <div className="au-input-mode" aria-label={label("翻译来源", "Translation source")}>
            {(["clip", "script"] as const).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={type === inputType}
                onClick={() => {
                  if (type !== inputType) {
                    clear();
                    setInputType(type);
                  }
                }}
              >
                {type === "clip" ? label("音视频片段", "Audio or video") : label("文字脚本", "Text script")}
              </button>
            ))}
          </div>
        ) : (
          <label className="au-card au-effect-choice">
            {label("变声方式", "Voice change method")}
            <select
              value={localEffect ? "effect" : "voice"}
              onChange={(e) => {
                clear();
                setLocalEffect(e.target.value === "effect");
              }}
            >
              <option value="voice">{label("用预设音色重新配音", "Revoice with a preset voice")}</option>
              <option value="effect">{label("本机变声效果", "On-device voice effects")}</option>
            </select>
          </label>
        )}
        {!changeOnly ? (
          <label className="au-card au-effect-choice">
            {label("配音音色", "Voice")}
            <select value={voice} onChange={(e) => setVoice(e.target.value)}>
              {ELEVENLABS_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="au-card au-effect-choice">
            {label("本机变声效果", "On-device effect")}
            <select
              value={effect}
              onChange={(e) => {
                setEffect(e.target.value as VoiceEffect);
                setOutput("");
              }}
            >
              <option value="broadcast">{label("电台主持", "Radio host")}</option>
              <option value="telephone">{label("电话听筒", "Telephone")}</option>
              <option value="robot">{label("机械声", "Robot")}</option>
            </select>
          </label>
        )}
        {inputType === "clip" ? (
          <div className="au-clip">
            <button
              type="button"
              className="au-clip-upload"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files[0]) chooseFile(e.dataTransfer.files[0]);
              }}
            >
              {file ? <AudioLines /> : <Plus />}
              <strong>{file?.name ?? label("添加你的片段", "Add your clip")}</strong>
              <small>
                {label("音频或视频 · 最长 3 分钟 · 最大 32 MB", "Audio or video · 3 minutes · 32 MB")}
              </small>
            </button>
            {file ? (
              <button
                type="button"
                className="au-clip-remove"
                aria-label={label("移除片段", "Remove clip")}
                onClick={() => chooseFile(null)}
              >
                <X />
              </button>
            ) : null}
            <input
              type="file"
              accept="audio/*,video/*"
              ref={fileInput}
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) chooseFile(e.target.files[0]);
                e.target.value = "";
              }}
            />
            {clipUrl ? (
              <audio
                controls
                preload="metadata"
                src={clipUrl}
                aria-label={label("原始片段", "Original clip")}
              />
            ) : null}
          </div>
        ) : (
          <label className="au-card au-script">
            {label("原文脚本", "Source script")}
            <textarea
              value={script}
              maxLength={5000}
              onChange={(e) => {
                clear();
                setScript(e.target.value);
              }}
            />
          </label>
        )}
        {!changeOnly ? (
          <label className="au-card au-effect-choice">
            {label("原文语言", "Source language")}
            <select
              value={source}
              onChange={(e) => {
                clear();
                setSource(e.target.value as VoiceLanguage);
              }}
            >
              {languages}
            </select>
          </label>
        ) : null}
        {translating ? (
          <label className="au-card au-effect-choice">
            {label("目标语言", "Target language")}
            <select
              value={target}
              onChange={(e) => {
                clear();
                setTarget(e.target.value as VoiceLanguage);
              }}
            >
              {languages}
            </select>
          </label>
        ) : null}
        {ready ? (
          <label className="au-card au-script">
            {translating
              ? label("译文 · 可编辑", "Translation · editable")
              : label("识别台词 · 可编辑", "Transcript · editable")}
            <textarea value={prepared} onChange={(e) => setPrepared(e.target.value)} />
            <small>{prepared.length} / 5000</small>
          </label>
        ) : null}
        {!changeOnly ? (
          <button
            type="button"
            className="au-manual-script"
            onClick={() => {
              setReady(!ready);
              if (!ready && !prepared && !translating) setPrepared(script);
              setNotice("");
            }}
          >
            {ready
              ? label("返回识别与翻译", "Back to preparation")
              : translating
                ? label("手动填写译文并配音", "Enter a translation manually")
                : label("手动填写台词并配音", "Enter the transcript manually")}
          </button>
        ) : null}
        {output ? (
          <div className="au-card au-local-result">
            <audio controls src={output} aria-label={label("变声结果", "Processed audio")} />
            <a href={output} download={`${file?.name.replace(/\.[^.]+$/, "") || "voice"}-${effect}.wav`}>
              <Download />
              {label("下载 WAV", "Download WAV")}
            </a>
          </div>
        ) : null}
        <button
          className="au-adv-row"
          type="button"
          aria-expanded={advanced}
          onClick={() => setAdvanced((v) => !v)}
        >
          <SlidersHorizontal size={16} />
          <span className="flex-1 text-left">{label("高级设置", "Advanced settings")}</span>
          <ChevronRight className="au-adv-chevron" size={16} />
        </button>
        {advanced ? (
          <div className="au-adv-card">
            {changeOnly ? (
              <AudioFillSlider
                label={label("效果强度", "Effect strength")}
                value={amount}
                min={0}
                max={1}
                step={0.05}
                onChange={(n) => {
                  setAmount(n);
                  setOutput("");
                }}
                format={(n) => `${Math.round(n * 100)}%`}
              />
            ) : (
              <ElevenControls
                model={model.id}
                zh={zh}
                settings={voiceSettings}
                onChange={setVoiceSettings}
                language={false}
              />
            )}
          </div>
        ) : null}
      </fieldset>
      {sameLanguage ? (
        <p className="au-notice">{label("请选择不同的目标语言。", "Choose a different target language.")}</p>
      ) : null}
      {downloadHint || translationHint ? (
        <p className="au-note">
          {[downloadHint, translationHint].filter(Boolean).join(" ")}{" "}
          {downloadHint ? (
            <a href={WHISPER.card} target="_blank" rel="noreferrer">
              Whisper tiny
            </a>
          ) : null}{" "}
          {translationHint && !useNative ? (
            <a href={offlineModel.card} target="_blank" rel="noreferrer">
              {offlineModel.credit}
            </a>
          ) : null}
        </p>
      ) : null}
      {progress || notice ? (
        <output className="au-notice" aria-live="polite">
          {progress || notice}
        </output>
      ) : null}
      {busy && !submitting ? (
        <button type="button" className="au-reset" onClick={() => pending.current?.abort()}>
          {label("取消处理", "Cancel processing")}
        </button>
      ) : null}
      {active && foot ? createPortal(button, foot) : null}
    </form>
  );
}
