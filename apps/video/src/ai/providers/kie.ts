import { ProviderRejectedError } from "../types";
import type {
  AIVideoProvider,
  VideoGenerationParams,
  VideoTaskResponse,
} from "../types";
import {
  getProviderConfig,
  getProviderModelId,
  transformParamsForProvider,
} from "../model-mapping";

/** True when a KIE status/code means no task was created. */
export function isDefiniteRejection(code: number): boolean {
  return code >= 400 && code < 500 && code !== 408;
}

export class KieProvider implements AIVideoProvider {
  name = "kie";
  supportImageToVideo = false; // kie only supports text-to-video
  private apiKey: string;
  private baseUrl = "https://api.kie.ai";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createTask(params: VideoGenerationParams): Promise<VideoTaskResponse> {
    const internalModelId = params.model || "sora-2";
    const providerConfig = getProviderConfig(internalModelId, "kie");
    if (!providerConfig?.supported) {
      // Nothing was sent to KIE, so no task can exist.
      throw new ProviderRejectedError(
        `Model ${internalModelId} is not supported by KIE`
      );
    }
    const apiEndpoint = providerConfig.apiEndpoint || "/api/v1/jobs/createTask";

    const providerModelId = getProviderModelId(
      internalModelId,
      "kie",
      params
    );
    const transformedParams = transformParamsForProvider(
      internalModelId,
      "kie",
      params
    );

    const body: Record<string, any> = {
      ...transformedParams,
      model: providerModelId,
    };
    if (params.callbackUrl && body.callBackUrl === undefined) {
      body.callBackUrl = params.callbackUrl;
    }

    const response = await fetch(`${this.baseUrl}${apiEndpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    // KIE reports errors as a JSON body `{ code, msg }`; the HTTP status may
    // or may not mirror `code`. A body that cannot be parsed leaves only the
    // HTTP status to go on.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = null;
    try {
      result = await response.json();
    } catch {
      result = null;
    }

    const code =
      typeof result?.code === "number" ? result.code : response.status;

    if (code !== 200 || !result?.data?.taskId) {
      const message = result?.msg || `KIE API error: ${code}`;
      // 4xx (except 408 Request Timeout) means KIE definitely rejected the
      // request and created no task: validation, auth, balance, rate limit.
      // Callers release the user's held credits on this error. Everything
      // else (5xx, 408, a 200 without a taskId) is an unknown outcome.
      if (isDefiniteRejection(code)) {
        throw new ProviderRejectedError(message, code);
      }
      throw new Error(message);
    }

    return {
      taskId: result.data.taskId,
      provider: "kie",
      status: "pending",
      raw: result,
    };
  }

  async getTaskStatus(taskId: string): Promise<VideoTaskResponse> {
    if (this.isVeoTaskId(taskId)) {
      return this.getVeoTaskStatus(taskId);
    }

    const response = await fetch(
      `${this.baseUrl}/api/v1/jobs/recordInfo?taskId=${taskId}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );

    const result = await response.json();
    if (result.code !== 200) throw new Error(result.msg);

    const data = result.data;
    const resultUrls =
      data.state === "success" ? this.parseResultUrls(data.resultJson, data.response) : [];

    return {
      taskId: data.taskId,
      provider: "kie",
      status: this.mapStatus(data.state),
      videoUrl: resultUrls[0],
      resultUrls,
      error: data.failCode
        ? { code: data.failCode, message: data.failMsg }
        : undefined,
      raw: data,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseCallback(payload: any): VideoTaskResponse {
    const data = payload.data || payload;

    // Suno music/sound/speech callbacks: {code, data:{callbackType, task_id, data:[tracks]}}.
    if (data && typeof data.callbackType === "string") {
      return this.parseSunoCallback(payload);
    }

    if (data?.info?.resultUrls || payload?.data?.info?.resultUrls) {
      return this.parseVeoCallback(payload);
    }

    const resultUrls =
      data.state === "success" ? this.parseResultUrls(data.resultJson, data.response) : [];

    return {
      taskId: data.taskId,
      provider: "kie",
      status: this.mapStatus(data.state),
      videoUrl: resultUrls[0],
      resultUrls,
      error: data.failCode
        ? { code: data.failCode, message: data.failMsg }
        : undefined,
      raw: data,
    };
  }

  private mapStatus(state: string): VideoTaskResponse["status"] {
    const map: Record<string, VideoTaskResponse["status"]> = {
      waiting: "pending",
      success: "completed",
      fail: "failed",
    };
    return map[state] || "pending";
  }

  private isVeoTaskId(taskId: string): boolean {
    return taskId.startsWith("veo_task_");
  }

  /**
   * All output URLs from a market task (image sets can return several).
   * Most models put them in resultJson.resultUrls; Suno lists tracks with an
   * audio_url under response.data (or resultJson.data).
   */
  private parseResultUrls(resultJson: unknown, response?: unknown): string[] {
    const strings = (list: unknown): string[] =>
      Array.isArray(list) ? list.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
    const tracks = (value: unknown): string[] => {
      const list = (value as { data?: unknown })?.data;
      return Array.isArray(list)
        ? list
            .map((track) => (track as { audio_url?: unknown })?.audio_url)
            .filter((url): url is string => typeof url === "string" && url.length > 0)
        : [];
    };
    try {
      const parsed = typeof resultJson === "string" ? JSON.parse(resultJson) : resultJson;
      const urls = (parsed as { resultUrls?: unknown })?.resultUrls;
      const list = strings(typeof urls === "string" ? JSON.parse(urls) : urls);
      if (list.length > 0) return list;
      const fromTracks = tracks(parsed);
      if (fromTracks.length > 0) return fromTracks;
    } catch (error) {
      console.error("Failed to parse KIE resultJson:", error);
    }
    const fromResponse = strings((response as { resultUrls?: unknown })?.resultUrls);
    return fromResponse.length > 0 ? fromResponse : tracks(response);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseSunoCallback(payload: any): VideoTaskResponse {
    const data = payload.data || {};
    const urls = this.parseResultUrls(null, data);
    const failed = payload.code !== 200;
    // "text" and "first" are progress updates; only "complete" carries every track.
    const done = data.callbackType === "complete" && urls.length > 0;
    return {
      taskId: data.task_id || data.taskId,
      provider: "kie",
      status: failed ? "failed" : done ? "completed" : "processing",
      videoUrl: done ? urls[0] : undefined,
      resultUrls: done ? urls : undefined,
      error: failed ? { code: String(payload.code), message: payload.msg || "Generation failed" } : undefined,
      raw: payload,
    };
  }

  private pickFirstUrl(value: unknown): string | undefined {
    if (Array.isArray(value)) {
      return value[0];
    }
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed[0];
        }
      } catch {
        // fall through
      }
    }
    return undefined;
  }

