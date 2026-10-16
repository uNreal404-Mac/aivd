import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  SIGNED_URL_DEFAULT_TTL,
  SIGNED_URL_MAX_TTL,
  SIGNED_URL_MIN_TTL,
  STORAGE_REQUIRED_VARS,
  Storage,
  StorageNotConfiguredError,
  getStorage,
  getStorageConfig,
  isStorageConfigured,
  isStorageKey,
  resetStorageForTests,
  signMediaRef,
} from "../src/lib/storage";

const STORAGE_ENV_KEYS = [
  "STORAGE_ENDPOINT",
  "STORAGE_REGION",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
] as const;

const R2_ENDPOINT =
  "https://3d16103f94443a1948212feedf4ddcc1.r2.cloudflarestorage.com";
const R2_HOST = new URL(R2_ENDPOINT).host;

const VALID_ENV: Record<string, string | undefined> = {
  STORAGE_ENDPOINT: R2_ENDPOINT,
  STORAGE_ACCESS_KEY: "access-key-id",
  STORAGE_SECRET_KEY: "secret-access-key",
  STORAGE_BUCKET: "dreamutopia-video-media",
};

describe("getStorageConfig", () => {
  it("returns an ok config with region defaulting to auto", () => {
    const result = getStorageConfig(VALID_ENV);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected an ok result");
    }

    expect(result.config.region).toBe("auto");
    expect(result.config.endpoint).toBe(R2_ENDPOINT);
    expect(result.config.accessKeyId).toBe("access-key-id");
    expect(result.config.secretAccessKey).toBe("secret-access-key");
    expect(result.config.bucket).toBe("dreamutopia-video-media");
  });

  it("trims values and honours STORAGE_REGION", () => {
    const result = getStorageConfig({
      ...VALID_ENV,
      STORAGE_ENDPOINT: `  ${R2_ENDPOINT}  `,
      STORAGE_REGION: "  eu-west-1 ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected an ok result");
    }

    expect(result.config.endpoint).toBe(R2_ENDPOINT);
    expect(result.config.region).toBe("eu-west-1");
  });

  it("reports a missing access key", () => {
    const result = getStorageConfig({
      ...VALID_ENV,
      STORAGE_ACCESS_KEY: undefined,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected a failed result");
    }
    expect(result.missing).toContain("STORAGE_ACCESS_KEY");
  });

  it("treats a whitespace-only bucket as missing", () => {
    const result = getStorageConfig({ ...VALID_ENV, STORAGE_BUCKET: "   " });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected a failed result");
    }
    expect(result.missing).toContain("STORAGE_BUCKET");
  });

  it("rejects a non-https endpoint", () => {
    const result = getStorageConfig({
      ...VALID_ENV,
      STORAGE_ENDPOINT: "http://account.r2.cloudflarestorage.com",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected a failed result");
    }
    expect(result.missing).toContain("STORAGE_ENDPOINT");
  });

  it("lists every required variable for an empty env", () => {
    const result = getStorageConfig({});

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected a failed result");
    }
    expect(result.missing).toEqual([...STORAGE_REQUIRED_VARS]);
  });
});

describe("isStorageConfigured", () => {
  it("is false for an empty env and true for a complete one", () => {
    expect(isStorageConfigured({})).toBe(false);
    expect(isStorageConfigured(VALID_ENV)).toBe(true);
  });
});

describe("getStorage", () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of STORAGE_ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
      Reflect.deleteProperty(process.env, key);
    }
    resetStorageForTests();
  });

  afterEach(() => {
    for (const key of STORAGE_ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
    originalEnv.clear();
    resetStorageForTests();
  });

  it("throws StorageNotConfiguredError when env vars are absent", () => {
    try {
      getStorage();
      throw new Error("expected getStorage to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(StorageNotConfiguredError);
      const notConfigured = error as StorageNotConfiguredError;
      expect(notConfigured.missing).toEqual([...STORAGE_REQUIRED_VARS]);
      expect(notConfigured.message).toContain("STORAGE_ENDPOINT");
    }
  });

  it("never leaks secret values in the error message", () => {
    process.env.STORAGE_ACCESS_KEY = "super-secret-value";

    try {
      getStorage();
      throw new Error("expected getStorage to throw");
    } catch (error) {
      expect((error as Error).message).not.toContain("super-secret-value");
    }
  });

  it("returns the same singleton once configured", () => {
    process.env.STORAGE_ENDPOINT = VALID_ENV.STORAGE_ENDPOINT;
    process.env.STORAGE_ACCESS_KEY = VALID_ENV.STORAGE_ACCESS_KEY;
    process.env.STORAGE_SECRET_KEY = VALID_ENV.STORAGE_SECRET_KEY;
    process.env.STORAGE_BUCKET = VALID_ENV.STORAGE_BUCKET;

    expect(getStorage()).toBe(getStorage());
  });
});

