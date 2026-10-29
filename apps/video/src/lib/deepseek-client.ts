import { ApiError } from "@/lib/api/error";

const DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions";
const DEEPSEEK_MODEL = "deepseek-flash";
const REQUEST_TIMEOUT_MS = 30_000;

export type DeepSeekContentPart =
  | { type: "text"; text: string }
  | {
      type: "image_url";
      image_url: { url: string; detail?: "low" | "original" };
    };

interface DeepSeekJsonOptions {
  system: string;
  content: DeepSeekContentPart[];
  maxTokens?: number;
}

function readApiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    throw new ApiError("Content safety service is not configured.", 503, {
      code: "CONTENT_SAFETY_UNAVAILABLE",
    });
  }
  return key;
}

function parseJsonContent(content: unknown): unknown {
  if (typeof content !== "string" || content.trim() === "") {
    throw new Error("DeepSeek returned an empty response");
  }

  const trimmed = content.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  return JSON.parse(withoutFence);
}

export async function callDeepSeekJson({
  system,
  content,
  maxTokens = 1200,
}: DeepSeekJsonOptions): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${readApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        temperature: 0,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`DeepSeek request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    return parseJsonContent(payload.choices?.[0]?.message?.content);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    console.error("DeepSeek safety request failed", error);
    throw new ApiError(
      "Safety review is temporarily unavailable. Please try again later.",
      503,
      { code: "CONTENT_SAFETY_UNAVAILABLE" },
    );
  } finally {
    clearTimeout(timeout);
  }
}
