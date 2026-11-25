// Network helpers for the node canvas. Generation goes only through our own
// /api/v1/media/generate and /api/v1/video/generate (credits frozen and
// settled, content checked and results stored there).

export type GenerationAnswer =
  | { kind: "ok"; uuid: string }
  | { kind: "unauthorized" }
  /** A definite answer that nothing was started (or not by this request). */
  | { kind: "rejected"; code?: string; message: string; requiredCredits?: number }
  /** No usable answer: the job may exist. Retry under the same key. */
  | { kind: "lost"; message?: string };

type Payload = {
  success?: boolean;
  data?: { videoUuid?: string | null; status?: string | null; errorMessage?: string | null } | null;
  error?: { message?: unknown; details?: { code?: unknown; requiredCredits?: unknown; videoUuid?: unknown } | null } | null;
};

export async function postGeneration(
  endpoint: "/api/v1/media/generate" | "/api/v1/video/generate",
  body: Record<string, unknown>,
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<GenerationAnswer> {
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "lost" };
  }
  if (response.status === 401) return { kind: "unauthorized" };
  let payload: Payload | null = null;
  try {
    payload = (await response.json()) as Payload;
  } catch {
    return { kind: "lost" };
  }
  const uuid = payload?.data?.videoUuid ?? (typeof payload?.error?.details?.videoUuid === "string" ? payload.error.details.videoUuid : null);
  if (payload?.success && payload?.data?.status === "FAILED") {
    const rawError = typeof payload.data.errorMessage === "string" ? payload.data.errorMessage : "";
    const creditMatch = /\bInsufficient credits\.\s*Required:\s*(\d+)/i.exec(rawError);
    if (creditMatch || /insufficient credits/i.test(rawError)) {
      return {
        kind: "rejected",
        code: "INSUFFICIENT_CREDITS",
        message: rawError || "Insufficient credits",
        ...(creditMatch ? { requiredCredits: Number(creditMatch[1]) } : {}),
      };
    }
    return { kind: "rejected", code: "GENERATION_FAILED", message: rawError || "Generation failed" };
  }
  if (payload?.success && uuid) return { kind: "ok", uuid };
  if (response.status === 202 && uuid) return { kind: "ok", uuid };
  const code = typeof payload?.error?.details?.code === "string" ? payload.error.details.code : undefined;
  const message = typeof payload?.error?.message === "string" ? payload.error.message : "";
  // A server error may come after the job was created; only a 4xx (or the
  // preview's "generation off" answer) is a definite no.
  if (response.status >= 500 && code !== "GENERATION_DISABLED") return { kind: "lost", message };
  const requiredCredits = typeof payload?.error?.details?.requiredCredits === "number" ? payload.error.details.requiredCredits : undefined;
  return { kind: "rejected", message, ...(code ? { code } : {}), ...(requiredCredits !== undefined ? { requiredCredits } : {}) };
}

export type ResolvedResult = { status: string; urls: string[]; mediaType?: string; error?: string };
export type Resolved = { results: Record<string, ResolvedResult>; assets: Record<string, string> };

/** Fresh display URLs for saved references, in one request. */
export async function resolveMedia(uuids: string[], keys: string[], fetchImpl: typeof fetch = fetch): Promise<Resolved> {
  const empty: Resolved = { results: {}, assets: {} };
  const unique = (list: string[]) => [...new Set(list.filter(Boolean))].slice(0, 200);
  const body = { uuids: unique(uuids), keys: unique(keys) };
  if (!body.uuids.length && !body.keys.length) return empty;
  try {
    const response = await fetchImpl("/api/v1/creative-space/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return empty;
    const payload = await response.json();
    return payload?.success ? (payload.data as Resolved) : empty;
  } catch {
    return empty;
  }
}

/** Status of one job; also advances it on the server (provider poll). */
export async function jobStatus(uuid: string, fetchImpl: typeof fetch = fetch): Promise<ResolvedResult | null> {
  try {
    const response = await fetchImpl(`/api/v1/video/${encodeURIComponent(uuid)}/status`, { cache: "no-store" });
    if (response.status !== 200) return null;
    const payload = await response.json();
    const data = payload?.data;
    if (!data || typeof data.status !== "string") return null;
    const urls: string[] = Array.isArray(data.mediaUrls) ? data.mediaUrls : data.videoUrl ? [data.videoUrl] : [];
    return { status: data.status, urls, ...(typeof data.error === "string" ? { error: data.error } : {}) };
  } catch {
    return null;
  }
}