  private mapVeoStatus(flag: number | undefined): VideoTaskResponse["status"] {
    if (flag === 1) return "completed";
    if (flag === 2 || flag === 3) return "failed";
    return "processing";
  }

  private async getVeoTaskStatus(taskId: string): Promise<VideoTaskResponse> {
    const response = await fetch(
      `${this.baseUrl}/api/v1/veo/record-info?taskId=${taskId}`,
      { headers: { Authorization: `Bearer ${this.apiKey}` } }
    );

    const result = await response.json();
    if (result.code !== 200) throw new Error(result.msg || "API error");

    const data = result.data || {};
    const status = this.mapVeoStatus(data.successFlag);
    const videoUrl = this.pickFirstUrl(data.response?.resultUrls);

    return {
      taskId: data.taskId || taskId,
      provider: "kie",
      status,
      videoUrl,
      error: data.errorMessage
        ? { code: String(data.errorCode || "VEO_ERROR"), message: data.errorMessage }
        : undefined,
      raw: data,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseVeoCallback(payload: any): VideoTaskResponse {
    const data = payload.data || payload;
    const info = data.info || {};
    const videoUrl = this.pickFirstUrl(info.resultUrls);
    const status =
      payload.code === 200 && videoUrl ? "completed" : "failed";

    return {
      taskId: data.taskId,
      provider: "kie",
      status,
      videoUrl,
      error:
        payload.code && payload.code !== 200
          ? { code: String(payload.code), message: payload.msg || "Veo task failed" }
          : undefined,
      raw: payload,
    };
  }
}
