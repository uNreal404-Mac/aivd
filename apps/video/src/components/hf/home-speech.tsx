"use client";

import { ArrowUp, AudioLines, Check, Coins, Mic, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { getMarketModel, marketCredits } from "@/ai/kie-market";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useSession } from "@/lib/auth/client";
import { localizedHref } from "@/lib/locale-path";
import { submitMedia } from "@/lib/media-studio";
import { MODE_MODELS, voiceGender, voiceTag } from "./audio-studio/audio-data";
import { useAudioPreview } from "./audio-studio/use-audio-preview";
import { HomeComposerResize } from "./home-composer-resize";
import "./home-speech.css";

const models = MODE_MODELS.tts.map(getMarketModel).filter(model => model?.options.voices?.length);

export function HomeSpeech({ lang, modeControl, onResize }: {
  lang: string; modeControl: ReactNode; onResize: (size: { width: number; height: number }) => void;
}) {
  const zh = lang.startsWith("zh");
  const { data: session, isPending } = useSession();
  const signIn = useSigninModal();
  const shortfall = useCreditsShortfall(zh);
  const owner = session?.user?.id;
  const scope = "aivd:home-speech:" + (owner ?? "guest");
  const [script, setScript] = useState("");
  const [modelId, setModelId] = useState("elevenlabs-v3");
  const [voiceId, setVoiceId] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [library, setLibrary] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("");
  const [pendingVoice, setPendingVoice] = useState("");
  const [modelOpen, setModelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState("");
  const sending = useRef(false);
  const alive = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);
  const preview = useAudioPreview(zh, setNotice);
  const model = getMarketModel(modelId)!;
  const voices = model.options.voices ?? [];
  const voice = voices.find(item => item.id === voiceId);
  const visibleVoices = voices.filter(item =>
    (!recentOnly || recent.includes(item.id)) &&
    (!gender || voiceGender(item.name) === gender) &&
    (item.name + " " + (voiceTag(item.name, zh) ?? "")).toLowerCase().includes(query.trim().toLowerCase()));
  const credits = marketCredits(model, { prompt: script.trim(), voice: voice?.id });
  const internalFree = process.env.NEXT_PUBLIC_IS_PREVIEW === "true" && session?.user?.isAdmin && session.user.isSuperAccount;
  useEffect(() => {
    alive.current = true;
    if (!isPending) {
      try {
        const resume = owner && sessionStorage.getItem("aivd:home-speech:resume") === "guest";
        const raw = (resume ? sessionStorage.getItem("aivd:home-speech:guest") : null) ?? sessionStorage.getItem(scope) ?? "{}";
        const saved = JSON.parse(raw);
        if (resume) {
          sessionStorage.setItem(scope, raw);
          sessionStorage.removeItem("aivd:home-speech:resume");
          sessionStorage.removeItem("aivd:home-speech:guest");
        }
        if (typeof saved.script === "string") setScript(saved.script.slice(0, 5000));
        if (models.some(item => item?.id === saved.modelId)) setModelId(saved.modelId);
        if (typeof saved.voice === "string") setVoiceId(saved.voice);
        if (Array.isArray(saved.recent)) setRecent(saved.recent.filter((id: unknown) => typeof id === "string"));
      } catch { /* Storage can be unavailable. */ }
    }
    return () => { alive.current = false; };
  }, [isPending, owner, scope]);
  // Persist changes on interaction; never replace a previous draft while hydration is pending.
  const save = (changes: { script?: string; modelId?: string; voice?: string; recent?: string[] }) => {
    if (isPending) return;
    try { sessionStorage.setItem(scope, JSON.stringify({ script, modelId, voice: voiceId, recent, ...changes })); } catch { /* Optional draft. */ }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!script.trim()) { input.current?.focus(); return; }
    if (sending.current || isPending || result) return;
    if (!owner) {
      save({});
      try { sessionStorage.setItem("aivd:home-speech:resume", "guest"); } catch { /* Login remains available. */ }
      signIn.onOpen();
      return;
    }
    sending.current = true;
    setBusy(true); setNotice(""); setResult("");
    try {
      const response = await submitMedia({ model: modelId, prompt: script.trim(), voice: voice?.id ?? voices[0]?.id }, zh, undefined, owner);
      if (!alive.current) return;
      if (response.ok) setResult(response.uuid);
      else if (response.needsLogin) signIn.onOpen();
      else {
        setNotice(response.message);
        if (response.code === "INSUFFICIENT_CREDITS") shortfall.report(response.message, response.requiredCredits);
      }
    } finally { sending.current = false; if (alive.current) setBusy(false); }
  };
  const voiceTitle = zh ? "选择音色" : "Select a voice";
  const confirmVoice = () => {
    if (!voices.some(item => item.id === pendingVoice)) return;
    const next = [pendingVoice, ...recent.filter(id => id !== pendingVoice)].slice(0, 25);
    setRecent(next); setVoiceId(pendingVoice); if (pendingVoice !== voiceId) setResult("");
    save({ voice: pendingVoice, recent: next });
    setLibrary(false); preview.stopAll();
  };
  return <>
    <form className="du-composer hs-composer" onSubmit={submit}>
      <HomeComposerResize zh={zh} onResize={onResize} />
      <div className="du-composer-prompt-row flex items-start">
        <Dialog open={library} onOpenChange={open => {
          setLibrary(open);
          if (open) { setPendingVoice(voice?.id ?? voices[0]?.id ?? ""); setRecentOnly(false); setQuery(""); setGender(""); }
          else preview.stopAll();
        }}>
          <DialogTrigger asChild><button type="button" className="hs-voice-card" aria-label={voiceTitle}>
            <span className="du-composer-ref-slot"><Mic size={16} /></span><span>{voice?.name ?? (zh ? "音色" : "Voice")}</span>
          </button></DialogTrigger>
          <DialogContent className="hs-voice-dialog">
            <DialogTitle className="sr-only">{voiceTitle}</DialogTitle>
            <DialogDescription className="sr-only">{zh ? "试听并选择本次朗读的音色" : "Preview and choose a voice for this script."}</DialogDescription>
            <div className="hs-voice-tabs">
              <button type="button" aria-pressed={recentOnly} onClick={() => setRecentOnly(true)}>{zh ? "我的音色" : "My voices"}</button>
              <button type="button" aria-pressed={!recentOnly} onClick={() => setRecentOnly(false)}>{voiceTitle}</button>
            </div>
            <div className="hs-voice-filters">
              <input type="search" aria-label={zh ? "搜索音色" : "Search voices"} placeholder={zh ? "按名称或风格搜索" : "Search by name or style"} value={query} onChange={event => setQuery(event.target.value)} />
              <select aria-label={zh ? "声音类型" : "Voice type"} value={gender} onChange={event => setGender(event.target.value)}>
                <option value="">{zh ? "所有声音" : "All voices"}</option><option value="F">{zh ? "女声" : "Female"}</option><option value="M">{zh ? "男声" : "Male"}</option>
              </select>
            </div>
            <div className="hs-voices">
              {visibleVoices.map(item => <div className="hs-voice-choice" key={item.id} data-selected={pendingVoice === item.id || undefined}>
                <button type="button" aria-pressed={pendingVoice === item.id} onClick={() => setPendingVoice(item.id)}>
                  <AudioLines size={22} aria-hidden="true" /><span><strong>{item.name}</strong><small>{voiceTag(item.name, zh)}</small></span>
                </button>
                <button type="button" aria-label={(zh ? "本机试听 " : "Local preview ") + item.name} aria-pressed={preview.previewingVoice === item.name} onClick={() => preview.auditionVoice(item.name)}>{preview.previewingVoice === item.name ? <Pause size={14} /> : <Play size={14} />}</button>
              </div>)}
              {!visibleVoices.length ? <p>{recentOnly && !query && !gender ? (zh ? "选过的音色会保存在这里。" : "The voices you select will appear here.") : (zh ? "没有匹配的音色。" : "No matching voices.")}</p> : null}
            </div>
            <button className="hs-confirm" type="button" disabled={!visibleVoices.some(item => item.id === pendingVoice)} onClick={confirmVoice}>{zh ? "选择" : "Select"}</button>
          </DialogContent>
        </Dialog>
        <textarea ref={input} value={script} onChange={event => { setScript(event.target.value); save({ script: event.target.value }); setNotice(""); setResult(""); }}
          maxLength={model.options.maxPromptLength} className="hs-script" aria-label={zh ? "配音文稿" : "Voiceover script"} placeholder={zh ? "输入要转换成语音的文字…" : "Type text to convert to speech…"} />
      </div>
      <div className="du-composer-bar flex items-center gap-1">{modeControl}
        <Popover open={modelOpen} onOpenChange={setModelOpen}><PopoverTrigger asChild>
          <button type="button" data-model-trigger aria-label={zh ? "配音模型" : "Speech model"}>{model.name}</button>
        </PopoverTrigger><PopoverContent align="start" className="hs-models">
          <strong>{zh ? "配音模型" : "Speech models"}</strong>
          {models.map(item => item && <button type="button" key={item.id} aria-pressed={item.id === modelId} onClick={() => {
            const next = item.options.voices?.some(v => v.id === voiceId) ? voiceId : "";
            if (modelId !== item.id) setResult("");
            setModelId(item.id); setVoiceId(next); save({ modelId: item.id, voice: next }); setModelOpen(false);
          }}>{item.name}{item.id === modelId ? <Check size={15} /> : null}</button>)}
        </PopoverContent></Popover>
        <div className="ml-auto flex items-center gap-2"><span className="du-composer-cost" aria-label={(internalFree ? 0 : credits) + (zh ? " 积分" : " credits")}><Coins size={13}/>{internalFree ? 0 : credits}</span>
          <button type="submit" disabled={busy || isPending || Boolean(result) || !script.trim()} data-ready={Boolean(script.trim()) || undefined} aria-busy={busy} aria-label={zh ? "生成语音" : "Generate speech"} className="du-composer-send"><ArrowUp size={16}/></button>
        </div>
      </div>
    </form>
    {notice ? <output className="hs-notice">{notice} {shortfall.action(notice)}</output> : null}
    {result ? <output className="hs-notice">{zh ? "配音任务已提交。" : "Your voiceover was submitted."} <a href={localizedHref(lang, "/audio")}>{zh ? "在音频工作室查看" : "View in Audio Studio"}</a></output> : null}
  </>;
}
