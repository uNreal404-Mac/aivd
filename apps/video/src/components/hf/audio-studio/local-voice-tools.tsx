"use client";

import { useEffect, useRef, useState } from "react";
import { AudioLines, Download, Plus, X } from "lucide-react";
import { renderVoiceEffect, type VoiceEffect } from "@/lib/audio-effects";

export type LocalVoiceTool = "change-voice" | "translate";

export function VoiceChangeForm({ zh }: { zh: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [effect, setEffect] = useState<VoiceEffect>("broadcast");
  const [output, setOutput] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const revision = useRef(0);
  useEffect(() => () => { revision.current++; }, []);
  useEffect(() => () => { if (output) URL.revokeObjectURL(output); }, [output]);
  const selectFile = (next: File | null) => {
    revision.current++;
    setFile(next);
    setOutput("");
    setBusy(false);
    setNotice("");
  };
  const generate = async () => {
    if (!file || busy) return;
    const job = ++revision.current;
    setBusy(true);
    setNotice("");
    try {
      const wav = await renderVoiceEffect(file, effect);
      if (job === revision.current) setOutput(URL.createObjectURL(wav));
    } catch (err) {
      if (job !== revision.current) return;
      const limit = err instanceof Error && err.message === "limit";
      setNotice(limit ? (zh ? "请选择 3 分钟、32 MB 以内的片段。" : "Choose a clip up to 3 minutes and 32 MB.")
        : zh ? "浏览器无法读取这段音轨，请换用 WAV、MP3 或带声音的 MP4。" : "This audio track could not be read. Try WAV, MP3 or MP4 with sound.");
    } finally { if (job === revision.current) setBusy(false); }
  };
  return (
    <form id="audio-local-form" className="au-fields au-local" onSubmit={e => { e.preventDefault(); void generate(); }}>
      <label className="au-card au-effect-choice"><span>{zh ? "本机变声效果" : "On-device voice effect"}</span>
        <select value={effect} disabled={busy} onChange={e => { setEffect(e.target.value as VoiceEffect); setOutput(""); }}>
          <option value="broadcast">{zh ? "电台主持" : "Radio host"}</option><option value="telephone">{zh ? "电话听筒" : "Telephone"}</option><option value="robot">{zh ? "机械声" : "Robot"}</option>
        </select>
      </label>
      <div className="au-clip">
        <button type="button" className="au-clip-upload" onClick={() => input.current?.click()}
          onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (e.dataTransfer.files[0]) selectFile(e.dataTransfer.files[0]); }}>
          {file ? <AudioLines /> : <Plus />}<strong>{file?.name ?? (zh ? "添加你的片段" : "Add your clip")}</strong><small>{zh ? "音频或视频 · 最长 3 分钟 · 最大 32 MB" : "Audio or video · 3 minutes · 32 MB"}</small>
        </button>
        {file ? <button className="au-clip-remove" type="button" aria-label={zh ? "移除片段" : "Remove clip"} onClick={() => selectFile(null)}><X /></button> : null}
        <input type="file" ref={input} accept="audio/*,video/*" hidden onChange={e => { if (e.target.files?.[0]) selectFile(e.target.files[0]); e.target.value = ""; }} />
      </div>
      {output ? <div className="au-card au-local-result"><audio controls src={output} aria-label={zh ? "变声结果" : "Processed audio"} /><a href={output} download={`${file?.name.replace(/\.[^.]+$/, "") || "voice"}-${effect}.wav`}><Download />{zh ? "下载 WAV" : "Download WAV"}</a></div> : null}
      {notice ? <output className="au-notice">{notice}</output> : null}
      <button type="submit" className="au-generate" disabled={!file || busy}>{busy ? zh ? "正在处理…" : "Processing…" : zh ? "本机生成音频" : "Render audio on device"}</button>
    </form>
  );
}

