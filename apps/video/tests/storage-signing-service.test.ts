import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  IMAGE_REF_PATTERN,
  resetStorageForTests,
  signMediaRef,
} from "@/lib/storage";

const STORAGE_ENV = {
  STORAGE_ENDPOINT: "https://acc.r2.cloudflarestorage.com",
  STORAGE_ACCESS_KEY: "AK",
  STORAGE_SECRET_KEY: "SK",
  STORAGE_BUCKET: "b",
} as const;

const ORIGINAL_ENV: Record<string, string | undefined> = {};
for (const key of Object.keys(STORAGE_ENV)) {
  ORIGINAL_ENV[key] = process.env[key];
}

beforeEach(() => {
  for (const [key, value] of Object.entries(STORAGE_ENV)) {
    process.env[key] = value;
  }
  resetStorageForTests();
});

afterEach(() => {
  for (const key of Object.keys(STORAGE_ENV)) {
    const previous = ORIGINAL_ENV[key];
    if (previous === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = previous;
    }
  }
  resetStorageForTests();
});

describe("signMediaRef", () => {
  it("signs a storage key with the default 900s expiry", () => {
    const url = signMediaRef("uploads/u1/x.png");

    expect(url).toContain("/b/uploads/u1/x.png?");
    expect(url).toContain("X-Amz-Expires=900");
  });

  it("passes legacy http(s) URLs through unchanged", () => {
    const legacy = "https://example.com/media/a.png";

    expect(signMediaRef(legacy)).toBe(legacy);
  });

  it("returns null for empty values", () => {
    expect(signMediaRef(null)).toBeNull();
    expect(signMediaRef("")).toBeNull();
  });
});

describe("IMAGE_REF_PATTERN", () => {
  it("accepts a well-formed uploads key", () => {
    expect(IMAGE_REF_PATTERN.test("uploads/u_1/abc.png")).toBe(true);
  });

  it("accepts a canvas upload key", () => {
    expect(IMAGE_REF_PATTERN.test("uploads/u_1/canvas/abc.png")).toBe(true);
  });

  it("rejects other nested folders and traversal through canvas", () => {
    expect(IMAGE_REF_PATTERN.test("uploads/u_1/other/abc.png")).toBe(false);
    expect(IMAGE_REF_PATTERN.test("uploads/u_1/canvas/../abc.png")).toBe(false);
    expect(IMAGE_REF_PATTERN.test("uploads/u_1/canvas/x/abc.png")).toBe(false);
  });

  it("rejects traversal and malformed references", () => {
    expect(IMAGE_REF_PATTERN.test("../x")).toBe(false);
    expect(IMAGE_REF_PATTERN.test("uploads/u1/../../etc")).toBe(false);
  });
});
