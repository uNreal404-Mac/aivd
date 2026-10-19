import {
  DEEPSEEK_BASE_URL,
  MAX_OUTPUT_CHARS,
  MAX_OUTPUT_TOKENS,
  PROMPT_ENHANCE_MODEL,
} from "./config";

const REQUEST_TIMEOUT_MS = 20_000;

export const SYSTEM_PROMPT = `You are a film director's assistant working inside an AI video generator.

Rewrite the user's one-line idea into ONE concise, production-ready video prompt.

Requirements:
- English output: 60-120 words. Simplified Chinese output: 80-180 characters.
- Cover subject and action, shot size and framing, lighting, camera movement, visual style, and pacing/mood.
- Keep the user's original intent; sharpen clarity and visual specificity.
- Never add on-screen text, captions, logos, watermarks, real or celebrity people, nudity or sexual content, minors in any suggestive context, or gore.
- Output only the prompt text. No headings, no quotes, no lists, no explanations.
- If the request asks for sexual content, minors, real or celebrity people, or deepfakes, output exactly [[REFUSED]] and nothing else.`;

export class PromptEnhanceUpstreamError extends Error {
  status: number;

  constructor(status: number) {
    super(`Prompt enhancement upstream failed with status ${status}`);
    this.name = "PromptEnhanceUpstreamError";
    this.status = status;
  }
}

export interface EnhanceUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface EnhanceResult {
  text: string;
  usage?: EnhanceUsage;
}

interface DeepSeekChatResponse {
  choices?: Array<{ message?: { content?: string | null } | null } | null> | null;
  usage?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
}

function stripWrappingQuotes(value: string): string {
  const quotes = ['"', "'", "`"];
  for (const quote of quotes) {
    if (value.length >= 2 && value.startsWith(quote) && value.endsWith(quote)) {
      return value.slice(1, -1).trim();
    }
  }
  return value;
}

function sanitizeOutput(raw: string): string {
  const stripped = stripWrappingQuotes(raw.trim());
  const collapsed = stripped.replace(/\s+/g, " ").trim();
  return collapsed.slice(0, MAX_OUTPUT_CHARS).trim();
}

export async function enhanceWithDeepSeek(args: {
  input: string;
  language: "en" | "zh";
  apiKey: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<EnhanceResult> {
  const { input, language, apiKey } = args;
  const fetchImpl = args.fetchImpl ?? globalThis.fetch;

  const controller = args.signal ? undefined : new AbortController();
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    : undefined;
  const signal = args.signal ?? controller?.signal;

  const body = {
    model: PROMPT_ENHANCE_MODEL,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Output language: ${
          language === "zh" ? "Simplified Chinese" : "English"
        }\nIdea: ${input}`,
      },
    ],
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0.7,
    stream: false,
    thinking: { type: "disabled" },
  };

  try {
    const response = await fetchImpl(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      throw new PromptEnhanceUpstreamError(response.status);
    }

    const payload = (await response.json()) as DeepSeekChatResponse;
    const rawContent = payload.choices?.[0]?.message?.content;
    const text = sanitizeOutput(
      typeof rawContent === "string" ? rawContent : ""
    );

    if (!text) {
      throw new PromptEnhanceUpstreamError(502);
    }

    const promptTokens = payload.usage?.prompt_tokens;
    const completionTokens = payload.usage?.completion_tokens;

    if (typeof promptTokens === "number" && typeof completionTokens === "number") {
      return { text, usage: { promptTokens, completionTokens } };
    }

    return { text };
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new PromptEnhanceUpstreamError(504);
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Rough cost estimate for a request.
 *
 * Pricing source: https://api-docs.deepseek.com/quick_start/pricing
 * (snapshot 2026-10-20) — peak $0.30 / 1M input tokens (cache miss) and
 * $1.20 / 1M output tokens; off-peak is billed at half the peak rate.
 */
const PEAK_INPUT_USD_PER_TOKEN = 0.3 / 1_000_000;
const PEAK_OUTPUT_USD_PER_TOKEN = 1.2 / 1_000_000;

export function estimateCostUsd(
  usage: { promptTokens: number; completionTokens: number },
  peak = true
): number {
  const multiplier = peak ? 1 : 0.5;
  const peakCost =
    usage.promptTokens * PEAK_INPUT_USD_PER_TOKEN +
    usage.completionTokens * PEAK_OUTPUT_USD_PER_TOKEN;
  return peakCost * multiplier;
}
