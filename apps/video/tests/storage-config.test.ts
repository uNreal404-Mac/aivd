import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  STORAGE_REQUIRED_VARS,
  Storage,
  StorageNotConfiguredError,
  getStorage,
  getStorageConfig,
  isStorageConfigured,
  resetStorageForTests,
} from "../src/lib/storage";

const STORAGE_ENV_KEYS = [
  "STORAGE_ENDPOINT",
  "STORAGE_REGION",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
  "STORAGE_DOMAIN",
] as const;

const R2_ENDPOINT =
  "https://3d16103f94443a1948212feedf4ddcc1.r2.cloudflarestorage.com";
const PUBLIC_DOMAIN = "https://pub-815356967201474cb205db07727e85fa.r2.dev";

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
    expect(result.config.publicDomain).toBeUndefined();
  });

  it("trims values and honours STORAGE_REGION / STORAGE_DOMAIN", () => {
    const result = getStorageConfig({
      ...VALID_ENV,
      STORAGE_ENDPOINT: `  ${R2_ENDPOINT}  `,
      STORAGE_REGION: "  eu-west-1 ",
      STORAGE_DOMAIN: `  ${PUBLIC_DOMAIN} `,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected an ok result");
    }

    expect(result.config.endpoint).toBe(R2_ENDPOINT);
    expect(result.config.region).toBe("eu-west-1");
    expect(result.config.publicDomain).toBe(PUBLIC_DOMAIN);
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

describe("Storage.getPublicUrl", () => {
  const baseConfig = {
    endpoint: R2_ENDPOINT,
    region: "auto",
    accessKeyId: "access-key-id",
    secretAccessKey: "secret-access-key",
    bucket: "dreamutopia-video-media",
  };

  it("prefers the public domain when provided", () => {
    const storage = new Storage({
      ...baseConfig,
      publicDomain: `${PUBLIC_DOMAIN}/`,
    });

    expect(storage.getPublicUrl("uploads/user/file.mp4")).toBe(
      `${PUBLIC_DOMAIN}/uploads/user/file.mp4`
    );
  });

  it("falls back to endpoint/bucket", () => {
    const storage = new Storage(baseConfig);

    expect(storage.getPublicUrl("uploads/user/file.mp4")).toBe(
      `${R2_ENDPOINT}/dreamutopia-video-media/uploads/user/file.mp4`
    );
  });
});