const LANGUAGES = [["en","English"],["zh","中文"],["es","Español"],["fr","Français"],["de","Deutsch"],["ja","日本語"],["ko","한국어"],["pt","Português"],["it","Italiano"]];
type Options = { sourceLanguage: string; targetLanguage: string };
type LocalTranslator = { translate: (value: string) => Promise<string>; destroy: () => void };
type TranslatorFactory = { availability: (o: Options) => Promise<string>; create: (o: Options & { monitor: (m: EventTarget) => void }) => Promise<LocalTranslator> };
const getTranslator = () => (window as Window & { Translator?: TranslatorFactory }).Translator;

export function TranslateForm({ zh, onRead }: { zh: boolean; onRead: (value: string) => void }) {
  const [source, setSource] = useState(zh ? "zh" : "en");
  const [target, setTarget] = useState(zh ? "en" : "es");
  const [sourceText, setSourceText] = useState("");
  const [result, setResult] = useState("");
  const [available, setAvailable] = useState("checking");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const revision = useRef(0);
  useEffect(() => {
    let active = true;
    const factory = getTranslator();
    setAvailable("checking"); setResult(""); setNotice("");
    if (source === target || !factory) setAvailable("unavailable");
    else void factory.availability({ sourceLanguage: source, targetLanguage: target })
      .then(state => { if (active) setAvailable(state); })
      .catch(() => { if (active) setAvailable("unavailable"); });
    return () => { active = false; revision.current++; };
  }, [source, target]);
  const translate = async () => {
    const factory = getTranslator();
    if (!factory || busy || !sourceText.trim()) return;
    const job = ++revision.current;
    setBusy(true); setNotice(""); setResult("");
    let translator: LocalTranslator | undefined;
    try {
      translator = await factory.create({ sourceLanguage: source, targetLanguage: target, monitor: m => {
        m.addEventListener("downloadprogress", e => {
          if (job === revision.current) setNotice(`${zh ? "下载语言包" : "Downloading language pack"} ${Math.round((e as ProgressEvent).loaded * 100)}%`);
        });
      } });
      const text = await translator.translate(sourceText.trim());
      if (job === revision.current) { setResult(text); setNotice(""); }
    } catch { if (job === revision.current) setNotice(zh ? "翻译暂时无法完成，请检查语言包后重试。" : "Translation is unavailable. Check the language pack and try again."); }
    finally { translator?.destroy(); if (job === revision.current) setBusy(false); }
  };
  const options = LANGUAGES.map(([id, label]) => <option key={id} value={id}>{label}</option>);
  return (
    <form className="au-fields au-local" onSubmit={e => { e.preventDefault(); void translate(); }}>
      <label className="au-card au-script">{zh ? "原文脚本" : "Source script"}<textarea value={sourceText} maxLength={5000} disabled={busy} onChange={e => { setSourceText(e.target.value); setResult(""); }} /></label>
      <label className="au-card au-effect-choice">{zh ? "原文语言" : "Source language"}<select value={source} disabled={busy} onChange={e => setSource(e.target.value)}>{options}</select></label>
      <label className="au-card au-effect-choice">{zh ? "目标语言" : "Target language"}<select value={target} disabled={busy} onChange={e => setTarget(e.target.value)}>{options}</select></label>
      {available === "unavailable" ? <p className="au-notice">{source === target ? (zh ? "请选择不同的目标语言。" : "Choose a different target language.") : zh ? "此浏览器无法使用该语言对的本机翻译。支持的桌面版 Chrome 可下载语言包。" : "On-device translation is unavailable for this pair. Supported desktop Chrome can download language packs."}</p> : null}
      {result ? <div className="au-card au-local-result"><output>{result}</output><button type="button" onClick={() => onRead(result)}>{zh ? "用译文配音" : "Voice this translation"}</button></div> : null}
      {notice ? <output className="au-notice">{notice}</output> : null}
      <button type="submit" className="au-generate" disabled={busy || !sourceText.trim() || available === "checking" || available === "unavailable"}>{busy ? zh ? "处理中…" : "Working…" : available === "downloadable" ? zh ? "下载语言包并翻译" : "Download language pack and translate" : zh ? "翻译脚本" : "Translate script"}</button>
    </form>
  );
}
