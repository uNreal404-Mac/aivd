"use client";

import { useEffect, useRef, useState } from "react";
import { ELEVENLABS_VOICES } from "@/ai/kie-market";
import { type AudioShowcaseItem, VOICE_META } from "./audio-data";

/** Public ElevenLabs samples and local system demonstrations are played only on request. */
export function useAudioPreview(zh: boolean, onUnavailable: (message: string) => void) {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingDemoId, setPlayingDemoId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const demoTimerRef = useRef<number | null>(null);
  const progressFrameRef = useRef<number | null>(null);
  // Bumped per voice preview, so a cancelled one finishing late leaves the
  // newer preview's progress alone.
  const voiceRunRef = useRef(0);
  const samplePlayer = useRef<HTMLAudioElement | null>(null);

  /*
   * How far a voice preview has got, drawn on every waveform marked
   * data-au-voice="<name>" as --au-progress (0–1). Set on the elements
   * directly, so the studio does not re-render on every frame. Speech
   * engines that report word boundaries move it exactly; others move it by
   * the sample's expected length.
   */
  const stopProgress = () => {
    if (progressFrameRef.current !== null) cancelAnimationFrame(progressFrameRef.current);
    progressFrameRef.current = null;
    for (const el of document.querySelectorAll<HTMLElement>("[data-au-voice]")) el.style.removeProperty("--au-progress");
  };
  const paintProgress = (voiceName: string, value: number) => {
    const selector = `[data-au-voice="${CSS.escape(voiceName)}"]`;
    for (const el of document.querySelectorAll<HTMLElement>(selector)) el.style.setProperty("--au-progress", value.toFixed(3));
  };
  const startProgress = (voiceName: string, utter: SpeechSynthesisUtterance, text: string) => {
    stopProgress();
    const expectedMs = (text.length / ((zh ? 4.5 : 14) * utter.rate)) * 1000;
    let started = 0;
    let spoken: number | null = null;
    utter.onstart = () => {
      started = performance.now();
    };
    utter.onboundary = (event) => {
      spoken = Math.min(1, (event.charIndex + (event.charLength || 1)) / text.length);
    };
    const tick = () => {
      const timed = started ? Math.min(0.97, (performance.now() - started) / expectedMs) : 0;
      paintProgress(voiceName, spoken ?? timed);
      progressFrameRef.current = requestAnimationFrame(tick);
    };
    progressFrameRef.current = requestAnimationFrame(tick);
  };

  const stopDemo = () => {
    voiceRunRef.current++;
    if (samplePlayer.current) {
      const player = samplePlayer.current;
      samplePlayer.current = null;
      player.ontimeupdate = player.onended = player.onerror = null;
      player.pause();
      player.removeAttribute("src");
      player.load();
    }
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
    stopProgress();
    setPreviewingVoice(null);
  };

  // Cancel any Web Speech or Web Audio audition on unmount.
  const stopRef = useRef(stopAll);
  stopRef.current = stopAll;
  useEffect(() => () => stopRef.current(), []);

  const auditionVoice = (voiceName: string) => {
    if (typeof window === "undefined") return;
    stopAll();
    if (previewingVoice === voiceName) return;
    const preset = ELEVENLABS_VOICES.find(voice => voice.name === voiceName);
    if (preset) {
      const player = new Audio(`https://static.aiquickdraw.com/elevenlabs/voice/${preset.id}.mp3`);
      samplePlayer.current = player;
      const failed = () => {
        if (samplePlayer.current !== player) return;
        stopAll();
        onUnavailable(zh ? "音色样本暂时无法播放，请稍后重试。" : "The voice sample could not play. Try again in a moment.");
      };
      player.onended = () => { if (samplePlayer.current === player) stopAll(); };
      player.onerror = failed;
      player.ontimeupdate = () => {
        if (player.duration > 0) paintProgress(voiceName, Math.min(1, player.currentTime / player.duration));
      };
      setPreviewingVoice(voiceName);
      void player.play().catch(failed);
      return;
    }
    if (!("speechSynthesis" in window)) {
      onUnavailable(zh ? "此浏览器没有可试听的系统朗读音色。" : "A system voice preview is unavailable in this browser.");
      return;
    }
    onUnavailable(zh ? "正在播放设备自带的朗读示范。生成配音时使用所选模型音色。" : "Playing a system voice demo. Generation uses the selected model voice.");
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
    const run = ++voiceRunRef.current;
    const finish = () => {
      if (voiceRunRef.current !== run) return;
      stopProgress();
      setPreviewingVoice((current) => (current === voiceName ? null : current));
    };
    utter.onend = finish;
    utter.onerror = finish;
    setPreviewingVoice(voiceName);
    startProgress(voiceName, utter, sample);
    window.speechSynthesis.speak(utter);
  };

  const previewShowcase = (item: AudioShowcaseItem) => {
    if (playingDemoId === item.id) {
      stopDemo();
      return;
    }
    stopDemo();
    stopProgress();
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
