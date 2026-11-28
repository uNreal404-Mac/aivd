// AI Video Provider Types

export type ProviderType = "evolink" | "kie" | "apimart";

/**
 * Thrown when the provider DEFINITELY did not create a task
 * (e.g. HTTP 4xx validation/auth/quota response).
 *
 * Anything else thrown by createTask (timeouts, network errors, 5xx,
 * parse errors) is an UNKNOWN result: the provider may have accepted
 * (and may charge for) the task.
 */
export class ProviderRejectedError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ProviderRejectedError";
    this.status = status;
  }
}

// Unified video generation parameters
export interface VideoGenerationParams {
  model?: string;
  prompt: string;
  aspectRatio?: string;
  duration?: number;
  quality?: string;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  mode?: string;
  outputNumber?: number;
  generateAudio?: boolean;
  removeWatermark?: boolean;
  callbackUrl?: string;
}

// Unified task response
export interface VideoTaskResponse {
  taskId: string;
  provider: ProviderType;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  estimatedTime?: number;
  videoUrl?: string;
  /** Every output URL, for tasks that return more than one (image sets). */
  resultUrls?: string[];
  thumbnailUrl?: string;
  error?: {
    code: string;
    message: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw?: any;
}

// Provider interface
export interface AIVideoProvider {
  name: string;
  supportImageToVideo: boolean;
  createTask(params: VideoGenerationParams): Promise<VideoTaskResponse>;
  getTaskStatus(taskId: string): Promise<VideoTaskResponse>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  parseCallback(payload: any): VideoTaskResponse;
}
