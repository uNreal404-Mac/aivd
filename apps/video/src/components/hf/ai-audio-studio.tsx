"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, BookOpen, ChevronRight, Clock, Music, Paintbrush, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { getMarketModel, marketCredits, marketModelsOf } from "@/ai/kie-market";
import { localizedHref } from "@/lib/locale-path";
import { usePromptDraft } from "@/hooks/use-prompt-draft";
import { useCreditReturnDraft } from "@/hooks/use-credit-return-draft";
import { useSigninModal } from "@/hooks/use-signin-modal";
import { useCreditsShortfall } from "@/components/upgrade/credits-shortfall";
import { useSession } from "@/lib/auth/client";
import { submitMedia, useMediaJobs } from "@/lib/media-studio";
import { CopyPromptButton, DownloadLink, PendingCard, WaveformPlayer } from "@/components/hf/studio-results";
import "./ai-video-studio.css";

// Only expose live, connected audio modes (no dead "coming soon" tabs).
const MODES = ["tts", "music"] as const;
type Mode = (typeof MODES)[number];
const MODE_PARAMS: Record<string, Mode> = { voiceover: "tts", music: "music" };
const MODE_MODELS: Record<Mode, string[]> = {
  tts: ["elevenlabs-v3", "elevenlabs-multilingual-v2", "elevenlabs-turbo-2-5", "gemini-3-8-flash-tts", "suno-speech"],
  music: ["suno-music", "suno-sounds"],
};
const DETAIL_MAX = 500;
const AUDIO_MODELS = marketModelsOf("audio");

type VoiceMeta = {
  gender: "M" | "F";
  tagZh: string;
  tagEn: string;
  pitch: number;
  rate: number;
};

const VOICE_META: Record<string, VoiceMeta> = {
  James: { gender: "M", tagZh: "男声 · 磁性旁白", tagEn: "Male · Deep narrator", pitch: 0.85, rate: 0.96 },
  Brian: { gender: "M", tagZh: "男声 · 沉稳纪实", tagEn: "Male · Calm documentary", pitch: 0.82, rate: 0.94 },
  Bella: { gender: "F", tagZh: "女声 · 温暖自然", tagEn: "Female · Warm & soft", pitch: 1.15, rate: 1.0 },
  Laura: { gender: "F", tagZh: "女声 · 活力口播", tagEn: "Female · Bright host", pitch: 1.2, rate: 1.05 },
  Liam: { gender: "M", tagZh: "男声 · 青年解说", tagEn: "Male · Young explainer", pitch: 0.96, rate: 1.04 },
  Callum: { gender: "M", tagZh: "男声 · 戏剧张力", tagEn: "Male · Dramatic", pitch: 0.8, rate: 0.92 },
  Eve: { gender: "F", tagZh: "女声 · 知性播客", tagEn: "Female · Podcast", pitch: 1.12, rate: 0.98 },
  Lucy: { gender: "F", tagZh: "女声 · 清新甜美", tagEn: "Female · Clear & sweet", pitch: 1.24, rate: 1.03 },
  Rachel: { gender: "F", tagZh: "女声 · 叙事故事", tagEn: "Female · Storytelling", pitch: 1.08, rate: 0.97 },
  Benjamin: { gender: "M", tagZh: "男声 · 电影预告", tagEn: "Male · Trailer", pitch: 0.78, rate: 0.9 },
  Fola: { gender: "F", tagZh: "女声 · 亲切自然", tagEn: "Female · Friendly", pitch: 1.14, rate: 1.0 },
  Kore: { gender: "F", tagZh: "女声 · 清澈叙事", tagEn: "Female · Crisp narrator", pitch: 1.18, rate: 1.0 },
  Puck: { gender: "M", tagZh: "男声 · 轻快灵动", tagEn: "Male · Upbeat", pitch: 1.02, rate: 1.08 },
  Charon: { gender: "M", tagZh: "男声 · 低沉厚重", tagEn: "Male · Low & rich", pitch: 0.78, rate: 0.92 },
  Zephyr: { gender: "F", tagZh: "女声 · 明亮轻盈", tagEn: "Female · Bright airy", pitch: 1.22, rate: 1.04 },
  Aoede: { gender: "F", tagZh: "女声 · 抒情柔和", tagEn: "Female · Lyrical soft", pitch: 1.12, rate: 0.96 },
  Enceladus: { gender: "M", tagZh: "男声 · 气声温柔", tagEn: "Male · Breathy warm", pitch: 0.88, rate: 0.94 },
  Leda: { gender: "F", tagZh: "女声 · 青春清脆", tagEn: "Female · Youthful", pitch: 1.25, rate: 1.04 },
  Orus: { gender: "M", tagZh: "男声 · 坚定播报", tagEn: "Male · Firm anchor", pitch: 0.86, rate: 0.98 },
  Achird: { gender: "M", tagZh: "男声 · 对话松弛", tagEn: "Male · Conversational", pitch: 0.94, rate: 1.02 },
};

