import { ProviderRejectedError } from "../types";
import { requireProviderApiKey } from "../provider-config";
import { SUNO_MODEL_VERSION } from "@/config/media-pricing";

export interface KieMediaResult {
  taskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  urls: string[];
  thumbnailUrl?: string;
  error?: { code: string; message: string };
  stage?: string;
}

/**
 * kie.ai client for non-video media (market image models + Suno music).
 *
 * Create-call error semantics intentionally mirror `KieProvider.createTask`:
 * definite 4xx rejections throw `ProviderRejectedError`; everything else
 * (5xx, unparseable bodies, unexpected payloads) throws a plain Error and is
 * treated as an UNKNOWN submission outcome by callers.
 */
export class KieMediaClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl = "https://api.kie.ai") {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async createImageTask(p: {
    kieModel: string;
    prompt: string;
    imageUrls?: string[];
    aspectRatio?: string;
    callbackUrl?: string;
  }): Promise<{ taskId: string }> {
    const input: Record<string, unknown> = {
      prompt: p.prompt,
      output_format: "png",
      aspect_ratio: p.aspectRatio ?? "1:1",
    };
    if (p.imageUrls?.length) {
      input.image_urls = p.imageUrls;
    }

    const body: Record<string, unknown> = {
      model: p.kieModel,
      input,
    };
    if (p.callbackUrl) {
      body.callBackUrl = p.callbackUrl;
    }

    return this.createTask(body);
  }

  async createMusicTask(p: {
    prompt: string;
    instrumental?: boolean;
    style?: string;
    title?: string;
    callbackUrl?: string;
  }): Promise<{ taskId: string }> {
    const instrumental = Boolean(p.instrumental);
    const style = p.style?.trim();
    const title = p.title?.trim();

    let input: Record<string, unknown>;
    if (style && title) {
      // Custom mode: the caller provides title + style (and lyrics unless
      // the track is instrumental).
      input = {
        custom_mode: true,
        instrumental,
        model: SUNO_MODEL_VERSION,
        title,
        style,
        ...(instrumental ? {} : { lyrics: p.prompt }),
      };
    } else {
      input = {
        custom_mode: false,
        instrumental,
        model: SUNO_MODEL_VERSION,
        prompt: p.prompt.slice(0, 3000),
        ...(style ? { style } : {}),
      };
    }

    const body: Record<string, unknown> = {
      model: "ai-music-api/generate",
      input,
    };
    if (p.callbackUrl) {
      body.callBackUrl = p.callbackUrl;
    }

    return this.createTask(body);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseImageCallback(payload: any): KieMediaResult {
    const data = payload?.data ?? {};
    const code = payload?.code;
    const msg = payload?.msg;
    const taskId = String(data?.taskId ?? "");
    const state = data?.state;

    if (state === "success") {
      return {
        taskId,
        status: "completed",
        urls: this.parseResultUrls(data?.resultJson),
      };
    }

    if (state === "fail" || code === 501) {
      return {
        taskId,
        status: "failed",
        urls: [],
        error: {
          code:
            data?.failCode !== undefined && data?.failCode !== null
              ? String(data.failCode)
              : String(code),
          message:
            (typeof data?.failMsg === "string" && data.failMsg) ||
            (typeof msg === "string" && msg) ||
            "Image generation failed",
        },
      };
    }

    return { taskId, status: "processing", urls: [] };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseMusicCallback(payload: any): KieMediaResult {
    const data = payload?.data ?? {};
    const code = payload?.code;
    const msg = payload?.msg;
    const callbackType = data?.callbackType;
    const taskId = String(data?.task_id ?? data?.taskId ?? "");
    const items = Array.isArray(data?.data) ? data.data : [];

    if ((typeof code === "number" && code !== 200) || callbackType === "error") {
      return {
        taskId,
        status: "failed",
        urls: [],
        error: {
          code: String(code ?? "ERROR"),
          message:
            (typeof msg === "string" && msg) ||
            (typeof data?.msg === "string" && data.msg) ||
            "Music generation failed",
        },
      };
    }

    if (callbackType === "complete") {
      const urls: string[] = [];
      for (const item of items) {
        const audioUrl = item?.audio_url;
        if (typeof audioUrl === "string" && audioUrl.length > 0) {
          urls.push(audioUrl);
        }
      }

      if (urls.length === 0) {
        return {
          taskId,
          status: "failed",
          urls: [],
          error: { code: "NO_AUDIO", message: "Suno completed without audio" },
        };
      }

      const imageUrl = items[0]?.image_url;
      return {
        taskId,
        status: "completed",
        urls,
        thumbnailUrl:
          typeof imageUrl === "string" && imageUrl.length > 0
            ? imageUrl
            : undefined,
      };
    }

    // "text", "first" and anything else are progress notifications only.
    // Only the final "complete" callback settles credits.
    return {
      taskId,
      status: "processing",
      urls: [],
      stage: typeof callbackType === "string" ? callbackType : undefined,
    };
  }

  async getTaskStatus(
    taskId: string,
    mediaType: "image" | "audio"
  ): Promise<KieMediaResult> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${encodeURIComponent(taskId)}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new Error("Failed to parse KIE response");
    }

    if (result?.code !== 200) {
      throw new Error(result?.msg || "API error");
    }

    const data = result?.data ?? {};
    const resolvedTaskId = String(data?.taskId ?? taskId);

    if (data?.state === "success") {
      if (mediaType === "image") {
        return {
          taskId: resolvedTaskId,
          status: "completed",
          urls: this.parseResultUrls(data?.resultJson),
        };
      }

      const urls = this.extractAudioUrls(data?.response);
      if (urls.length === 0) {
        // A successful poll without tracks is not a completion yet.
        return { taskId: resolvedTaskId, status: "processing", urls: [] };
      }
      return { taskId: resolvedTaskId, status: "completed", urls };
    }

    if (data?.state === "fail") {
      return {
        taskId: resolvedTaskId,
        status: "failed",
        urls: [],
        error: {
          code:
            data?.failCode !== undefined && data?.failCode !== null
              ? String(data.failCode)
              : "FAILED",
          message:
            (typeof data?.failMsg === "string" && data.failMsg) ||
            "Generation failed",
        },
      };
    }

    return { taskId: resolvedTaskId, status: "processing", urls: [] };
  }

