import { createHash, createHmac } from "node:crypto";

import { s3mini } from "s3mini";

/** TTL bounds (in seconds) for presigned media URLs. */
export const SIGNED_URL_MIN_TTL = 900;
export const SIGNED_URL_MAX_TTL = 3600;
export const SIGNED_URL_DEFAULT_TTL = 900;

const SIGNING_ALGORITHM = "AWS4-HMAC-SHA256";
const SIGNING_SERVICE = "s3";
const UNSIGNED_PAYLOAD = "UNSIGNED-PAYLOAD";

export interface StorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
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

/** RFC3986 encoding: encodeURIComponent plus the characters AWS requires escaped. */
function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/** Encode each path segment of a storage key, preserving "/" separators. */
function encodeKeyPath(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildCanonicalQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([key, value]) => [encodeRfc3986(key), encodeRfc3986(value)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function deriveSigningKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string
): Buffer {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, "aws4_request");
}

/** Longest a provider download may take before the transfer is abandoned. */
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000;
/**
 * Multipart part size. R2 needs every part but the last to be the same size
 * and at least 5 MiB; 16 MiB keeps memory use small.
 */
export const MULTIPART_PART_SIZE = 16 * 1024 * 1024;

/** Reads a response body as consecutive parts of exactly `size` bytes (the last may be shorter). */
async function* readParts(response: Response, size: number): AsyncGenerator<Buffer> {
  if (!response.body) {
    const whole = Buffer.from(await response.arrayBuffer());
    for (let offset = 0; offset < whole.byteLength; offset += size) {
      yield whole.subarray(offset, offset + size);
    }
    return;
  }
  const reader = response.body.getReader();
  let pending: Buffer[] = [];
  let pendingBytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value?.byteLength) {
        pending.push(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
        pendingBytes += value.byteLength;
        while (pendingBytes >= size) {
          const joined = Buffer.concat(pending, pendingBytes);
          yield Buffer.from(joined.subarray(0, size));
          const rest = joined.subarray(size);
          pending = rest.byteLength ? [Buffer.from(rest)] : [];
          pendingBytes = rest.byteLength;
        }
      }
      if (done) break;
    }
    if (pendingBytes > 0) yield Buffer.concat(pending, pendingBytes);
  } finally {
    reader.releaseLock();
  }
}

export class Storage {
  private client: s3mini;
  private endpoint: string;
  private origin: string;
  private host: string;
  private basePath: string;
  private bucket: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(config: StorageConfig) {
    this.endpoint = config.endpoint.replace(/\/+$/, "");
    this.bucket = config.bucket;
    this.region = config.region;
    this.accessKeyId = config.accessKeyId;
    this.secretAccessKey = config.secretAccessKey;

    const endpointUrl = new URL(this.endpoint);
    this.origin = endpointUrl.origin;
    this.host = endpointUrl.host;
    this.basePath = endpointUrl.pathname.replace(/\/+$/, "");

    this.client = new s3mini({
      endpoint: `${this.endpoint}/${this.bucket}`,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
    });
  }

  /**
   * 上传文件到 R2/S3
   */
  async uploadFile(params: {
    key: string;
    body: Buffer;
    contentType?: string;
  }): Promise<{ key: string }> {
    const response = await this.client.putObject(
      params.key,
      params.body,
      params.contentType || "application/octet-stream"
    );

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return { key: params.key };
  }

  async deleteFile(key: string): Promise<void> {
    if (!(await this.client.deleteObject(key))) throw new Error("Failed to delete file");
  }

