// TEST/DEV ONLY — never reachable in production (see getProvider gate)

import { nanoid } from "nanoid";
import type {
  AIVideoProvider,
  ProviderType,
  VideoGenerationParams,
  VideoTaskResponse,
} from "../types";
import { ProviderRejectedError } from "../types";

type MockScenario = "ok" | "fail";

const TASK_ID_PREFIX = "mock_";

export class MockVideoProvider implements AIVideoProvider {
  name = "mock";
  supportImageToVideo = true;
  private providerType: ProviderType;

  constructor(providerType: ProviderType) {
    this.providerType = providerType;
  }

  async createTask(params: VideoGenerationParams): Promise<VideoTaskResponse> {
    const prompt = params.prompt ?? "";

    if (prompt.includes("[mock:reject]")) {
      throw new ProviderRejectedError("Mock provider rejected the request", 400);
    }

    if (prompt.includes("[mock:unknown]")) {
      throw Object.assign(
        new Error(
          "Mock provider: request timed out after it may have been accepted"
        ),
        { name: "TimeoutError" }
      );
    }

    const scenario: MockScenario = prompt.includes("[mock:fail]")
      ? "fail"
      : "ok";

    const delaySeconds = Math.round(this.getDelayMs() / 1000);

    return {
      taskId: `${TASK_ID_PREFIX}${scenario}_${Date.now()}_${nanoid(8)}`,
      provider: this.providerType,
      status: "pending",
      estimatedTime: delaySeconds,
    };
  }

  async getTaskStatus(taskId: string): Promise<VideoTaskResponse> {
    const parsed = this.parseTaskId(taskId);
    const delay = this.getDelayMs();
    const elapsed = Date.now() - parsed.createdAt;

    if (elapsed < delay) {
      const progress = Math.min(
        99,
        Math.max(0, Math.floor((elapsed / delay) * 100))
      );
      return {
        taskId,
        provider: this.providerType,
        status: "processing",
        progress,
      };
    }

    if (parsed.scenario === "fail") {
      return {
        taskId,
        provider: this.providerType,
        status: "failed",
        error: {
          code: "MOCK_FAILED",
          message: "Mock provider simulated a generation failure",
        },
      };
    }

    const videoUrl = process.env.MOCK_VIDEO_SOURCE_URL;
    if (!videoUrl) {
      throw new Error(
        "MOCK_VIDEO_SOURCE_URL is required when using the mock video provider"
      );
    }

    return {
      taskId,
      provider: this.providerType,
      status: "completed",
      progress: 100,
      videoUrl,
      thumbnailUrl: process.env.MOCK_VIDEO_THUMBNAIL_URL,
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseCallback(payload: any): VideoTaskResponse {
    const status = this.mapStatus(payload?.status);
    return {
      taskId: payload?.taskId,
      provider: this.providerType,
      status,
      videoUrl: payload?.videoUrl,
      error: payload?.error,
      raw: payload,
    };
  }

  private getDelayMs(): number {
    const raw = process.env.MOCK_VIDEO_DELAY_MS;
    const parsed = raw ? Number(raw) : Number.NaN;
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 4000;
  }

  private parseTaskId(taskId: string): {
    scenario: MockScenario;
    createdAt: number;
  } {
    const parts = taskId.split("_");
    // Format: mock_<scenario>_<createdAt>_<nanoid>
    const scenario: MockScenario = parts[1] === "fail" ? "fail" : "ok";
    const createdAt = Number(parts[2]);
    return {
      scenario,
      createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
    };
  }

  private mapStatus(status: unknown): VideoTaskResponse["status"] {
    const map: Record<string, VideoTaskResponse["status"]> = {
      pending: "pending",
      processing: "processing",
      completed: "completed",
      failed: "failed",
      cancelled: "failed",
    };
    return typeof status === "string" ? map[status] || "pending" : "pending";
  }
}