const MUSIC_STYLE_CHIPS = [
  { zh: "电影管弦配乐", en: "Cinematic orchestral", value: "cinematic orchestral, emotional strings, epic build" },
  { zh: "雨夜慢爵士", en: "Rainy night jazz", value: "slow jazz, warm piano, soft brushed drums, rainy city night" },
  { zh: "治愈 Lo-Fi", en: "Chill Lo-Fi", value: "chill lo-fi hip hop, warm vinyl crackle, electric piano, 82 bpm" },
  { zh: "国风竹笛", en: "Chinese flute", value: "traditional Chinese gufeng, bamboo flute, guzheng, serene" },
  { zh: "赛博电子", en: "Cyber synthwave", value: "synthwave, driving retro bass, neon arpeggios, 118 bpm" },
];

const SFX_QUICK_IDEAS = [
  { zh: "雨夜远雷与雨滴", en: "Rain & distant thunder", promptZh: "深夜倾盆大雨敲打玻璃窗，远处传来低沉滚雷声，环境沉浸感强", promptEn: "Heavy rain hitting glass window at night with deep rolling distant thunder, immersive stereo ambience" },
  { zh: "电影转场重低音", en: "Cinematic whoosh hit", promptZh: "电影预告片高速镜头切换音效，空气呼啸接厚重低音冲击", promptEn: "Cinematic trailer transition whoosh into deep sub-bass impact hit, crisp tail" },
  { zh: "科幻飞船引擎启动", en: "Sci-fi engine power up", promptZh: "科幻宇宙飞船引擎充能启动，金属嗡鸣逐渐攀升至低频轰鸣", promptEn: "Sci-fi starship engine charging up, harmonic turbine hum rising into deep propulsion roar" },
  { zh: "清晨森林鸟鸣溪流", en: "Morning forest stream", promptZh: "清晨阳光森林里的清脆鸟鸣，伴随着潺潺溪水流动声", promptEn: "Peaceful morning forest birds chirping softly beside a gentle babbling brook" },
];

interface AudioShowcaseItem {
  id: string;
  mode: Mode;
  modelId: string;
  voice?: string;
  instrumental?: boolean;
  detail?: string;
  cover: string;
  synthKind: "speech" | "ambient" | "sfx";
  titleZh: string;
  titleEn: string;
  tagZh: string;
  tagEn: string;
  scriptZh: string;
  scriptEn: string;
}