  /**
   * 从 URL 下载文件并上传到 R2/S3
   *
   * Media is streamed in fixed-size parts instead of being read into memory
   * at once: a long 4K video can be larger than a Worker's memory. Files that
   * fit in one part are stored with a single PUT, as before.
   */
  async downloadAndUpload(params: {
    sourceUrl: string;
    key: string;
    contentType?: string;
    requireNonEmpty?: boolean;
    /** Tests only: a smaller part size. */
    partSize?: number;
  }): Promise<{ key: string; fileSize: number }> {
    const response = await fetch(params.sourceUrl, {
      signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.statusText}`);
    }
    const contentType =
      params.contentType ||
      response.headers.get("content-type") ||
      "video/mp4";

    const parts = readParts(response, params.partSize ?? MULTIPART_PART_SIZE);
    const first = await parts.next();
    const firstPart = first.done ? Buffer.alloc(0) : first.value;
    const second = first.done ? first : await parts.next();

    // One part (or less): a single PUT, exactly as before.
    if (second.done) {
      if (params.requireNonEmpty && firstPart.byteLength === 0) {
        throw new Error("Cannot store an empty media download");
      }
      const uploaded = await this.uploadFile({
        key: params.key,
        body: firstPart,
        contentType,
      });
      return { ...uploaded, fileSize: firstPart.byteLength };
    }

    const uploadId = await this.client.getMultipartUploadId(params.key, contentType);
    try {
      const uploadedParts = [
        await this.client.uploadPart(params.key, uploadId, firstPart, 1),
        await this.client.uploadPart(params.key, uploadId, second.value, 2),
      ];
      let fileSize = firstPart.byteLength + second.value.byteLength;
      for (let next = await parts.next(); !next.done; next = await parts.next()) {
        uploadedParts.push(
          await this.client.uploadPart(params.key, uploadId, next.value, uploadedParts.length + 1)
        );
        fileSize += next.value.byteLength;
      }
      await this.client.completeMultipartUpload(params.key, uploadId, uploadedParts);
      return { key: params.key, fileSize };
    } catch (error) {
      await parts.return(undefined).catch(() => undefined);
      await this.client.abortMultipartUpload(params.key, uploadId).catch(() => undefined);
      throw error;
    }
  }

  /**
   * Build an AWS SigV4 presigned GET URL (query-string auth) for a private object.
   * The object is only reachable for `ttlSeconds` (15-60 minutes).
   */
  getSignedUrl(
    key: string,
    ttlSeconds: number = SIGNED_URL_DEFAULT_TTL,
    now: Date = new Date()
  ): string {
    return this.presign("GET", key, ttlSeconds, now);
  }

  /** Inspect the stored object without downloading it or following redirects. */
  async getObjectSize(key: string): Promise<number> {
    const url = this.presign("HEAD", key, SIGNED_URL_DEFAULT_TTL, new Date());
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const length = response.headers.get("content-length");
    if (response.status !== 200 || !length || !/^\d+$/.test(length) || !Number.isSafeInteger(Number(length))) {
      throw new Error("Storage did not return a valid object size");
    }
    return Number(length);
  }

  private presign(method: "GET" | "HEAD", key: string, ttlSeconds: number, now: Date): string {
    if (ttlSeconds < SIGNED_URL_MIN_TTL || ttlSeconds > SIGNED_URL_MAX_TTL) {
      throw new RangeError(
        `Signed URL TTL must be between ${SIGNED_URL_MIN_TTL} and ${SIGNED_URL_MAX_TTL} seconds`
      );
    }

    const amzDate = formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.region}/${SIGNING_SERVICE}/aws4_request`;
    const canonicalUri = `${this.basePath}/${this.bucket}/${encodeKeyPath(key)}`;

    const canonicalQuery = buildCanonicalQuery({
      "X-Amz-Algorithm": SIGNING_ALGORITHM,
      "X-Amz-Credential": `${this.accessKeyId}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(ttlSeconds),
      "X-Amz-SignedHeaders": "host",
    });

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      `host:${this.host}`,
      "",
      "host",
      UNSIGNED_PAYLOAD,
    ].join("\n");

    const stringToSign = [
      SIGNING_ALGORITHM,
      amzDate,
      scope,
      sha256Hex(canonicalRequest),
    ].join("\n");

    const signingKey = deriveSigningKey(
      this.secretAccessKey,
      dateStamp,
      this.region,
      SIGNING_SERVICE
    );
    const signature = createHmac("sha256", signingKey)
      .update(stringToSign, "utf8")
      .digest("hex");

    return `${this.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }
}

/** A stored object key (as opposed to a legacy http(s) media URL). */
export function isStorageKey(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/^https?:\/\//i.test(trimmed);
}

/**
 * Shape of a client-submitted image reference backed by an upload key.
 * Canvas uploads live one level down, under uploads/<user>/canvas/.
 */
export const IMAGE_REF_PATTERN = /^uploads\/[A-Za-z0-9_-]+\/(?:canvas\/)?[A-Za-z0-9_.-]+$/;

/**
 * Resolve a stored media reference into a URL the browser can fetch.
 * - null/empty -> null
 * - legacy http(s) URL -> returned as-is
 * - storage key -> short-lived presigned URL
 */
export function signMediaRef(
  value: string | null | undefined,
  ttl: number = SIGNED_URL_DEFAULT_TTL
): string | null {
  if (!value || value.trim().length === 0) {
    return null;
  }

  if (!isStorageKey(value)) {
    return value;
  }

  return getStorage().getSignedUrl(value, ttl);
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
