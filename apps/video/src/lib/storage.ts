import { s3mini } from "s3mini";

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicDomain?: string;
}

/**
 * Environment variables required for storage to be usable.
 * Access/secret keys must be provided via `wrangler secret put` in production.
 */
export const STORAGE_REQUIRED_VARS = [
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
] as const;

export type StorageConfigResult =
  | { ok: true; config: StorageConfig }
  | { ok: false; missing: string[] };

/** Trim a raw env value, treating empty/whitespace-only strings as unset. */
function readEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolve storage configuration from an env-like record.
 * Returns the missing variable NAMES (never their values) when incomplete.
 */
export function getStorageConfig(
  env: Record<string, string | undefined> = process.env
): StorageConfigResult {
  const endpoint = readEnv(env.STORAGE_ENDPOINT);
  const accessKeyId = readEnv(env.STORAGE_ACCESS_KEY);
  const secretAccessKey = readEnv(env.STORAGE_SECRET_KEY);
  const bucket = readEnv(env.STORAGE_BUCKET);

  const missing: string[] = [];
  if (!endpoint || !isHttpsUrl(endpoint)) missing.push("STORAGE_ENDPOINT");
  if (!accessKeyId) missing.push("STORAGE_ACCESS_KEY");
  if (!secretAccessKey) missing.push("STORAGE_SECRET_KEY");
  if (!bucket) missing.push("STORAGE_BUCKET");

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return {
    ok: true,
    config: {
      endpoint: endpoint as string,
      region: readEnv(env.STORAGE_REGION) ?? "auto",
      accessKeyId: accessKeyId as string,
      secretAccessKey: secretAccessKey as string,
      bucket: bucket as string,
      publicDomain: readEnv(env.STORAGE_DOMAIN),
    },
  };
}

export function isStorageConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return getStorageConfig(env).ok;
}

export class StorageNotConfiguredError extends Error {
  constructor(public missing: string[]) {
    super(
      `Storage is not configured. Missing environment variables: ${missing.join(
        ", "
      )}`
    );
    this.name = "StorageNotConfiguredError";
  }
}

export class Storage {
  private client: s3mini;
  private endpointWithBucket: string;
  private publicDomain?: string;

  constructor(config: StorageConfig) {
    const endpoint = config.endpoint.replace(/\/$/, "");
    this.endpointWithBucket = `${endpoint}/${config.bucket}`;
    this.publicDomain = config.publicDomain?.replace(/\/$/, "");

    this.client = new s3mini({
      endpoint: this.endpointWithBucket,
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    });
  }

  /**
   * 上传文件到 R2/S3
   */
  async uploadFile(params: {
    key: string;
    body: Buffer;
    contentType?: string;
  }): Promise<{ url: string; key: string }> {
    const response = await this.client.putObject(
      params.key,
      params.body,
      params.contentType || "application/octet-stream"
    );

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return { url: this.getPublicUrl(params.key), key: params.key };
  }

  /**
   * 从 URL 下载文件并上传到 R2/S3
   */
  async downloadAndUpload(params: {
    sourceUrl: string;
    key: string;
    contentType?: string;
  }): Promise<{ url: string; key: string }> {
    const response = await fetch(params.sourceUrl);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType =
      params.contentType ||
      response.headers.get("content-type") ||
      "video/mp4";

    return this.uploadFile({
      key: params.key,
      body: buffer,
      contentType,
    });
  }

  /**
   * 获取公开 URL
   */
  getPublicUrl(key: string): string {
    if (this.publicDomain) {
      return `${this.publicDomain}/${key}`;
    }
    return `${this.endpointWithBucket}/${key}`;
  }
}

// 单例工厂
let storageInstance: Storage | null = null;

export function getStorage(): Storage {
  if (!storageInstance) {
    const result = getStorageConfig();

    if (!result.ok) {
      throw new StorageNotConfiguredError(result.missing);
    }

    storageInstance = new Storage(result.config);
  }
  return storageInstance;
}

/** Test-only helper: clears the cached singleton. */
export function resetStorageForTests(): void {
  storageInstance = null;
}