const AUDIO_SHOWCASE: AudioShowcaseItem[] = [
  {
    id: "brand-narrator",
    mode: "tts",
    modelId: "elevenlabs-v3",
    voice: "James",
    cover: "/home/samples/red-carpet.webp",
    synthKind: "speech",
    titleZh: "品牌大片磁性旁白",
    titleEn: "Cinema Brand Narrator",
    tagZh: "ElevenLabs v3 · James",
    tagEn: "ElevenLabs v3 · James",
    scriptZh: "每一帧光影，都在讲述尚未被定义的故事。现在，用 AI 把脑海中的电影变成现实。",
    scriptEn: "Every frame of light tells a story waiting to be seen. Turn the cinema in your mind into reality.",
  },
  {
    id: "warm-podcast",
    mode: "tts",
    modelId: "gemini-3-8-flash-tts",
    voice: "Bella",
    detail: "温暖从容，带一点微笑，像深夜电台主播",
    cover: "/home/samples/studio-room.webp",
    synthKind: "speech",
    titleZh: "温暖治愈播客女声",
    titleEn: "Warm Storyteller Host",
    tagZh: "Gemini TTS · Bella",
    tagEn: "Gemini TTS · Bella",
    scriptZh: "晚上好，欢迎回到创作电台。今天我们一起聊聊，如何用三分钟把一段灵感剪成有情绪的短片。",
    scriptEn: "Good evening and welcome back. Tonight we explore how to turn a rough spark into an emotional short film.",
  },
  {
    id: "neon-bgm",
    mode: "music",
    modelId: "suno-music",
    instrumental: true,
    detail: "cinematic synthwave, slow emotional strings, rainy city night, 92 bpm",
    cover: "/home/samples/rain-couple.webp",
    synthKind: "ambient",
    titleZh: "霓虹雨夜电影配乐",
    titleEn: "Neon Rain Cinema BGM",
    tagZh: "Suno Music · 纯音乐",
    tagEn: "Suno Music · Instrumental",
    scriptZh: "雨夜东京街头的电影级氛围配乐，温暖模拟合成器与弦乐缓缓推进，适合短片开场情绪铺垫。",
    scriptEn: "Atmospheric cinema score for a rainy neon street, warm analog synth pads and lush strings building softly.",
  },
  {
    id: "scifi-sfx",
    mode: "music",
    modelId: "suno-sounds",
    cover: "/home/samples/cosmic-bloom.webp",
    synthKind: "sfx",
    titleZh: "科幻片头重低音转场",
    titleEn: "Sci-Fi Trailer Hit SFX",
    tagZh: "Suno Sounds · 电影音效",
    tagEn: "Suno Sounds · Trailer SFX",
    scriptZh: "科幻预告片高速穿梭风声接厚重亚低音冲击，金属余韵缓缓消散，立体声场宽广。",
    scriptEn: "High-speed sci-fi trailer whoosh slamming into a deep sub-bass impact with shimmering metallic tail.",
  },
];

