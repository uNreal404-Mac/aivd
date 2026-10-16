import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SEO_LANDING_SLUGS } from "../src/lib/seo-landing";

const NOINDEX_VARS = [
  "NEXT_PUBLIC_NOINDEX",
  "NOINDEX",
  "VERCEL_ENV",
  "NEXT_PUBLIC_DEPLOY_ENV",
];

let originals: Record<string, string | undefined> = {};

beforeEach(() => {
  originals = {};
  for (const key of NOINDEX_VARS) {
    originals[key] = process.env[key];
    delete process.env[key];
  }
  process.env.NEXT_PUBLIC_APP_URL ||= "https://example.com";
});

afterEach(() => {
  for (const key of NOINDEX_VARS) {
    const value = originals[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

async function loadUrls() {
  vi.resetModules();
  const { default: sitemap } = await import("../src/app/sitemap");
  const { siteConfig } = await import("../src/config/site");
  const base = siteConfig.url.replace(/\/+$/, "");
  const urls = (await sitemap()).map((e) => e.url);
  return { base, urls };
}

describe("sitemap in production (noindex off)", () => {
  it("lists /gallery and /zh/gallery", async () => {
    const { base, urls } = await loadUrls();
    expect(urls).toContain(`${base}/gallery`);
    expect(urls).toContain(`${base}/zh/gallery`);
  });

  it("lists every SEO landing page in both locales", async () => {
    const { base, urls } = await loadUrls();
    for (const slug of SEO_LANDING_SLUGS) {
      expect(urls, slug).toContain(`${base}/${slug}`);
      expect(urls, slug).toContain(`${base}/zh/${slug}`);
    }
  });

  it("is empty when noindex is on", async () => {
    process.env.NOINDEX = "true";
    const { urls } = await loadUrls();
    expect(urls).toEqual([]);
  });
}, 30000);
