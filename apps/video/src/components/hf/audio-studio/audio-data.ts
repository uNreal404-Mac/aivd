// Static data for the audio studio: modes, the models each mode offers, voice
// descriptions, showcase samples and the one-tap suggestions.
import type { LucideIcon } from "lucide-react";
import { AudioLines, Mic, Music, Sparkles, Waves } from "lucide-react";

// Only live, connected audio modes (no dead "coming soon" tabs).
export const MODES = ["tts", "music"] as const;
export type Mode = (typeof MODES)[number];
export const MODE_PARAMS: Record<string, Mode> = { voiceover: "tts", music: "music" };
export const MODE_MODELS: Record<Mode, string[]> = {
  tts: ["elevenlabs-v3", "elevenlabs-multilingual-v2", "elevenlabs-turbo-2-5", "gemini-3-8-flash-tts", "suno-speech"],
  music: ["suno-music", "suno-sounds"],
};

/** Longest voice / style description the studio sends. */
export const DETAIL_MAX = 500;

/** Models that take a speaking speed (kie-market clamps it to 0.7–1.2). */
export const SPEED_MODELS = ["elevenlabs-multilingual-v2", "elevenlabs-turbo-2-5"];
export const SPEED_MIN = 0.7;
export const SPEED_MAX = 1.2;
export const SPEED_STEP = 0.05;
/** Models that read the free-form `style` field. */
export const STYLE_MODELS = ["gemini-3-8-flash-tts", "suno-music"];

/** One line per model for the model list, plus its icon. */
export const MODEL_INFO: Record<string, { zh: string; en: string; icon: LucideIcon }> = {
  "elevenlabs-v3": { zh: "情绪起伏自然的旁白与对白", en: "Narration and dialogue with natural emotion", icon: AudioLines },
  "elevenlabs-multilingual-v2": { zh: "稳定的多语种配音，可调语速", en: "Steady multilingual voiceover, adjustable speed", icon: AudioLines },
  "elevenlabs-turbo-2-5": { zh: "出声更快、更省积分，可调语速", en: "Faster and lower cost, adjustable speed", icon: AudioLines },
  "gemini-3-8-flash-tts": { zh: "用一句话描述语气，指导表演", en: "Direct the delivery with a short tone note", icon: Sparkles },
  "suno-speech": { zh: "按文意自动匹配有表现力的播音声线", en: "Picks an expressive narrator for your script", icon: Mic },
  "suno-music": { zh: "一句话写歌，可选纯音乐或自填歌词", en: "Songs from one line, instrumental or your own lyrics", icon: Music },
  "suno-sounds": { zh: "音效与环境声，描述最多 500 字", en: "Sound effects and ambience, up to 500 characters", icon: Waves },
};

/** What a history entry is, from the model that made it (for the filter). */
export type AudioKind = "speech" | "music" | "sfx";
export function audioKindOf(modelId: string | undefined): AudioKind {
  if (modelId === "suno-music") return "music";
  if (modelId === "suno-sounds") return "sfx";
  return "speech";
}

/** History filter: what kind of audio, and how recent. */
export type HistoryType = "all" | AudioKind;
export type HistoryRange = "all" | "today" | "7d" | "30d";
export const HISTORY_RANGES: HistoryRange[] = ["all", "today", "7d", "30d"];