export function AiAudioStudio({
  locale,
  initialVoiceMode = "",
  initialModelId = "",
}: {
  locale: string;
  initialVoiceMode?: string;
  initialModelId?: string;
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
  const [script, setScript] = useState("");
  const [speed, setSpeed] = useState(1);
  const [instrumental, setInstrumental] = useState(false);
  const [customMode, setCustomMode] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [playingDemoId, setPlayingDemoId] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const demoTimerRef = useRef<number | null>(null);
  const { data: session, isPending: sessionLoading } = useSession();
  const signedOut = !sessionLoading && !session;
  const internalFree = process.env.NEXT_PUBLIC_IS_PREVIEW === "true" &&
    session?.user?.isAdmin === true && session.user.isSuperAccount === true;
  const draft = usePromptDraft("audio", script, setScript, false);
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const creditsShortfall = useCreditsShortfall(zh);
  const { jobs, add } = useMediaJobs("audio", Boolean(session));
  const scriptRef = useRef<HTMLTextAreaElement>(null);
  const reuse = (text: string) => {
    setScript(text);
    setNotice(null);
    scriptRef.current?.focus();
  };
  const [tab, setTab] = useState<"history" | "how">("history");
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

  const stopDemoPlayback = () => {
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

  // Cancel any Web Speech or Web Audio audition on unmount.
  useEffect(() => {
    return () => {
      stopDemoPlayback();
    };
  }, []);

  const previewShowcaseItem = (item: AudioShowcaseItem) => {
    if (playingDemoId === item.id) {
      stopDemoPlayback();
      return;
    }
    stopDemoPlayback();
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

    // Real synthesized Web Audio preview for BGM / SFX cards (zero external broken audio files)
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
      // Warm cinematic cyan-night minor-9th chord arpeggio
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
      // Sci-fi whoosh into sub-bass trailer hit
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
      stopDemoPlayback();
    }, 2850);
  };

  const applyShowcasePreset = (item: AudioShowcaseItem) => {
    setMode(item.mode);
    setModelId(item.modelId);
    if (item.voice) setVoice(item.voice);
    setInstrumental(Boolean(item.instrumental));
    setDetail(item.detail ?? "");
    setScript(zh ? item.scriptZh : item.scriptEn);
    setNotice(null);
    scriptRef.current?.focus();
  };

  const auditionVoice = (voiceName: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setNotice(zh ? "当前浏览器不支持本地试听，请直接选择音色生成。" : "Browser speech preview is unavailable here.");
      return;
    }
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
    const availableVoices = window.speechSynthesis.getVoices();
    const langVoices = availableVoices.filter((v) => v.lang.toLowerCase().startsWith(zh ? "zh" : "en"));
    if (langVoices.length > 0) {
      const idx = Math.abs(voiceName.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0)) % langVoices.length;
      utter.voice = langVoices[idx];
    }
    utter.onend = () => setPreviewingVoice(null);
    utter.onerror = () => setPreviewingVoice(null);
    setPreviewingVoice(voiceName);
    window.speechSynthesis.speak(utter);
  };

  const modeModels = MODE_MODELS[mode]
    .map((id) => getMarketModel(id))
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
  const maxScript = model.options.maxPromptLength ?? 5000;
  const supportsSpeed = model.id === "elevenlabs-multilingual-v2" || model.id === "elevenlabs-turbo-2-5";
  const supportsStyle = model.id === "gemini-3-8-flash-tts" || model.id === "suno-music";
  const isSunoMusic = model.id === "suno-music";
  const isSunoSounds = model.id === "suno-sounds";

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
    const first = MODE_MODELS[next][0];
    if (first && !MODE_MODELS[next].includes(modelId)) chooseModel(first);
  };

  const t = zh
    ? {
        modes: { tts: "文本转语音", music: "音乐与音效" } as Record<Mode, string>,
        optional: "可选",
        script: isSunoMusic ? (customMode ? "歌词内容" : "歌曲创意描述") : isSunoSounds ? "音效描述" : "配音脚本",
        scriptHint: isSunoMusic
          ? customMode
            ? "写下完整歌词（可用 [Verse] / [Chorus] 标记段落）"
            : "描述想要的歌曲情绪、主题与乐器，例如：雨夜城市的慢节奏爵士。"
          : isSunoSounds
            ? "描述想要的音效场景，例如：雨夜远雷与敲窗雨声，环境沉浸感强。"
            : "逐字写下要朗读的内容。",
        model: "模型",
        voice: "选择音色（支持点击试听）",
        detail: isSunoMusic ? "曲风与乐器标签" : "语气与表演指导（Gemini 专属）",
        detailHint: isSunoMusic ? "例如：爵士、钢琴、慢节奏、温暖" : "例如：语速放慢，带一点笑意，像深夜电台主播",
        generate: "生成",
        submitting: "提交中…",
        history: "历史记录",
        how: "工作原理",
        heroTitle: "将文字变成自然语音",
        heroSub: "支持 ElevenLabs、Gemini 与 Suno，一站搞定配音、歌曲与场景音效",
        card1: "挑选声线与风格",
        card1Sub: "每款音色均标注性别与定位，点播放图标可快速试听",
        card2: model.id === "gemini-3-8-flash-tts" ? "输入台词与语气指导" : "输入脚本并一键生成",
        card2Sub:
          model.id === "gemini-3-8-flash-tts"
            ? "写下台词，再补充一句语气描述即可控制情绪与节奏"
            : supportsSpeed
              ? "输入要朗读的文字，微调语速后点击生成即可下载"
              : "输入要朗读的文字，点击生成后可在历史记录试听下载",
        demoVoices: [
          { name: "James", tag: "男声 · 磁性旁白" },
          { name: "Bella", tag: "女声 · 温暖自然" },
          { name: "Kore", tag: "女声 · 清澈叙事" },
        ],
        demoPrompt: "欢迎收看本期节目。今天我们一起用 AI 为短片配上电影级旁白与背景音乐。",
      }
    : {
        modes: { tts: "Text to speech", music: "Music & SFX" } as Record<Mode, string>,
        optional: "Optional",
        script: isSunoMusic ? (customMode ? "Lyrics" : "Song description") : isSunoSounds ? "Sound effect description" : "Script",
        scriptHint: isSunoMusic
          ? customMode
            ? "Write your lyrics (use [Verse] / [Chorus] tags)"
            : "Describe the song mood, theme & instruments, e.g. slow jazz for a rainy city night."
          : isSunoSounds
            ? "Describe the sound effect, e.g. cinematic whoosh hit or heavy rain on window."
            : "Write exactly what the voice should read.",
        model: "Model",
        voice: "Voice (click play to preview)",
        detail: isSunoMusic ? "Genre & instrument style" : "Voice direction (Gemini)",
        detailHint: isSunoMusic ? "e.g. jazz, piano, slow, warm" : "e.g. slower, warm smile, late-night podcast host",
        generate: "Generate",
        submitting: "Submitting…",
        history: "History",
        how: "How it works",
        heroTitle: "Turn text into lifelike speech",
        heroSub: "ElevenLabs, Gemini, and Suno in one studio for voiceovers, songs, and sound effects",
        card1: "Pick a voice with clarity",
        card1Sub: "Every voice shows gender & style tags with quick preview",
        card2: model.id === "gemini-3-8-flash-tts" ? "Write script & tone" : "Write & generate",
        card2Sub:
          model.id === "gemini-3-8-flash-tts"
            ? "Enter your script plus a short tone cue to direct delivery"
            : supportsSpeed
              ? "Enter your script, adjust speaking speed, and generate"
              : "Enter your script, generate, and download from History",
        demoVoices: [
          { name: "James", tag: "Male · Deep narrator" },
          { name: "Bella", tag: "Female · Warm & soft" },
          { name: "Kore", tag: "Female · Crisp narrator" },
        ],
        demoPrompt: "Welcome back to the show. Today we pair AI visuals with cinema-grade voiceovers and custom soundtracks.",
      };

  const how =
    mode === "music"
      ? {
          title: zh ? "一句话写歌与做音效" : "Songs and sound effects from one line",
          sub: zh ? "支持纯音乐模式、自定义歌词与高频场景音效生成" : "Instrumental toggle, custom lyrics mode, and crisp SFX generation",
          card1: zh ? "选择曲风与模式" : "Pick style & mode",
          card1Sub: zh ? "可切换纯音乐 BGM 或自定义歌词，曲风越具体效果越稳" : "Toggle Instrumental BGM or Custom Lyrics and pick genre tags",
          chips: zh
            ? [
                { name: "爵士 · 钢琴", tag: "慢节奏" },
                { name: "电影 · 管弦", tag: "纯音乐" },
                { name: "场景 · 音效", tag: "Suno Sounds" },
              ]
            : [
                { name: "Jazz · piano", tag: "slow" },
                { name: "Cinematic · strings", tag: "instrumental" },
                { name: "Scene · SFX", tag: "Suno Sounds" },
              ],
          card2: zh ? "生成并试听下载" : "Generate & download",
          card2Sub: zh ? "点击下方示例可直接填入左侧输入框" : "Click the sample below to load it into the composer",
          demo: zh ? "清晨的海边，轻柔的钢琴和海浪声，安静治愈。" : "A calm morning by the sea, soft piano and waves, quiet and soothing.",
        }
      : {
          title: t.heroTitle,
          sub: t.heroSub,
          card1: t.card1,
          card1Sub: t.card1Sub,
          chips: t.demoVoices,
          card2: t.card2,
          card2Sub: t.card2Sub,
          demo: t.demoPrompt,
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

  return (
    <div className="vs-root">
      <aside aria-label={t.modes[mode]} className="vs-panel">
        <div className="vs-modes" role="tablist">
          {MODES.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={option === mode}
              onClick={() => chooseMode(option)}
              className={option === mode ? "vs-mode vs-mode-on" : "vs-mode"}
            >
              {t.modes[option]}
            </button>
          ))}
        </div>

        <div className="vs-card vs-prompt">
          <label htmlFor="audio-script" className="vs-prompt-label vs-prompt-label-muted">{t.script}</label>
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
          {draft.restored ? (
            <p className="draft-note">
              {zh ? "已恢复上次没生成的草稿" : "Your unsent draft is back"}
              <button type="button" onClick={draft.discard}>
                {zh ? "清空" : "Clear"}
              </button>
            </p>
          ) : null}
          <span className="vs-count">
            {script.length}/{maxScript}
          </span>
        </div>

        <label htmlFor="audio-model" className="vs-card vs-select">
          <span className="min-w-0 flex-1">
            <span className="vs-card-label">{t.model}</span>
            <span className="vs-card-value">{model.name}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-[var(--hfv-muted)]" aria-hidden="true" />
          <select id="audio-model" value={modelId} onChange={(event) => chooseModel(event.target.value)}>
            {modeModels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>

        {model.id === "suno-speech" ? (
          <p className="vs-hint">
            {zh ? "Suno Speech 会根据语义自动匹配表现力播音音色，无需手动挑选声线。" : "Suno Speech automatically selects an expressive narrator voice based on your script."}
          </p>
        ) : null}

        {model.options.voices?.length ? (
          <fieldset className="as-voice-pick">
            <legend className="vs-card-label">{t.voice}</legend>
            <div className="as-voice-grid">
              {model.options.voices.map((item) => {
                const meta = VOICE_META[item.name];
                const isPlaying = previewingVoice === item.name;
                return (
                  <div
                    key={item.id}
                    className={voice === item.id ? "as-voice-opt as-voice-opt-on" : "as-voice-opt"}
                    style={{ padding: 0, overflow: "hidden" }}
                  >
                    <button
                      type="button"
                      aria-pressed={voice === item.id}
                      onClick={() => setVoice(item.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pl-1.5 pr-0.5 text-left"
                    >
                      <span className="as-voice-avatar shrink-0" aria-hidden="true">
                        {item.name.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold">{item.name}</span>
                        {meta ? (
                          <span className="block truncate text-[11px] opacity-75">
                            {zh ? meta.tagZh.replace(/^([男女])声\s*·\s*/, "$1·") : meta.tagEn.replace(/^(Male|Female)\s*·\s*/, (_, g: string) => `${g[0]}·`)}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={isPlaying ? (zh ? `停止试听 ${item.name}` : `Stop preview ${item.name}`) : zh ? `试听 ${item.name}` : `Preview ${item.name}`}
                      title={zh ? "快速试听声线特点" : "Quick voice preview"}
                      onClick={(e) => {
                        e.stopPropagation();
                        auditionVoice(item.name);
                      }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center opacity-80 transition hover:opacity-100"
                    >
                      {isPlaying ? (
                        <span className="as-wave-bars" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                          <span />
                        </span>
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        {supportsSpeed ? (
          <div className="vs-card flex-col items-stretch gap-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="audio-speed" className="vs-card-label">{zh ? "朗读语速" : "Speaking speed"}</label>
              <strong className="text-[var(--du-accent-text)]">{speed.toFixed(2)}×</strong>
            </div>
            <input
              id="audio-speed"
              type="range"
              min={0.7}
              max={1.2}
              step={0.05}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
              className="w-full accent-[var(--du-accent)]"
            />
          </div>
        ) : null}

        {isSunoMusic ? (
          <div className="vs-card flex-col items-stretch gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={instrumental}
                onClick={() => setInstrumental((v) => !v)}
                className={instrumental ? "vs-chip vs-chip-on" : "vs-chip"}
              >
                <Music className="h-3.5 w-3.5" aria-hidden="true" />
                {zh ? (instrumental ? "纯音乐：开启" : "纯音乐 BGM") : instrumental ? "Instrumental: ON" : "Instrumental"}
              </button>
              <button
                type="button"
                aria-pressed={customMode}
                onClick={() => setCustomMode((v) => !v)}
                className={customMode ? "vs-chip vs-chip-on" : "vs-chip"}
              >
                {zh ? (customMode ? "自定义歌词：开启" : "自定义歌词") : customMode ? "Custom lyrics: ON" : "Custom lyrics"}
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MUSIC_STYLE_CHIPS.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  className="vs-chip"
                  onClick={() => setDetail(chip.value)}
                >
                  + {zh ? chip.zh : chip.en}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isSunoSounds ? (
          <div className="vs-card flex-col items-stretch gap-2">
            <span className="vs-card-label">{zh ? "高频音效预设（一键填入）" : "Quick SFX presets"}</span>
            <div className="flex flex-wrap gap-1.5">
              {SFX_QUICK_IDEAS.map((item) => (
                <button
                  key={item.en}
                  type="button"
                  className="vs-chip"
                  onClick={() => reuse(zh ? item.promptZh : item.promptEn)}
                >
                  {zh ? item.zh : item.en}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {supportsStyle ? (
          <div className="vs-card vs-prompt">
            <span className="flex items-center justify-between">
              <label htmlFor="audio-detail" className="vs-prompt-label vs-prompt-label-muted">{t.detail}</label>
              <span className="vs-soon">{t.optional}</span>
            </span>
            <textarea
              id="audio-detail"
              className="vs-textarea-short"
              value={detail}
              maxLength={DETAIL_MAX}
              placeholder={t.detailHint}
              onChange={(event) => setDetail(event.target.value)}
            />
          </div>
        ) : null}

        <button type="button" className="vs-generate as-generate" disabled={submitting} onClick={() => void generate()}>
          {submitting ? t.submitting : t.generate}
          <span className="vs-generate-cost">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {internalFree ? 0 : credits}
          </span>
        </button>

        {notice ? <output aria-live="polite" className="vs-notice">{notice}{creditsShortfall.action(notice)}</output> : null}
      </aside>

      <section aria-label={t.heroTitle} className="vs-stage">
        <div className="vs-stage-tabs">
          <button type="button" aria-pressed={tab === "history"} onClick={() => setTab("history")} className={tab === "history" ? "vs-stage-tab vs-stage-tab-on" : "vs-stage-tab"}>
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {t.history}
            {jobs.length > 0 ? <span className="vs-stage-count">{jobs.length}</span> : null}
          </button>
          <button type="button" aria-pressed={tab === "how"} onClick={() => setTab("how")} className={tab === "how" ? "vs-stage-tab vs-stage-tab-on" : "vs-stage-tab"}>
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {t.how}
          </button>
        </div>

        {tab === "history" ? (
          jobs.length === 0 ? (
            <div className="vs-empty-stage">
              <div className="vs-empty-strip">
                <div className="vs-empty-strip-copy">
                  <span className="vs-empty-strip-icon" aria-hidden="true">
                    <AudioLines className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="vs-stage-title">
                      {signedOut
                        ? zh ? "配音、写歌、音效一站试听，一键做同款" : "Audition voiceovers, music & SFX — recreate in 1 click"
                        : zh ? "还没有生成过音频 · 点下方样音卡片立刻开录" : "No audio yet · Try a showcase card below"}
                    </h2>
                    <p className="vs-empty-strip-sub">
                      {signedOut
                        ? zh
                          ? "支持 ElevenLabs v3、Gemini Flash TTS 与 Suno Music / Sounds，登录后云端同步。"
                          : "ElevenLabs v3, Gemini Flash TTS & Suno Music/Sounds in one studio. Sign in to sync."
                        : zh
                          ? "点击封面即可试听效果，点「做同款」自动切换对应模型、音色与曲风脚本。"
                          : "Hit play on any cover to audition, or click Recreate to load its model, voice & script."}
                    </p>
                  </div>
                </div>
                {signedOut ? (
                  <button type="button" className="vs-empty-signin" onClick={() => signIn.onOpen()}>
                    {zh ? "登录同步作品" : "Sign in"}
                  </button>
                ) : null}
              </div>

              <div className="as-showcase-grid" aria-label={zh ? "可试听音频样板墙" : "Playable audio showcase"}>
                {AUDIO_SHOWCASE.map((item) => {
                  const playing = playingDemoId === item.id;
                  return (
                    <article key={item.id} className={playing ? "as-showcase-card as-showcase-card-on" : "as-showcase-card"}>
                      <button
                        type="button"
                        className="as-showcase-cover"
                        aria-label={playing ? (zh ? `停止试听 ${item.titleZh}` : `Stop ${item.titleEn}`) : zh ? `试听 ${item.titleZh}` : `Play ${item.titleEn}`}
                        onClick={() => previewShowcaseItem(item)}
                      >
                        <img src={item.cover} alt="" />
                        <span className="as-showcase-play">
                          {playing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                        </span>
                      </button>
                      <div className="as-showcase-body">
                        <div className="as-showcase-head">
                          <span className="as-showcase-tag vs-meta-mono">{zh ? item.tagZh : item.tagEn}</span>
                          {playing ? (
                            <span className="as-wave-bars" aria-hidden="true">
                              <span />
                              <span />
                              <span />
                              <span />
                            </span>
                          ) : null}
                        </div>
                        <h3 className="as-showcase-title">{zh ? item.titleZh : item.titleEn}</h3>
                        <p className="as-showcase-script">{zh ? item.scriptZh : item.scriptEn}</p>
                        <div className="as-showcase-foot">
                          <button type="button" className="as-showcase-btn" onClick={() => previewShowcaseItem(item)}>
                            {playing ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                            {playing ? (zh ? "停止" : "Stop") : zh ? "试听" : "Preview"}
                          </button>
                          <button type="button" className="as-showcase-recreate" onClick={() => applyShowcasePreset(item)}>
                            <Sparkles className="h-3 w-3" />
                            {zh ? "做同款" : "Recreate"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <a href={localizedHref(locale, "/creative-space/canvas")} className="as-canvas-banner">
                <span className="flex flex-col gap-0.5">
                  <strong className="text-sm font-semibold text-[var(--ds-text-1)]">
                    {zh ? "需要给视频分镜配音或加 BGM？" : "Pairing voiceovers or BGM with video shots?"}
                  </strong>
                  <span className="text-xs text-[var(--ds-text-3)]">
                    {zh ? "前往无限画布，把图片、视频镜头与音频轨道连线编排" : "Open Infinite Canvas to connect images, video clips, and audio tracks"}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[var(--du-accent-text)]" aria-hidden="true" />
              </a>
            </div>
          ) : (
            <div className="as-list">
              {jobs.map((job) => {
                const done = job.status === "completed" && job.urls.length > 0;
                const modelLabel = getMarketModel(job.model)?.name ?? job.model;
                return (
                  <div key={job.uuid} className="as-item">
                    <div className="as-item-head">
                      <span className="as-item-model">{modelLabel}</span>
                      <span className="as-item-prompt" title={job.prompt}>{job.prompt}</span>
                      {done ? (
                        <span className="as-item-tools">
                          <CopyPromptButton prompt={job.prompt} zh={zh} />
                          <button type="button" className="sr-icon" title={zh ? "复用文本" : "Reuse text"} aria-label={zh ? "复用文本" : "Reuse text"} onClick={() => reuse(job.prompt)}>
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="sr-icon"
                            title={zh ? "发送到无限画布编排" : "Send to Infinite Canvas"}
                            aria-label={zh ? "发送到无限画布" : "Send to Infinite Canvas"}
                            onClick={() => {
                              try {
                                sessionStorage.setItem(
                                  "aivd:canvas-handoff",
                                  JSON.stringify({ kind: "audio", url: job.urls[0], prompt: job.prompt, model: modelLabel }),
                                );
                              } catch {
                                // Ignore storage errors.
                              }
                              window.location.assign(localizedHref(locale, "/creative-space/canvas"));
                            }}
                          >
                            <Paintbrush className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </span>
                      ) : null}
                    </div>
                    {done ? (
                      job.urls.map((url, index) => (
                        <div key={`${job.uuid}-${index}`} className="as-item-player">
                          <WaveformPlayer url={url} zh={zh} />
                          <DownloadLink url={url} zh={zh} className="as-item-dl" />
                        </div>
                      ))
                    ) : (
                      <PendingCard
                        className="as-pending"
                        status={job.status === "completed" ? "failed" : job.status}
                        since={job.createdAt}
                        message={job.status === "completed" ? (zh ? "没有返回音频" : "No audio came back") : job.message}
                        zh={zh}
                        onReuse={() => reuse(job.prompt)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="vs-howto vs-howto-center">
            <h2 className="vs-howto-title">{how.title}</h2>
            <p className="vs-howto-sub">{how.sub}</p>
            <div className="as-cards">
              <div className="as-card">
                <h3 className="vs-step-title">{how.card1}</h3>
                <p className="vs-step-body">{how.card1Sub}</p>
                <div className="as-voices">
                  {(how.chips ?? []).map((item, index) => (
                    <div key={item.name} className={index === 0 ? "as-voice as-voice-main" : "as-voice"}>
                      <span className="as-voice-wave" aria-hidden="true">
                        <AudioLines className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="as-voice-name">{item.name}</span>
                        {item.tag ? <span className="as-voice-tag">{item.tag}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="as-card">
                <h3 className="vs-step-title">{how.card2}</h3>
                <p className="vs-step-body">{how.card2Sub}</p>
                <div className="as-mock">
                  <button type="button" className="as-mock-box w-full text-left transition hover:opacity-90" onClick={() => reuse(how.demo)}>
                    <span className="vs-card-label">{zh ? "点击填入示例" : "Click to try sample"}</span>
                    <p className="as-mock-text">{how.demo}</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