  private async createTask(
    body: Record<string, unknown>
  ): Promise<{ taskId: string }> {
    const response = await fetch(`${this.baseUrl}/api/v1/jobs/createTask`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const status = response.status;
      if (status >= 400 && status < 500 && status !== 408) {
        let message = response.statusText || `KIE HTTP ${status}`;
        try {
          const errJson = await response.json();
          if (
            errJson &&
            typeof errJson.msg === "string" &&
            errJson.msg.length > 0
          ) {
            message = errJson.msg;
          }
        } catch {
          // fall back to status text
        }
        throw new ProviderRejectedError(message, status);
      }
      throw new Error(`KIE HTTP ${status}`);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any;
    try {
      result = await response.json();
    } catch {
      throw new Error("Failed to parse KIE response");
    }

    const code = result?.code;
    if (typeof code === "number" && code >= 400 && code < 500 && code !== 408) {
      throw new ProviderRejectedError(result.msg || `KIE error ${code}`, code);
    }

    if (code !== 200) {
      throw new Error(result?.msg || "API error");
    }

    const taskId = result?.data?.taskId;
    if (!taskId) {
      throw new Error("KIE response missing taskId");
    }

    return { taskId: String(taskId) };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseResultUrls(resultJson: any): string[] {
    if (!resultJson) return [];

    let parsed: unknown = resultJson;
    if (typeof resultJson === "string") {
      try {
        parsed = JSON.parse(resultJson);
      } catch {
        return [];
      }
    }

    const urls = (parsed as { resultUrls?: unknown } | null)?.resultUrls;
    if (!Array.isArray(urls)) return [];

    return urls.filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private extractAudioUrls(response: any): string[] {
    const urls: string[] = [];

    const tracks = Array.isArray(response?.data) ? response.data : [];
    for (const track of tracks) {
      const audioUrl = track?.audio_url;
      if (typeof audioUrl === "string" && audioUrl.length > 0) {
        urls.push(audioUrl);
      }
    }

    if (urls.length === 0) {
      const suno = Array.isArray(response?.sunoData) ? response.sunoData : [];
      for (const track of suno) {
        const audioUrl = track?.audioUrl ?? track?.audio_url;
        if (typeof audioUrl === "string" && audioUrl.length > 0) {
          urls.push(audioUrl);
        }
      }
    }

    return urls;
  }
}

let cachedClient: KieMediaClient | null = null;

export function getKieMediaClient(): KieMediaClient {
  if (!cachedClient) {
    cachedClient = new KieMediaClient(requireProviderApiKey("kie"));
  }
  return cachedClient;
}
