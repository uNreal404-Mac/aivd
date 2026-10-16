import { describe, expect, it } from "vitest";
import {
  SIGNED_URL_HOST_SUFFIXES,
  getAllowedImageHosts,
  isAllowedImageUrl,
} from "../src/lib/image-url-allowlist";

describe("getAllowedImageHosts", () => {
  it("returns the STORAGE_DOMAIN host without a scheme", () => {
    expect(
      getAllowedImageHosts({ STORAGE_DOMAIN: "storage.example.com" }),
    ).toEqual(["storage.example.com"]);
  });

  it("returns the STORAGE_DOMAIN host with an https:// scheme", () => {
    expect(
      getAllowedImageHosts({ STORAGE_DOMAIN: "https://storage.example.com" }),
    ).toEqual(["storage.example.com"]);
  });

  it("ignores an empty STORAGE_DOMAIN", () => {
    expect(getAllowedImageHosts({ STORAGE_DOMAIN: "" })).toEqual([]);
  });

  it("ignores an invalid STORAGE_DOMAIN", () => {
    expect(getAllowedImageHosts({ STORAGE_DOMAIN: "not a url" })).toEqual([]);
  });

  it("includes comma-separated extra hosts, trimmed and lowercased", () => {
    expect(
      getAllowedImageHosts({
        IMAGE_URL_ALLOWED_HOSTS: " Images.Example.com ,cdn.example.com ",
      }),
    ).toEqual(["images.example.com", "cdn.example.com"]);
  });

  it("combines STORAGE_DOMAIN and extra hosts", () => {
    expect(
      getAllowedImageHosts({
        STORAGE_DOMAIN: "storage.example.com",
        IMAGE_URL_ALLOWED_HOSTS: "images.example.com",
      }),
    ).toEqual(["storage.example.com", "images.example.com"]);
  });
});

describe("isAllowedImageUrl", () => {
  const env = {
    STORAGE_DOMAIN: "storage.example.com",
    IMAGE_URL_ALLOWED_HOSTS: "images.example.com",
  };

  it("allows the STORAGE_DOMAIN host", () => {
    expect(isAllowedImageUrl("https://storage.example.com/a.png", env)).toBe(
      true,
    );
  });

  it("allows extra allowed hosts", () => {
    expect(isAllowedImageUrl("https://images.example.com/a.png", env)).toBe(
      true,
    );
  });

  it("allows r2 cloudflare storage signed hosts", () => {
    expect(
      isAllowedImageUrl(
        "https://bucket.r2.cloudflarestorage.com/a.png?sig=1",
        env,
      ),
    ).toBe(true);
  });

  it("allows r2.dev signed hosts", () => {
    expect(isAllowedImageUrl("https://bucket.r2.dev/a.png", env)).toBe(true);
  });

  it("rejects http urls", () => {
    expect(isAllowedImageUrl("http://storage.example.com/a.png", env)).toBe(
      false,
    );
  });

  it("rejects r2.dev lookalikes", () => {
    expect(isAllowedImageUrl("https://r2.dev.evil.com/a.png", env)).toBe(false);
    expect(isAllowedImageUrl("https://evilr2.dev/a.png", env)).toBe(false);
  });

  it("rejects the storage domain as a subdomain of an attacker", () => {
    expect(
      isAllowedImageUrl("https://storage.example.com.attacker.com/a.png", env),
    ).toBe(false);
    expect(
      isAllowedImageUrl("https://attacker.com/storage.example.com/a.png", env),
    ).toBe(false);
  });

  it("rejects URLs with credentials", () => {
    expect(
      isAllowedImageUrl("https://user:pass@storage.example.com/a.png", env),
    ).toBe(false);
    expect(
      isAllowedImageUrl("https://user@storage.example.com/a.png", env),
    ).toBe(false);
  });

  it("rejects invalid strings", () => {
    expect(isAllowedImageUrl("not a url", env)).toBe(false);
    expect(isAllowedImageUrl("", env)).toBe(false);
  });

  it("exposes the trusted signed-url host suffixes", () => {
    expect(SIGNED_URL_HOST_SUFFIXES).toContain(".r2.dev");
    expect(SIGNED_URL_HOST_SUFFIXES).toContain(".r2.cloudflarestorage.com");
  });
});
