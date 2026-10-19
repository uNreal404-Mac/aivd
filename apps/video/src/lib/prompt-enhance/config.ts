export const PROMPT_ENHANCE_MODEL = "deepseek-flash";
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export const MAX_INPUT_CHARS = 500;
export const MAX_OUTPUT_TOKENS = 600;
/** Matches the generator prompt cap (MAX_PROMPT_LENGTH in lib/image-to-video). */
export const MAX_OUTPUT_CHARS = 1000;

export const RATE_LIMIT_PER_MINUTE = 5;
export const RATE_LIMIT_PER_DAY = 50;

/**
 * The feature is only on when the switch is explicitly enabled AND an API key
 * is configured. Plain (non-secret) env vars only — the key itself is never
 * read here, just its presence.
 */
export function isPromptEnhanceEnabled(): boolean {
  return (
    process.env.PROMPT_ENHANCE_ENABLED === "true" &&
    Boolean(process.env.DEEPSEEK_API_KEY)
  );
}

export type EnhanceLanguage = "auto" | "en" | "zh";

const CJK_CHAR_PATTERN = /[\u3400-\u9fff]/;

/**
 * Very small heuristic: if CJK characters make up at least 20% of the
 * non-space characters, treat the text as Chinese, otherwise English.
 */
export function detectLanguage(text: string): "en" | "zh" {
  const normalized = text.normalize("NFKC");
  const chars = Array.from(normalized).filter((char) => !/\s/.test(char));

  if (chars.length === 0) {
    return "en";
  }

  const cjkCount = chars.filter((char) => CJK_CHAR_PATTERN.test(char)).length;

  return cjkCount / chars.length >= 0.2 ? "zh" : "en";
}