/** Start of the window a range keeps (local midnight for "today"), or null for all time. */
export function historyRangeStart(range: HistoryRange, now: number): number | null {
  if (range === "all") return null;
  if (range === "today") {
    const day = new Date(now);
    day.setHours(0, 0, 0, 0);
    return day.getTime();
  }
  return now - (range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;
}

/**
 * The history entries a filter keeps, in their original order. An entry with
 * no date only shows under "All time".
 */
export function filterAudioJobs<T extends { model?: string; createdAt?: number }>(
  jobs: T[],
  filter: { type: HistoryType; range: HistoryRange },
  now: number,
): T[] {
  const start = historyRangeStart(filter.range, now);
  return jobs.filter(
    (job) =>
      (filter.type === "all" || audioKindOf(job.model) === filter.type) &&
      (start === null || (typeof job.createdAt === "number" && job.createdAt >= start)),
  );
}

/** A stable number from a name (for a voice's colour and its drawn waveform). */
function nameSeed(name: string): number {
  let seed = 7;
  for (const char of name) seed = (seed * 31 + char.charCodeAt(0)) % 100_003;
  return seed;
}

/** Hue offset (degrees from the brand accent) that gives each voice its own colour. */
export function voiceHue(name: string): number {
  return (nameSeed(name) * 47) % 360;
}

/** Bar heights (percent) for a voice's drawn waveform; the same every time. */
export function voiceWave(name: string, bars = 36): number[] {
  let seed = nameSeed(name);
  return Array.from({ length: bars }, (_, index) => {
    seed = (seed * 9301 + 49297) % 233_280;
    const swell = Math.sin((index / bars) * Math.PI) * 30;
    return Math.round(22 + swell + (seed / 233_280) * 48);
  });
}

export type VoiceMeta = {
  gender: "M" | "F";
  tagZh: string;
  tagEn: string;
  pitch: number;
  rate: number;
};

export const VOICE_META: Record<string, VoiceMeta> = {
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

export function voiceTag(name: string, zh: boolean): string {
  const meta = VOICE_META[name];
  if (!meta) return "";
  return zh ? meta.tagZh : meta.tagEn;
}

/** The voice's gender, when we know it (for the voice filter). */
export function voiceGender(name: string): "M" | "F" | null {
  return VOICE_META[name]?.gender ?? null;
}

export const MUSIC_STYLE_CHIPS = [
  { zh: "电影管弦配乐", en: "Cinematic orchestral", value: "cinematic orchestral, emotional strings, epic build" },
  { zh: "雨夜慢爵士", en: "Rainy night jazz", value: "slow jazz, warm piano, soft brushed drums, rainy city night" },
  { zh: "治愈 Lo-Fi", en: "Chill Lo-Fi", value: "chill lo-fi hip hop, warm vinyl crackle, electric piano, 82 bpm" },
  { zh: "国风竹笛", en: "Chinese flute", value: "traditional Chinese gufeng, bamboo flute, guzheng, serene" },
  { zh: "赛博电子", en: "Cyber synthwave", value: "synthwave, driving retro bass, neon arpeggios, 118 bpm" },
];

export const SFX_QUICK_IDEAS = [
  { zh: "雨夜远雷与雨滴", en: "Rain & distant thunder", promptZh: "深夜倾盆大雨敲打玻璃窗，远处传来低沉滚雷声，环境沉浸感强", promptEn: "Heavy rain hitting glass window at night with deep rolling distant thunder, immersive stereo ambience" },
  { zh: "电影转场重低音", en: "Cinematic whoosh hit", promptZh: "电影预告片高速镜头切换音效，空气呼啸接厚重低音冲击", promptEn: "Cinematic trailer transition whoosh into deep sub-bass impact hit, crisp tail" },
  { zh: "科幻飞船引擎启动", en: "Sci-fi engine power up", promptZh: "科幻宇宙飞船引擎充能启动，金属嗡鸣逐渐攀升至低频轰鸣", promptEn: "Sci-fi starship engine charging up, harmonic turbine hum rising into deep propulsion roar" },
  { zh: "清晨森林鸟鸣溪流", en: "Morning forest stream", promptZh: "清晨阳光森林里的清脆鸟鸣，伴随着潺潺溪水流动声", promptEn: "Peaceful morning forest birds chirping softly beside a gentle babbling brook" },
];

export interface AudioShowcaseItem {
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

export const AUDIO_SHOWCASE: AudioShowcaseItem[] = [
  {
    id: "brand-narrator",
    mode: "tts",
    modelId: "elevenlabs-v3",
    voice: "James",
    cover: "/home/samples/red-carpet.webp",
    synthKind: "speech",
    titleZh: "品牌大片磁性旁白",
    titleEn: "Cinema Brand Narrator",
    tagZh: "Eleven v3 · James",
    tagEn: "Eleven v3 · James",
    scriptZh: "每一帧光影，都在讲述尚未被定义的故事。现在，用 AI 把脑海中的电影变成现实。",
    scriptEn: "Every frame of light tells a story waiting to be seen. Turn the cinema in your mind into reality.",
  },
  {
    id: "warm-podcast",
    mode: "tts",
    modelId: "gemini-3-8-flash-tts",
    voice: "Kore",
    detail: "温暖从容，带一点微笑，像深夜电台主播",
    cover: "/home/samples/studio-room.webp",
    synthKind: "speech",
    titleZh: "温暖治愈播客女声",
    titleEn: "Warm Storyteller Host",
    tagZh: "Gemini TTS · Kore",
    tagEn: "Gemini TTS · Kore",
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
    tagZh: "Suno V6 · 纯音乐",
    tagEn: "Suno V6 · Instrumental",
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
