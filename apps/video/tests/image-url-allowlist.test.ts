import { describe, expect, it } from "vitest";
import {
  MEDIA_BUCKET,
  getOwnBucketHost,
  isAllowedImageInput,
  isOwnSignedUrl,
  isOwnUploadKey,
} from "../src/lib/image-url-allowlist";

const ACCOUNT_ID = "0123456789abcdef0123456789abcdef";
const OTHER_ACCOUNT_ID = "fedcba9876543210fedcba9876543210";
const OWN_HOST = `${ACCOUNT_ID}.r2.cloudflarestorage.com`;
const OTHER_HOST = `${OTHER_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const ENV = { STORAGE_ENDPOINT: `https://${OWN_HOST}` };

const SIGNING_PARAMS =
  "X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=abc%2F20240101&X-Amz-Signature=deadbeef";

function signedUrl(
  key = "uploads/user1/file.png",
  host = OWN_HOST,
  params = SIGNING_PARAMS,
): string {
  return `https://${host}/${MEDIA_BUCKET}/${key}?${params}`;
}

describe("getOwnBucketHost", () => {
  it("returns the account host parsed from STORAGE_ENDPOINT", () => {
    expect(getOwnBucketHost({ STORAGE_ENDPOINT: `https://${OWN_HOST}` })).toBe(
      OWN_HOST,
    );
  });

  it("lowercases the hostname", () => {
    expect(
      getOwnBucketHost({
        STORAGE_ENDPOINT: `https://${ACCOUNT_ID.toUpperCase()}.R2.CLOUDFLARESTORAGE.COM`,
      }),
    ).toBe(OWN_HOST);
  });

  it("returns null for a missing or invalid endpoint", () => {
    expect(getOwnBucketHost({})).toBeNull();
    expect(getOwnBucketHost({ STORAGE_ENDPOINT: "" })).toBeNull();
    expect(getOwnBucketHost({ STORAGE_ENDPOINT: "not a url" })).toBeNull();
    expect(
      getOwnBucketHost({ STORAGE_ENDPOINT: "https://example.com" }),
    ).toBeNull();
  });

  it("returns null when the account id is not 32 hex characters", () => {
    expect(
      getOwnBucketHost({
        STORAGE_ENDPOINT: "https://zzzz.r2.cloudflarestorage.com",
      }),
    ).toBeNull();
  });
});

describe("isOwnSignedUrl", () => {
  it("allows a valid signed URL for our bucket", () => {
    expect(isOwnSignedUrl(signedUrl(), ENV)).toBe(true);
  });

  it("rejects a URL without signing params", () => {
    expect(
      isOwnSignedUrl(
        `https://${OWN_HOST}/${MEDIA_BUCKET}/uploads/user1/file.png`,
        ENV,
      ),
    ).toBe(false);
  });

  it("rejects a URL missing one signing param", () => {
    expect(
      isOwnSignedUrl(
        signedUrl(
          "uploads/user1/file.png",
          OWN_HOST,
          "X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=deadbeef",
        ),
        ENV,
      ),
    ).toBe(false);
  });

  it("rejects another bucket", () => {
    const url = `https://${OWN_HOST}/other-bucket/uploads/user1/file.png?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects another account", () => {
    expect(isOwnSignedUrl(signedUrl("uploads/user1/file.png", OTHER_HOST), ENV))
      .toBe(false);
  });

  it("rejects *.r2.dev hosts", () => {
    const url = `https://abc.r2.dev/${MEDIA_BUCKET}/uploads/user1/file.png?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects lookalike hosts", () => {
    const url = `https://${OWN_HOST}.evil.com/${MEDIA_BUCKET}/uploads/user1/file.png?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects http urls", () => {
    const url = `http://${OWN_HOST}/${MEDIA_BUCKET}/uploads/user1/file.png?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects urls with a port", () => {
    const url = `https://${OWN_HOST}:8443/${MEDIA_BUCKET}/uploads/user1/file.png?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects urls with credentials", () => {
    const url = `https://user:pass@${OWN_HOST}/${MEDIA_BUCKET}/uploads/user1/file.png?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects path traversal", () => {
    const url = `https://${OWN_HOST}/${MEDIA_BUCKET}/../secret.png?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects encoded path traversal", () => {
    const url = `https://${OWN_HOST}/${MEDIA_BUCKET}/%2e%2e/secret.png?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects an empty object key", () => {
    const url = `https://${OWN_HOST}/${MEDIA_BUCKET}/?${SIGNING_PARAMS}`;
    expect(isOwnSignedUrl(url, ENV)).toBe(false);
  });

  it("rejects a non-url string", () => {
    expect(isOwnSignedUrl("not a url", ENV)).toBe(false);
  });
});

describe("isOwnUploadKey", () => {
  it("allows an upload key owned by the user", () => {
    expect(isOwnUploadKey("uploads/user1/file.png", "user1")).toBe(true);
  });

  it("rejects another user's key", () => {
    expect(isOwnUploadKey("uploads/user2/file.png", "user1")).toBe(false);
  });

  it("rejects a prefix trick", () => {
    expect(isOwnUploadKey("uploads/user1x/file.png", "user1")).toBe(false);
  });

  it("rejects traversal, backslashes, schemes, query and fragment", () => {
    expect(isOwnUploadKey("uploads/user1/../file.png", "user1")).toBe(false);
    expect(isOwnUploadKey("uploads/user1\\file.png", "user1")).toBe(false);
    expect(isOwnUploadKey("uploads/user1/https://evil.com", "user1")).toBe(
      false,
    );
    expect(isOwnUploadKey("uploads/user1/file.png?x=1", "user1")).toBe(false);
    expect(isOwnUploadKey("uploads/user1/file.png#frag", "user1")).toBe(false);
  });

  it("rejects a leading slash", () => {
    expect(isOwnUploadKey("/uploads/user1/file.png", "user1")).toBe(false);
  });

  it("rejects an empty user id", () => {
    expect(isOwnUploadKey("uploads/user1/file.png", "")).toBe(false);
  });

  it("rejects an empty key after the prefix", () => {
    expect(isOwnUploadKey("uploads/user1/", "user1")).toBe(false);
  });

  it("rejects keys longer than 1024 characters", () => {
    expect(isOwnUploadKey(`uploads/user1/${"a".repeat(1024)}`, "user1")).toBe(
      false,
    );
  });
});

describe("isAllowedImageInput", () => {
  it("allows a signed URL for our bucket", () => {
    expect(isAllowedImageInput(signedUrl(), { userId: "user1", env: ENV }))
      .toBe(true);
  });

  it("allows an upload key for the same user", () => {
    expect(
      isAllowedImageInput("uploads/user1/file.png", {
        userId: "user1",
        env: ENV,
      }),
    ).toBe(true);
  });

  it("rejects other users' upload keys", () => {
    expect(
      isAllowedImageInput("uploads/user2/file.png", {
        userId: "user1",
        env: ENV,
      }),
    ).toBe(false);
  });

  it("rejects plain external urls", () => {
    expect(isAllowedImageInput("https://evil.com/a.png", { userId: "user1" }))
      .toBe(false);
  });
});