describe("Storage.getSignedUrl", () => {
  const baseConfig = {
    endpoint: R2_ENDPOINT,
    region: "auto",
    accessKeyId: "access-key-id",
    secretAccessKey: "secret-access-key",
    bucket: "dreamutopia-video-media",
  };

  const FIXED_NOW = new Date("2024-01-02T03:04:05.000Z");
  const KEY = "uploads/user/file.mp4";

  it("builds a path-style presigned GET URL", () => {
    const storage = new Storage(baseConfig);
    const url = new URL(
      storage.getSignedUrl(KEY, SIGNED_URL_DEFAULT_TTL, FIXED_NOW)
    );

    expect(url.protocol).toBe("https:");
    expect(url.host).toBe(R2_HOST);
    expect(url.pathname).toBe("/dreamutopia-video-media/uploads/user/file.mp4");
    expect(url.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(url.searchParams.get("X-Amz-Credential")).toBe(
      "access-key-id/20240102/auto/s3/aws4_request"
    );
    expect(url.searchParams.get("X-Amz-Date")).toBe("20240102T030405Z");
    expect(url.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe("host");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for fixed credentials and time", () => {
    const storage = new Storage(baseConfig);

    const first = storage.getSignedUrl(KEY, SIGNED_URL_DEFAULT_TTL, FIXED_NOW);
    const second = storage.getSignedUrl(KEY, SIGNED_URL_DEFAULT_TTL, FIXED_NOW);

    expect(first).toBe(second);
  });

  it("changes the signature when the object key changes", () => {
    const storage = new Storage(baseConfig);

    const first = new URL(
      storage.getSignedUrl(KEY, SIGNED_URL_DEFAULT_TTL, FIXED_NOW)
    );
    const second = new URL(
      storage.getSignedUrl("uploads/user/other.mp4", SIGNED_URL_DEFAULT_TTL, FIXED_NOW)
    );

    expect(first.searchParams.get("X-Amz-Signature")).not.toBe(
      second.searchParams.get("X-Amz-Signature")
    );
  });

  it("refuses TTLs outside the 15-60 minute window", () => {
    const storage = new Storage(baseConfig);

    expect(() => storage.getSignedUrl(KEY, 60, FIXED_NOW)).toThrow(RangeError);
    expect(() => storage.getSignedUrl(KEY, 7200, FIXED_NOW)).toThrow(RangeError);
    expect(() =>
      storage.getSignedUrl(KEY, SIGNED_URL_MIN_TTL, FIXED_NOW)
    ).not.toThrow();
    expect(() =>
      storage.getSignedUrl(KEY, SIGNED_URL_MAX_TTL, FIXED_NOW)
    ).not.toThrow();
  });
});

describe("isStorageKey", () => {
  it("accepts storage keys and rejects URLs and empty values", () => {
    expect(isStorageKey("uploads/user/file.mp4")).toBe(true);
    expect(isStorageKey("video-123.mp4")).toBe(true);
    expect(isStorageKey("https://example.com/file.mp4")).toBe(false);
    expect(isStorageKey("http://example.com/file.mp4")).toBe(false);
    expect(isStorageKey("")).toBe(false);
    expect(isStorageKey("   ")).toBe(false);
  });
});

describe("signMediaRef", () => {
  const originalEnv = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of STORAGE_ENV_KEYS) {
      originalEnv.set(key, process.env[key]);
      Reflect.deleteProperty(process.env, key);
    }
    resetStorageForTests();
  });

  afterEach(() => {
    for (const key of STORAGE_ENV_KEYS) {
      const value = originalEnv.get(key);
      if (value === undefined) {
        Reflect.deleteProperty(process.env, key);
      } else {
        process.env[key] = value;
      }
    }
    originalEnv.clear();
    resetStorageForTests();
  });

  it("returns null for null, undefined and empty values", () => {
    expect(signMediaRef(null)).toBeNull();
    expect(signMediaRef(undefined)).toBeNull();
    expect(signMediaRef("")).toBeNull();
  });

  it("returns legacy http(s) URLs unchanged", () => {
    const legacy = "https://pub-815356967201474cb205db07727e85fa.r2.dev/a.mp4";

    expect(signMediaRef(legacy)).toBe(legacy);
    expect(signMediaRef("http://example.com/a.mp4")).toBe(
      "http://example.com/a.mp4"
    );
  });

  it("signs storage keys when storage is configured", () => {
    process.env.STORAGE_ENDPOINT = VALID_ENV.STORAGE_ENDPOINT;
    process.env.STORAGE_ACCESS_KEY = VALID_ENV.STORAGE_ACCESS_KEY;
    process.env.STORAGE_SECRET_KEY = VALID_ENV.STORAGE_SECRET_KEY;
    process.env.STORAGE_BUCKET = VALID_ENV.STORAGE_BUCKET;

    const signed = signMediaRef("uploads/user/file.mp4");

    expect(signed).not.toBeNull();
    const url = new URL(signed as string);
    expect(url.pathname).toBe("/dreamutopia-video-media/uploads/user/file.mp4");
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(/^[0-9a-f]{64}$/);
  });
});
