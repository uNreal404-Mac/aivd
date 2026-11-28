/** Supported script and dubbing languages, shared by the client and the generation endpoint. */
export const VOICE_LANGUAGES = ["en", "zh", "es", "fr", "de", "ja", "ko", "pt", "it"] as const;
export type VoiceLanguage = (typeof VOICE_LANGUAGES)[number];
export type VoiceSettings = {
  stability?: number;
  similarity?: number;
  expression?: number;
  language?: VoiceLanguage;
};
export const VOICE_DEFAULTS = { stability: 0.5, similarity: 0.75, expression: 0 };
export const LANGUAGE_NAMES: Record<VoiceLanguage, string> = {
  en: "English",
  zh: "中文",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  pt: "Português",
  it: "Italiano",
};

export function cleanVoiceSettings(value: unknown): VoiceSettings {
  if (!value || typeof value !== "object") return {};
  const input = value as VoiceSettings;
  const result: VoiceSettings = {};
  for (const field of ["stability", "similarity", "expression"] as const) {
    const n = input[field];
    if (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) result[field] = n;
  }
  if (input.language && VOICE_LANGUAGES.includes(input.language)) result.language = input.language;
  return result;
}

export function elevenDialogueInput(options?: VoiceSettings) {
  const { stability = 0.5, language } = cleanVoiceSettings(options);
  return { stability: Math.round(stability * 2) / 2, ...(language ? { language_code: language } : {}) };
}

export function elevenSpeechInput(options?: VoiceSettings) {
  const { stability = 0.5, similarity = 0.75, expression, language } = cleanVoiceSettings(options);
  return {
    stability,
    similarity_boost: similarity,
    ...(expression !== undefined ? { style: expression } : {}),
    ...(language ? { language_code: language } : {}),
  };
}

/** Keep unchanged TTS submissions compatible with retry keys created by older clients. */
export function submittedVoiceSettings(model: string, settings: VoiceSettings): VoiceSettings | undefined {
  if (!model.startsWith("elevenlabs-")) return undefined;
  const input = cleanVoiceSettings(settings);
  const selected: VoiceSettings = {};
  if (input.language) selected.language = input.language;
  const stability = model === "elevenlabs-v3" ? elevenDialogueInput(input).stability : input.stability;
  if (stability !== undefined && stability !== VOICE_DEFAULTS.stability) selected.stability = stability;
  if (model !== "elevenlabs-v3") {
    if (input.similarity !== undefined && input.similarity !== VOICE_DEFAULTS.similarity)
      selected.similarity = input.similarity;
    if (input.expression !== undefined && input.expression !== VOICE_DEFAULTS.expression)
      selected.expression = input.expression;
  }
  return Object.keys(selected).length ? selected : undefined;
}
