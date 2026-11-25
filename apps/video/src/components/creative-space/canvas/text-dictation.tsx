"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string; continuous: boolean; interimResults: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null; onend: (() => void) | null;
};
type RecognitionConstructor = new () => Recognition;
function browserSpeech() {
  const browser = window as Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}

export function TextDictation({ zh, insert }: { zh: boolean; insert: (value: string) => void }) {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");
  const engine = useRef<Recognition | null>(null);
  const latest = useRef(insert);
  latest.current = insert;
  useEffect(() => {
    setSupported(Boolean(browserSpeech()));
    return () => { if (engine.current) { engine.current.onresult = null; engine.current.onend = null; engine.current.onerror = null; engine.current.abort(); } };
  }, []);
  if (!supported) return null;
  const toggle = () => {
    if (engine.current) { engine.current.stop(); return; }
    const make = browserSpeech();
    if (!make) return;
    const session = new make();
    session.lang = zh ? "zh-CN" : "en-US";
    session.continuous = true; session.interimResults = false;
    session.onresult = event => {
      const final = Array.from(event.results).slice(event.resultIndex).filter(r => r.isFinal).map(r => r[0].transcript).join("");
      if (final) latest.current(final);
    };
    session.onerror = () => setError(zh ? "语音输入不可用，请检查麦克风权限。" : "Dictation is unavailable. Check microphone access.");
    session.onend = () => { setActive(false); engine.current = null; };
    engine.current = session;
    try { setError(""); setActive(true); session.start(); }
    catch { engine.current = null; setActive(false); setError(zh ? "无法启动浏览器语音输入。" : "Browser dictation could not start."); }
  };
  return <><button type="button" className="nci-chip" onClick={toggle} aria-pressed={active}>{active ? <Square/> : <Mic/>}
    {active ? zh ? "停止听写" : "Stop dictation" : zh ? "语音输入" : "Dictate"}</button>{error && <output>{error}</output>}</>;
}
