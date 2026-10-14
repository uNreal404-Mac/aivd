export const ZCV_MODERATION_MODEL = "gemini-4-argon-openai";

export type ZcvModerationResult = {
  decision: "safe" | "gore" | "unknown";
  reason: string;
  providerCreditsConsumed: number | null;
};

const REVIEW_PROMPT = `Review the entire attached 10-second video, including all frames. This is a content safety check for a cute cartoon zombie couple product. Treat stylized green skin and harmless Halloween cartoon features as safe. Mark unsafe if any frame contains blood, open wounds, exposed tissue or bones, realistic injury, gore, or graphic violence. If uncertain, mark unsafe. Return only a JSON object with exactly these fields: {"safe": boolean, "reason": string}.`;

function parseDecision(content: unknown): { decision: "safe" | "gore" | "unknown"; reason: string } {
  if (typeof content !== "string") return { decision: "unknown", reason: "moderation_response_invalid" };
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const value = JSON.parse(cleaned) as { safe?: unknown; reason?: unknown };
    if (typeof value.safe !== "boolean") return { decision: "unknown", reason: "moderation_decision_missing" };
    return {
      decision: value.safe ? "safe" : "gore",
      reason: typeof value.reason === "string" ? value.reason.slice(0, 200) : "",
    };
  } catch {
    return { decision: "unknown", reason: "moderation_response_invalid" };
  }
}

/** KIE Gemini multimodal review. Unknown responses fail closed and are never treated as approval. */
export async function moderateZcvVideo(apiKey: string, videoUrl: string): Promise<ZcvModerationResult> {
  let response: Response;
  try {
    response = await fetch("https://api.kie.ai/gemini-4-argon-openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: [
          { type: "text", text: REVIEW_PROMPT },
          { type: "image_url", image_url: { url: videoUrl } },
        ] }],
        stream: false,
        reasoning_effort: "low",
        max_tokens: 96,
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    return {
      decision: "unknown",
      reason: error instanceof Error ? error.message.slice(0, 200) : "moderation_request_uncertain",
      providerCreditsConsumed: null,
    };
  }
  const body = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: unknown } }>;
    credits_consumed?: unknown;
  } | null;
  if (!response.ok || !body) {
    return { decision: "unknown", reason: `moderation_http_${response.status}`, providerCreditsConsumed: null };
  }
  const parsed = parseDecision(body.choices?.[0]?.message?.content);
  const credits = typeof body.credits_consumed === "number" && Number.isFinite(body.credits_consumed)
    ? body.credits_consumed
    : null;
  return { ...parsed, providerCreditsConsumed: credits };
}
