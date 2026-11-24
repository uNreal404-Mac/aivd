"use client";

import { useEffect, useRef, useState } from "react";
import { type AudioShowcaseItem, VOICE_META } from "./audio-data";

/**
 * Local auditions in the audio studio: a voice's character (browser speech)
 * and the showcase samples (browser speech for voices, a short synthesised
 * cue for music and sound effects). Nothing here calls the paid models.
 * Only one thing plays at a time; everything stops on unmount.
 */
export function useAudioPreview(zh: boolean, onUnavailable: (message: string) => void) {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingDemoId, setPlayingDemoId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const demoTimerRef = useRef<number | null>(null);

  const stopDemo = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    if (demoTimerRef.current !== null) {
      window.clearTimeout(demoTimerRef.current);
      demoTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setPlayingDemoId(null);
  };

  const stopAll = () => {
    stopDemo();
    setPreviewingVoice(null);
  };

  // Cancel any Web Speech or Web Audio audition on unmount.
  const stopRef = useRef(stopAll);
  stopRef.current = stopAll;
  useEffect(() => () => stopRef.current(), []);

  const auditionVoice = (voiceName: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      onUnavailable(zh ? "当前浏览器不支持本地试听，请直接选择音色生成。" : "Browser speech preview is unavailable here.");
      return;
    }
    stopDemo();
    window.speechSynthesis.cancel();
    if (previewingVoice === voiceName) {
      setPreviewingVoice(null);
      return;
    }
    const meta = VOICE_META[voiceName] ?? { gender: "F", tagZh: "", tagEn: "", pitch: 1, rate: 1 };
    const sample = zh
      ? `你好，我是 ${voiceName}，适合${meta.tagZh || "自然语音配音"}。`
      : `Hi, I am ${voiceName}. This is a quick character preview of my speaking pace and tone.`;
    const utter = new SpeechSynthesisUtterance(sample);
    utter.lang = zh ? "zh-CN" : "en-US";
    utter.pitch = meta.pitch;
    utter.rate = meta.rate;
    const langVoices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(zh ? "zh" : "en"));
    if (langVoices.length > 0) {
      const idx = Math.abs(voiceName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % langVoices.length;
      utter.voice = langVoices[idx];
    }
    utter.onend = () => setPreviewingVoice((current) => (current === voiceName ? null : current));
    utter.onerror = () => setPreviewingVoice((current) => (current === voiceName ? null : current));
    setPreviewingVoice(voiceName);
    window.speechSynthesis.speak(utter);
  };

  const previewShowcase = (item: AudioShowcaseItem) => {
    if (playingDemoId === item.id) {
      stopDemo();
      return;
    }
    stopDemo();
    setPreviewingVoice(null);

    if (item.synthKind === "speech") {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const meta = (item.voice ? VOICE_META[item.voice] : undefined) ?? { pitch: 1, rate: 1 };
      const utter = new SpeechSynthesisUtterance(zh ? item.scriptZh : item.scriptEn);
      utter.lang = zh ? "zh-CN" : "en-US";
      utter.pitch = meta.pitch;
      utter.rate = meta.rate;
      utter.onend = () => setPlayingDemoId(null);
      utter.onerror = () => setPlayingDemoId(null);
      setPlayingDemoId(item.id);
      window.speechSynthesis.speak(utter);
      return;
    }

    // A short synthesised cue for the music and sound-effect samples (no
    // external audio files to break).
    if (typeof window === "undefined") return;
    const AudioCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const ctx = new AudioCtor();
    audioCtxRef.current = ctx;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.001, now);
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.12);
    master.gain.exponentialRampToValueAtTime(0.001, now + 2.8);
    master.connect(ctx.destination);

    if (item.synthKind === "ambient") {
      // A warm minor-ninth chord, arpeggiated.
      const freqs = [220, 261.63, 329.63, 392.0, 493.88];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.setValueAtTime(f, now + i * 0.14);
        g.gain.setValueAtTime(0.001, now + i * 0.14);
        g.gain.exponentialRampToValueAtTime(0.22 / freqs.length, now + i * 0.14 + 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, now + 2.75);
        osc.connect(g);
        g.connect(master);
        osc.start(now + i * 0.14);
        osc.stop(now + 2.8);
      });
    } else {
      // A whoosh into a sub-bass hit.
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(64, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.85);
      osc.frequency.exponentialRampToValueAtTime(42, now + 1.05);
      osc.frequency.exponentialRampToValueAtTime(34, now + 2.6);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(220, now);
      filter.frequency.exponentialRampToValueAtTime(1600, now + 0.85);
      filter.frequency.exponentialRampToValueAtTime(180, now + 2.4);
      osc.connect(filter);
      filter.connect(master);
      osc.start(now);
      osc.stop(now + 2.8);
    }

    setPlayingDemoId(item.id);
    demoTimerRef.current = window.setTimeout(() => {
      stopDemo();
    }, 2850);
  };

  return { previewingVoice, playingDemoId, auditionVoice, previewShowcase, stopAll };
}
